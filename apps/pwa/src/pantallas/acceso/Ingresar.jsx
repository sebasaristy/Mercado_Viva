import { useState } from "react";
import { Aviso, Boton, Campo, CampoClave } from "../../componentes/ui.jsx";
import { ingresar } from "../../api/sesion.js";
import { Marco } from "./Marco.jsx";

export function Ingresar() {
  const [cedula, setCedula] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    if (!cedula.trim()) return setError({ campo: "cedula", mensaje: "Escribe tu cédula." });
    if (!clave) return setError({ campo: "clave", mensaje: "Escribe tu contraseña." });

    setEnviando(true);
    try {
      await ingresar(cedula, clave);
    } catch (err) {
      setClave("");
      setError({
        campo: err.campo === "cedula" ? "cedula" : null,
        mensaje: err.deRed
          ? "No hay conexión con el servidor. La primera vez en este equipo hace falta internet; después la app abre sin señal."
          : err.message
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Marco
      titulo="Entrar"
      descripcion="Con tu cédula y la contraseña que te dio el administrador."
      pie={
        <p className="text-sm text-tenue">
          ¿Se te olvidó la contraseña? El administrador la restablece desde Usuarios.
        </p>
      }
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {error && !error.campo && (
          <Aviso tono="error" titulo="No pudiste entrar">{error.mensaje}</Aviso>
        )}
        <Campo
          id="cedula"
          etiqueta="Cédula"
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          error={error?.campo === "cedula" ? error.mensaje : null}
        />
        <CampoClave
          id="clave"
          etiqueta="Contraseña"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          error={error?.campo === "clave" ? error.mensaje : null}
        />
        <Boton type="submit" tono="principal" tam="grande" cargando={enviando} className="mt-1 w-full">
          Entrar
        </Boton>
      </form>
    </Marco>
  );
}
