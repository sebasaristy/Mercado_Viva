import { useEffect, useState } from "react";
import { Encabezado, Contenido } from "../../componentes/Estructura.jsx";
import { Aviso, Boton, Campo, Esqueleto, Seccion, Segmentado } from "../../componentes/ui.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { avisar } from "../../componentes/Avisos.jsx";
import { obtenerJson, enviarJson, cambiarJson } from "../../api/cliente.js";
import { usarSesion } from "../../api/sesion.js";
import { ROLES, nombreDeRol } from "../../lib/roles.js";

// Contraseña temporal fácil de dictar en voz alta: dos palabras y un número.
const PALABRAS = ["arroz", "panela", "canasta", "mango", "yuca", "cafe", "limon", "queso", "maiz", "guayaba", "cacao", "fresa"];
function claveTemporal() {
  const azar = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  return `${PALABRAS[azar(PALABRAS.length)]}-${PALABRAS[azar(PALABRAS.length)]}-${10 + azar(90)}`;
}

const cuando = (fecha) =>
  fecha
    ? new Date(fecha).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "Nunca";

export function Usuarios() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState(null);

  async function cargar() {
    try {
      setLista(await obtenerJson("/auth/usuarios"));
      setError(null);
    } catch (e) {
      setError(e.deRed ? "Sin conexión: la lista de usuarios necesita internet." : e.message);
    }
  }
  useEffect(() => { cargar(); }, []);

  const reemplazar = (u) => setLista((l) => l.map((x) => (x.id === u.id ? u : x)));

  return (
    <>
      <Encabezado
        titulo="Usuarios"
        descripcion="Quién puede entrar y qué puede hacer. Cada persona entra con su cédula."
        accion={!creando && <Boton tono="principal" icono="mas" onClick={() => setCreando(true)}>Nuevo usuario</Boton>}
      />
      <Contenido>
        <div className="flex flex-col gap-5">
          {creando && (
            <NuevoUsuario
              alCancelar={() => setCreando(false)}
              alCrear={(u) => {
                setLista((l) => [u, ...(l ?? [])]);
                setCreando(false);
              }}
            />
          )}

          {error && <Aviso tono="error" titulo="No se pudo cargar" accion={<Boton tam="chico" icono="recargar" onClick={cargar}>Reintentar</Boton>}>{error}</Aviso>}

          <Seccion titulo="Equipo" descripcion={lista ? `${lista.filter((u) => u.activo).length} activos` : null} sinPadding>
            {!lista && !error && (
              <div className="flex flex-col gap-3 p-4">
                <Esqueleto className="h-14" /><Esqueleto className="h-14" />
              </div>
            )}
            {lista && (
              <ul className="m-0 list-none divide-y divide-borde p-0">
                {lista.map((u) => (
                  <FilaUsuario
                    key={u.id}
                    usuario={u}
                    abierto={abierto === u.id}
                    alAbrir={() => setAbierto(abierto === u.id ? null : u.id)}
                    alCambiar={reemplazar}
                  />
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </Contenido>
    </>
  );
}

function NuevoUsuario({ alCancelar, alCrear }) {
  const [f, setF] = useState({ nombre: "", cedula: "", rol: "cajero", clave: claveTemporal() });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errorDe = (k) => (error?.campo === k ? error.mensaje : null);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const u = await enviarJson("/auth/usuarios", f);
      avisar({ titulo: `${u.nombre} ya puede entrar`, texto: `Cédula ${u.cedula} y la contraseña temporal ${f.clave}.`, duracion: 12000 });
      alCrear(u);
    } catch (err) {
      setError({ campo: err.campo ?? null, mensaje: err.deRed ? "No hay conexión con el servidor." : err.message });
    } finally {
      setEnviando(false);
    }
  }

  const rol = ROLES.find((r) => r.valor === f.rol);

  return (
    <Seccion titulo="Nuevo usuario">
      <form onSubmit={enviar} noValidate className="grid gap-4 md:grid-cols-2">
        {error && !error.campo && <div className="md:col-span-2"><Aviso tono="error" titulo="No se creó">{error.mensaje}</Aviso></div>}
        <Campo id="nu-nombre" etiqueta="Nombre" autoComplete="off" autoFocus
          value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} error={errorDe("nombre")} />
        <Campo id="nu-cedula" etiqueta="Cédula" inputMode="numeric" autoComplete="off"
          value={f.cedula} onChange={(e) => setF({ ...f, cedula: e.target.value })} error={errorDe("cedula")} />

        <div className="md:col-span-2">
          <Segmentado etiqueta="Qué hace" apilado opciones={ROLES} valor={f.rol} onCambio={(rol) => setF({ ...f, rol })} />
          <p className="mt-1.5 text-sm text-tenue">{rol.descripcion}</p>
        </div>

        <div className="flex items-end gap-2 md:col-span-2">
          <Campo id="nu-clave" etiqueta="Contraseña temporal" autoComplete="off" spellCheck={false} className="flex-1"
            ayuda="Dísela a la persona. La primera vez que entre la tiene que cambiar."
            value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} error={errorDe("clave")} />
        </div>
        <div className="-mt-2 md:col-span-2">
          <Boton tam="chico" tono="fantasma" icono="recargar" onClick={() => setF({ ...f, clave: claveTemporal() })}>
            Generar otra
          </Boton>
        </div>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Boton type="submit" tono="principal" cargando={enviando}>Crear usuario</Boton>
          <Boton onClick={alCancelar}>Cancelar</Boton>
        </div>
      </form>
    </Seccion>
  );
}

function FilaUsuario({ usuario: u, abierto, alAbrir, alCambiar }) {
  const yo = usarSesion((s) => s.usuario);
  const esYo = yo?.id === u.id;
  const [clave, setClave] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(null);

  async function guardar(cambios, que, mensaje) {
    setError(null);
    setGuardando(que);
    try {
      const actualizado = await cambiarJson(`/auth/usuarios/${u.id}`, cambios);
      alCambiar(actualizado);
      avisar(mensaje(actualizado));
      setClave(null);
    } catch (err) {
      setError(err.deRed ? "No hay conexión con el servidor." : err.message);
    } finally {
      setGuardando(null);
    }
  }

  return (
    <li className={u.activo ? "" : "bg-panel-alt/60"}>
      <button
        type="button"
        onClick={alAbrir}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-alt"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className={"font-semibold " + (u.activo ? "" : "text-tenue line-through")}>{u.nombre}</span>
            {esYo && <span className="text-sm text-tenue">(tú)</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-tenue">
            <span className="cifras">{u.cedula}</span>
            <span>Último ingreso: {cuando(u.ultimoIngreso)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-panel-alt px-2 py-0.5 text-xs font-semibold text-tinta">{nombreDeRol(u.rol)}</span>
          {!u.activo && <span className="text-xs font-semibold text-peligro">Desactivado</span>}
          {u.activo && u.debeCambiarClave && <span className="text-xs font-semibold text-acento">Clave temporal</span>}
        </span>
        <Icono nombre="flecha" tam={16} className={"text-tenue transition-transform duration-100 " + (abierto ? "rotate-90" : "")} />
      </button>

      {abierto && (
        <div className="flex flex-col gap-4 border-t border-borde bg-fondo px-4 py-4">
          {error && <Aviso tono="error" titulo="No se guardó">{error}</Aviso>}

          {esYo ? (
            <p className="text-[15px] text-tenue">
              Tu propio rol y tu acceso los cambia otro administrador. Tu contraseña la cambias en Cuenta.
            </p>
          ) : (
            <>
              <Segmentado
                etiqueta="Qué hace"
                apilado
                opciones={ROLES}
                valor={u.rol}
                onCambio={(rol) => rol !== u.rol && guardar({ rol }, "rol", (x) => ({ titulo: `${x.nombre} ahora es ${nombreDeRol(x.rol).toLowerCase()}`, texto: "Tiene que volver a entrar." }))}
              />

              {clave === null ? (
                <div className="flex flex-wrap gap-2">
                  <Boton tam="chico" icono="candado" onClick={() => setClave(claveTemporal())}>Restablecer contraseña</Boton>
                  {u.activo ? (
                    <Boton tam="chico" tono="peligro" cargando={guardando === "activo"}
                      onClick={() => guardar({ activo: false }, "activo", (x) => ({ titulo: `${x.nombre} ya no puede entrar`, texto: "Se cerró en todos sus equipos." }))}>
                      Desactivar
                    </Boton>
                  ) : (
                    <Boton tam="chico" cargando={guardando === "activo"}
                      onClick={() => guardar({ activo: true }, "activo", (x) => ({ titulo: `${x.nombre} puede volver a entrar` }))}>
                      Activar
                    </Boton>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Campo id={`clave-${u.id}`} etiqueta="Nueva contraseña temporal" autoComplete="off" spellCheck={false}
                    ayuda="Se cierra su sesión en todos los equipos y al entrar la tiene que cambiar."
                    value={clave} onChange={(e) => setClave(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Boton tam="chico" tono="principal" cargando={guardando === "clave"}
                      onClick={() => guardar({ clave }, "clave", (x) => ({ titulo: `Contraseña de ${x.nombre} restablecida`, texto: `Temporal: ${clave}`, duracion: 12000 }))}>
                      Guardar
                    </Boton>
                    <Boton tam="chico" tono="fantasma" onClick={() => setClave(null)}>Cancelar</Boton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
