import { useState } from "react";
import { Aviso, Boton, CampoClave } from "../../componentes/ui.jsx";
import { avisar } from "../../componentes/Avisos.jsx";
import { cambiarClave, salir, usarSesion } from "../../api/sesion.js";
import { Marco } from "./Marco.jsx";

const VACIO = { actual: "", nueva: "", repetir: "" };

export function FormularioClave({ alTerminar, textoBoton = "Guardar contraseña", etiquetaActual = "Contraseña actual" }) {
  const [f, setF] = useState(VACIO);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const errorDe = (k) => (error?.campo === k ? error.mensaje : null);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    if (!f.actual) return setError({ campo: "actual", mensaje: "Escribe la contraseña con la que entraste." });
    if (f.nueva !== f.repetir) return setError({ campo: "repetir", mensaje: "Las dos contraseñas no son iguales." });
    setEnviando(true);
    try {
      await cambiarClave(f.actual, f.nueva);
      setF(VACIO);
      alTerminar?.();
    } catch (err) {
      setError({ campo: err.campo ?? null, mensaje: err.deRed ? "No hay conexión con el servidor." : err.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {error && !error.campo && <Aviso tono="error" titulo="No se cambió">{error.mensaje}</Aviso>}
      <CampoClave id="actual" etiqueta={etiquetaActual} autoComplete="current-password"
        value={f.actual} onChange={cambiar("actual")} error={errorDe("actual")} />
      <CampoClave id="nueva" etiqueta="Nueva contraseña" autoComplete="new-password"
        ayuda="Mínimo 8 caracteres, sin tu cédula. Una frase corta sirve: canasta-verde-17."
        value={f.nueva} onChange={cambiar("nueva")} error={errorDe("nueva")} />
      <CampoClave id="repetir" etiqueta="Repite la nueva" autoComplete="new-password"
        value={f.repetir} onChange={cambiar("repetir")} error={errorDe("repetir")} />
      <Boton type="submit" tono="principal" tam="grande" cargando={enviando} className="w-full">
        {textoBoton}
      </Boton>
    </form>
  );
}

// Cuando el administrador puso la contraseña: no se puede hacer nada más
// hasta elegir una propia.
export function CambiarClaveObligatoria() {
  const { usuario } = usarSesion();
  return (
    <Marco
      titulo="Elige tu contraseña"
      descripcion={`Hola, ${usuario?.nombre?.split(" ")[0] ?? ""}. Entraste con una contraseña temporal; cámbiala por una que solo sepas tú.`}
      pie={
        <Boton tono="fantasma" icono="salir" onClick={salir} className="self-start">
          No soy yo, salir
        </Boton>
      }
    >
      <FormularioClave
        etiquetaActual="Contraseña temporal"
        textoBoton="Guardar y entrar"
        alTerminar={() => avisar({ titulo: "Listo, ya tienes tu contraseña" })}
      />
    </Marco>
  );
}
