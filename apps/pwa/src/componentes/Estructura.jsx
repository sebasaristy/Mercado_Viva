import { NavLink } from "react-router-dom";
import { Icono } from "./Icono.jsx";
import { Boton } from "./ui.jsx";
import { ZonaAvisos } from "./Avisos.jsx";
import { usarConexion } from "../local/conexion.js";
import { subirPendientes } from "../local/sync.js";
import { usarSesion } from "../api/sesion.js";
import { seccionesDe, nombreDeRol } from "../lib/roles.js";

const CUENTA = { a: "/cuenta", icono: "cuenta", texto: "Cuenta" };

// En computador: menú a la izquierda. En celular y tablet: abajo, donde llega
// el pulgar. Lo mismo, acomodado a cómo se sostiene cada equipo.
// Cada quien ve solo las secciones de su rol.
export function Estructura({ children }) {
  const usuario = usarSesion((s) => s.usuario);
  const SECCIONES = seccionesDe(usuario.rol);
  const abajo = [...SECCIONES.filter((s) => !s.soloEscritorio), CUENTA];

  return (
    <div className="min-h-dvh bg-fondo lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="hidden border-r border-borde bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="border-b border-borde px-5 py-5">
          <p className="text-[17px] font-semibold tracking-tight">Mercado Viva</p>
          <p className="text-sm text-tenue">Sede Centro</p>
        </div>
        <nav aria-label="Secciones" className="flex flex-col gap-1 p-3">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.a}
              to={s.a}
              className={({ isActive }) =>
                "flex items-center gap-3 rounded-pieza px-3 py-2.5 transition-colors duration-100 " +
                (isActive ? "bg-acento-suave text-acento" : "text-tinta hover:bg-panel-alt")
              }
            >
              <Icono nombre={s.icono} tam={21} />
              <span className="flex flex-col leading-tight">
                <span className="font-semibold">{s.texto}</span>
                <span className="text-xs text-tenue">{s.ayuda}</span>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-borde p-3">
          <NavLink
            to="/cuenta"
            className={({ isActive }) =>
              "flex items-center gap-3 rounded-pieza px-3 py-2 transition-colors duration-100 " +
              (isActive ? "bg-acento-suave text-acento" : "hover:bg-panel-alt")
            }
          >
            <Icono nombre="cuenta" tam={21} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{usuario.nombre}</span>
              <span className="text-xs text-tenue">{nombreDeRol(usuario.rol)}</span>
            </span>
          </NavLink>
          <div className="px-3 pb-1">
            <EstadoConexionCorto />
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <BarraConexion />
        <main className="flex-1">{children}</main>
      </div>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-borde bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${abajo.length}, minmax(0, 1fr))` }}
      >
        {abajo.map((s) => (
          <NavLink
            key={s.a}
            to={s.a}
            className={({ isActive }) =>
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[13px] font-semibold " +
              "transition-colors duration-100 " +
              (isActive ? "text-acento" : "text-tenue hover:text-tinta")
            }
          >
            <Icono nombre={s.icono} tam={22} />
            {s.texto}
          </NavLink>
        ))}
      </nav>

      <ZonaAvisos />
    </div>
  );
}

// Solo aparece cuando hay algo que la persona tenga que saber.
function BarraConexion() {
  const { hayServidor, pendientes, atascadas, subiendo } = usarConexion();

  if (atascadas.length > 0) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-peligro/30 bg-peligro-suave px-4 py-2.5 text-[15px] text-peligro lg:px-8">
        <Icono nombre="alerta" tam={18} />
        <span className="flex-1 font-medium">
          {atascadas.length === 1
            ? "Una operación no se pudo subir"
            : `${atascadas.length} operaciones no se pudieron subir`}
          {": "}
          <span className="font-normal">{atascadas[0].ultimoError}</span>
        </span>
      </div>
    );
  }

  if (!hayServidor) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-acento/30 bg-acento-suave px-4 py-2.5 text-[15px] text-acento lg:px-8">
        <Icono nombre="sinRed" tam={18} />
        <span className="flex-1 font-medium">
          Sin conexión con el servidor.{" "}
          <span className="font-normal text-tinta">
            {pendientes > 0
              ? `${pendientes} ${pendientes === 1 ? "operación guardada" : "operaciones guardadas"} en este equipo; se suben solas.`
              : "Puedes seguir trabajando: lo que registres se guarda aquí y se sube solo."}
          </span>
        </span>
      </div>
    );
  }

  if (pendientes > 0) {
    return (
      <div role="status" className="flex items-center gap-3 border-b border-borde bg-acento-suave px-4 py-2 text-[15px] text-acento lg:px-8">
        <Icono nombre="subir" tam={18} />
        <span className="flex-1 font-medium">
          {subiendo ? "Subiendo…" : `${pendientes} ${pendientes === 1 ? "operación" : "operaciones"} por subir`}
        </span>
        {!subiendo && (
          <Boton tam="chico" onClick={subirPendientes}>Subir ahora</Boton>
        )}
      </div>
    );
  }

  return null;
}

function EstadoConexionCorto() {
  const { hayServidor, pendientes } = usarConexion();
  return (
    <p className={`flex items-center gap-2 text-sm ${hayServidor ? "text-tenue" : "text-acento"}`}>
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${hayServidor ? "bg-ok" : "bg-acento"}`}
      />
      {hayServidor ? "Conectado" : "Sin conexión"}
      {pendientes > 0 && ` · ${pendientes} por subir`}
    </p>
  );
}

export function Encabezado({ titulo, descripcion, accion }) {
  return (
    <header className="border-b border-borde bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-4 lg:px-8 lg:py-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-[28px]">{titulo}</h1>
          {descripcion && <p className="mt-1 max-w-[70ch] text-[15px] text-tenue">{descripcion}</p>}
        </div>
        {accion}
      </div>
    </header>
  );
}

export function Contenido({ children }) {
  return <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">{children}</div>;
}
