// Lee el estado real del sistema para el panel. Solo consultas, nada de escribir.
import { consultar } from "../plataforma/db.js";
import { config } from "../plataforma/config.js";

export async function estadoBaseDeDatos() {
  try {
    const { rows: [v] } = await consultar("select version(), now() as ahora");
    return { conecta: true, motor: v.version.split(",")[0], hora: v.ahora };
  } catch (e) {
    return { conecta: false, error: e.message };
  }
}

export async function migracionesAplicadas() {
  try {
    const { rows } = await consultar(
      "select archivo, aplicada_en from _migraciones order by archivo"
    );
    return rows;
  } catch {
    // Si la tabla no existe, las migraciones se corrieron a mano (por ejemplo
    // pegando el SQL en Supabase). No es un error: solo no hay registro.
    return null;
  }
}

export async function tablasYConteos() {
  const tablas = [
    "productos", "equivalencias", "ubicaciones", "movimientos", "existencias",
    "reservas", "colchones", "sesiones_conteo", "zonas_conteo", "conteo_lineas",
    "pedidos", "pedido_lineas", "pedido_eventos"
  ];

  const { rows: presentes } = await consultar(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1)`,
    [tablas]
  );
  const hay = new Set(presentes.map((r) => r.table_name));

  const resultado = [];
  for (const t of tablas) {
    if (!hay.has(t)) { resultado.push({ tabla: t, existe: false, filas: null }); continue; }
    const { rows: [c] } = await consultar(`select count(*)::int as n from ${t}`);
    resultado.push({ tabla: t, existe: true, filas: c.n });
  }
  return resultado;
}

// Los tres números de los que habla ARQUITECTURA.md, para los productos que existan.
export async function fotoDelInventario(limite = 25) {
  try {
    const { rows } = await consultar(
      `select p.id, p.nombre, p.categoria, p.unidad,
              coalesce(d.teorico, 0)    as teorico,
              coalesce(d.reservado, 0)  as reservado,
              coalesce(d.colchon, 0)    as colchon,
              coalesce(d.disponible, 0) as disponible
         from productos p
         left join v_disponible d
           on d.producto_id = p.id and d.tenant_id = p.tenant_id
        where p.tenant_id = $1 and p.activo
        order by p.categoria, p.nombre
        limit $2`,
      [config.tenantPorDefecto, limite]
    );
    return rows;
  } catch (e) {
    return { error: e.message };
  }
}

export async function ultimosMovimientos(limite = 15) {
  try {
    const { rows } = await consultar(
      `select m.id, m.tipo, m.cantidad, m.motivo, m.creado_en, m.registrado_en,
              p.nombre as producto
         from movimientos m
         join productos p on p.id = m.producto_id
        where m.tenant_id = $1
        order by m.registrado_en desc
        limit $2`,
      [config.tenantPorDefecto, limite]
    );
    return rows;
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
