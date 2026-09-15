// El primer administrador.
//
// Con la tienda recién instalada no hay nadie que pueda crear usuarios. Si la
// pantalla de "crear administrador" quedara abierta, el primero que encontrara
// la dirección se quedaría con la tienda. Por eso pide un código que solo ve
// quien tiene acceso al servidor: se imprime en la consola al arrancar.
export function crearInstalacion({ repositorio, claves, tenantId }) {
  let codigo = null;
  let configurada = false;

  // Devuelve el código mientras falte el administrador; null cuando ya existe.
  async function preparar() {
    if (configurada) return null;
    if (await repositorio.hayUsuarios(tenantId)) {
      configurada = true;
      codigo = null;
      return null;
    }
    codigo ??= claves.codigoLegible();
    return codigo;
  }

  const normalizar = (c) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const coincide = (intento) =>
    Boolean(codigo) && claves.igualesSinFiltrarTiempo(normalizar(intento), normalizar(codigo));

  function marcarConfigurada() {
    configurada = true;
    codigo = null;
  }

  return { preparar, coincide, marcarConfigurada };
}
