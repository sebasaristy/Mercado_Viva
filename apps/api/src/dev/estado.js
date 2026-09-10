// Lee el estado real del sistema para el panel. Solo consultas, nada de escribir.
import { supabase, oTirar } from "../plataforma/supabase.js";
import { config } from "../plataforma/config.js";

export async function estadoConexion() {
  try {
    // Una lectura barata que obliga a hablar con Supabase de verdad.
    const { error, count } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw error;
    return { conecta: true, via: "REST de Supabase", productos: count ?? 0 };
  } catch (e) {
    return { conecta: false, error: e.message, codigo: e.code ?? null };
  }
}

const TABLAS = [
  "productos", "equivalencias", "ubicaciones", "movimientos", "existencias",
  "reservas", "colchones", "sesiones_conteo", "zonas_conteo", "conteo_lineas",
  "pedidos", "pedido_lineas", "pedido_eventos"
];

export async function tablasYConteos() {
  return Promise.all(TABLAS.map(async (tabla) => {
    const { error, count } = await supabase
      .from(tabla).select("*", { count: "exact", head: true });
    // 42P01 es "la tabla no existe": es información, no una falla del panel.
    if (error) return { tabla, existe: error.code !== "42P01" ? true : false, filas: null,
                        error: error.message };
    return { tabla, existe: true, filas: count ?? 0 };
  }));
}

// Las funciones de las que depende la API. Si falta alguna, nada escribe.
const FUNCIONES = [
  { nombre: "registrar_movimiento", usada: "inventario" },
  { nombre: "disponible_de", usada: "disponibilidad" },
  { nombre: "reservar_lineas", usada: "disponibilidad" },
  { nombre: "movido_durante_conteo", usada: "conteo" },
  { nombre: "congelar_precios_pedido", usada: "pedidos" }
];

export async function funcionesInstaladas() {
  return Promise.all(FUNCIONES.map(async (f) => {
    // Se llama sin argumentos a propósito: si la función existe, Postgres se queja
    // por la firma (42883 con "no existe" solo si de verdad falta).
    const { error } = await supabase.rpc(f.nombre, {});
    const falta = error?.code === "PGRST202" ||
      (error?.code === "42883" && /does not exist/i.test(error.message));
    return { ...f, existe: !falta };
  }));
}

// Los tres números de los que habla ARQUITECTURA.md.
export async function fotoDelInventario(limite = 25) {
  try {
    const productos = oTirar(
      await supabase.from("productos")
        .select("id, nombre, categoria, unidad")
        .eq("tenant_id", config.tenantPorDefecto).eq("activo", true)
        .order("categoria").order("nombre").limit(limite),
      "leer productos"
    );

    const disponibles = oTirar(
      await supabase.from("v_disponible")
        .select("producto_id, teorico, reservado, colchon, disponible")
        .eq("tenant_id", config.tenantPorDefecto),
      "leer v_disponible"
    );

    const porProducto = new Map(disponibles.map((d) => [d.producto_id, d]));
    return productos.map((p) => {
      const d = porProducto.get(p.id) ?? {};
      return {
        ...p,
        teorico: Number(d.teorico ?? 0),
        reservado: Number(d.reservado ?? 0),
        colchon: Number(d.colchon ?? 0),
        disponible: Number(d.disponible ?? 0)
      };
    });
  } catch (e) {
    return { error: e.message };
  }
}

export async function ultimosMovimientos(limite = 15) {
  try {
    const filas = oTirar(
      await supabase.from("movimientos")
        .select("id, tipo, cantidad, motivo, creado_en, registrado_en, producto:productos(nombre)")
        .eq("tenant_id", config.tenantPorDefecto)
        .order("registrado_en", { ascending: false })
        .limit(limite),
      "leer movimientos"
    );
    return filas.map((m) => ({ ...m, producto: m.producto?.nombre ?? "?" }));
  } catch (e) {
    return { error: e.message };
  }
}

// Recorre lo que Express tiene montado, para no mantener a mano una lista de rutas.
export function rutasMontadas(app) {
  const rutas = [];

  const recorrer = (capa, prefijo = "") => {
    if (capa.route) {
      const metodos = Object.keys(capa.route.methods).map((m) => m.toUpperCase());
      rutas.push({ metodos, ruta: prefijo + capa.route.path });
    } else if (capa.name === "router" && capa.handle?.stack) {
      const base = capa.regexp?.source
        .replace("^\\/", "/")
        .replace("\\/?(?=\\/|$)", "")
        .replace(/\\\//g, "/")
        .replace(/\$$/, "");
      for (const sub of capa.handle.stack) recorrer(sub, prefijo + (base === "/" ? "" : base));
    }
  };

  for (const capa of app._router?.stack ?? []) recorrer(capa);
  return rutas;
}
