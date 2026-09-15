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
  "pedidos", "pedido_lineas", "pedido_eventos", "ventas", "venta_lineas"
];

export async function tablasYConteos() {
  return Promise.all(TABLAS.map(async (tabla) => {
    const { error, count } = await supabase
      .from(tabla).select("*", { count: "exact", head: true });
    // 42P01 es "la tabla no existe": es información, no una falla del panel.
    // PGRST205 es "no existe" en la REST de Supabase; 42P01 en Postgres directo.
    if (error) {
      const falta = error.code === "42P01" || error.code === "PGRST205";
      return { tabla, existe: !falta, filas: null, error: error.message };
    }
    return { tabla, existe: true, filas: count ?? 0 };
  }));
}

// Las funciones de las que depende la API. Si falta alguna, nada escribe.
const FUNCIONES = [
  { nombre: "registrar_movimiento", usada: "inventario" },
  { nombre: "disponible_de", usada: "disponibilidad" },
  { nombre: "reservar_lineas", usada: "disponibilidad" },
  { nombre: "movido_durante_conteo", usada: "conteo" },
  { nombre: "congelar_precios_pedido", usada: "pedidos" },
  { nombre: "producto_con_stock", usada: "catalogo" },
  { nombre: "listar_productos", usada: "catalogo" },
  { nombre: "crear_producto", usada: "catalogo" },
  { nombre: "venta_detalle", usada: "ventas" },
  { nombre: "registrar_venta", usada: "ventas" },
  { nombre: "resumen_tablero", usada: "tablero" }
];

// Se le pregunta a la REST qué funciones expone (su esquema OpenAPI). Llamarlas
// sin argumentos no sirve: responde "no encontrada" tanto si falta como si
// existe con otros parámetros.
export async function funcionesInstaladas() {
  let expuestas = new Set();
  try {
    const clave = config.supabase.serviceRoleKey;
    const resp = await fetch(`${config.supabase.url}/rest/v1/`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` }
    });
    const spec = await resp.json();
    expuestas = new Set(Object.keys(spec.paths ?? {})
      .filter((p) => p.startsWith("/rpc/"))
      .map((p) => p.slice(5)));
  } catch {
    // Si no se puede leer, todas quedan como faltantes y el panel lo muestra.
  }
  return FUNCIONES.map((f) => ({ ...f, existe: expuestas.has(f.nombre) }));
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
