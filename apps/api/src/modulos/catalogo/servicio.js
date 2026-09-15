import { leerCodigoBalanza, nuevoId } from "@mv/compartido";
import { ErrorDeNegocio, ErrorNoEncontrado } from "../../plataforma/errores.js";
import * as repo from "./repo.js";

// Un código de balanza no identifica un producto por sí solo: trae peso o precio
// adentro. Se separa aquí, no en la pantalla, para que valga igual desde cualquier cliente.
export async function buscarPorCodigo(tenantId, codigoEscaneado) {
  const codigo = String(codigoEscaneado).trim();
  const leido = leerCodigoBalanza(codigo);
  const interno = leido.codigoProducto ?? codigo;

  const producto = await repo.porCodigo(tenantId, interno);
  if (!producto) {
    // No es una falla: es un producto que todavía no está en el catálogo.
    // Se devuelve el código ya interpretado para poder crearlo de una vez.
    throw new ErrorDeNegocio(
      "Ese código todavía no está en el catálogo.",
      "producto_no_registrado",
      404,
      { codigo: interno, esDeBalanza: leido.esDeBalanza, pesoKg: leido.pesoKg ?? null }
    );
  }

  return {
    producto,
    esDeBalanza: leido.esDeBalanza,
    pesoKg: leido.pesoKg ?? null,
    precioLeido: leido.precio ?? null
  };
}

export async function obtener(tenantId, id) {
  const producto = await repo.porId(tenantId, id);
  if (!producto) throw new ErrorNoEncontrado(`producto ${id}`);
  return producto;
}

export const listar = (tenantId, busqueda) => repo.listar(tenantId, busqueda);

const MENSAJES_CREAR = {
  nombre_requerido: "Escribe el nombre del producto.",
  unidad_invalida: "Elige si se vende por unidad o por kilo.",
  precio_invalido: "El precio de venta tiene que ser mayor que cero.",
  cantidad_invalida: "La cantidad inicial no es válida. Si se vende por unidad, no lleva decimales."
};

export async function crear(usuario, entrada) {
  const r = await repo.crear({
    ...entrada,
    tenantId: usuario.tenantId,
    usuarioId: usuario.id,
    movimientoId: entrada.cantidadInicial > 0 ? nuevoId() : null
  });

  if (!r.ok) {
    if (r.error === "codigo_duplicado") {
      throw new ErrorDeNegocio(
        `Ese código ya es de «${r.producto.nombre}».`,
        "codigo_duplicado",
        409,
        { producto: r.producto }
      );
    }
    throw new ErrorDeNegocio(MENSAJES_CREAR[r.error] ?? "No se pudo crear el producto.", r.error, 400);
  }

  return { producto: r.producto, yaExistia: r.yaExistia };
}

export const equivalentesDe = (tenantId, productoId) =>
  repo.equivalentes(tenantId, productoId);
