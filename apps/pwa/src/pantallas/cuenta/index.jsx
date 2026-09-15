import { useState } from "react";
import { Link } from "react-router-dom";
import { Encabezado, Contenido } from "../../componentes/Estructura.jsx";
import { Aviso, Boton, Seccion } from "../../componentes/ui.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { avisar } from "../../componentes/Avisos.jsx";
import { usarSesion, salir } from "../../api/sesion.js";
import { usarConexion } from "../../local/conexion.js";
import { ROLES, nombreDeRol } from "../../lib/roles.js";
import { FormularioClave } from "../acceso/CambiarClave.jsx";

export function Cuenta() {
  const usuario = usarSesion((s) => s.usuario);
  const pendientes = usarConexion((s) => s.pendientes);
  const [confirmando, setConfirmando] = useState(false);
  const rol = ROLES.find((r) => r.valor === usuario.rol);

  const cerrar = () => {
    if (pendientes > 0 && !confirmando) return setConfirmando(true);
    salir();
  };

  return (
    <>
      <Encabezado titulo="Tu cuenta" />
      <Contenido>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Seccion titulo="Tus datos">
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                <dt className="text-tenue">Nombre</dt><dd className="m-0 font-semibold">{usuario.nombre}</dd>
                <dt className="text-tenue">Cédula</dt><dd className="cifras m-0">{usuario.cedula}</dd>
                <dt className="text-tenue">Rol</dt>
                <dd className="m-0">
                  <span className="font-semibold">{nombreDeRol(usuario.rol)}</span>
                  {rol && <span className="block text-sm text-tenue">{rol.descripcion}</span>}
                </dd>
              </dl>
            </Seccion>

            <Seccion titulo="En este equipo" sinPadding>
              <ul className="m-0 list-none divide-y divide-borde p-0">
                {usuario.rol === "administrador" && (
                  <li className="lg:hidden">
                    <FilaEnlace a="/usuarios" icono="usuarios" texto="Usuarios" ayuda="Crear cuentas y restablecer contraseñas" />
                  </li>
                )}
                <li>
                  <FilaEnlace a="/instalar" icono="celular" texto="Instalar la app" ayuda="Abre a pantalla completa y funciona sin señal" />
                </li>
              </ul>
              <div className="flex flex-col gap-3 border-t border-borde p-4">
                {confirmando && (
                  <Aviso tono="atencion" titulo={`${pendientes} ${pendientes === 1 ? "operación" : "operaciones"} sin subir`}>
                    Quedan guardadas en este equipo y se suben cuando vuelvas a entrar tú. Nadie más las sube a su nombre.
                  </Aviso>
                )}
                <Boton tono="peligro" icono="salir" onClick={cerrar} className="self-start">
                  {confirmando ? "Salir de todas formas" : "Cerrar sesión"}
                </Boton>
              </div>
            </Seccion>
          </div>

          <Seccion titulo="Cambiar contraseña" descripcion="Se cierra tu sesión en los otros equipos; en este sigues adentro.">
            <FormularioClave alTerminar={() => avisar({ titulo: "Contraseña cambiada" })} />
          </Seccion>
        </div>
      </Contenido>
    </>
  );
}

function FilaEnlace({ a, icono, texto, ayuda }) {
  return (
    <Link to={a} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-panel-alt">
      <Icono nombre={icono} tam={21} className="text-tenue" />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="font-semibold">{texto}</span>
        <span className="text-sm text-tenue">{ayuda}</span>
      </span>
      <Icono nombre="flecha" tam={16} className="text-tenue" />
    </Link>
  );
}
