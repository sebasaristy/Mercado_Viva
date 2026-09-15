import { useState } from "react";
import { Aviso, Boton, Campo, CampoClave } from "../../componentes/ui.jsx";
import { crearPrimerAdministrador } from "../../api/sesion.js";
import { Marco } from "./Marco.jsx";

const VACIO = { codigo: "", nombre: "", cedula: "", clave: "", repetir: "" };

export function PrimerAdministrador() {
  const [f, setF] = useState(VACIO);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const errorDe = (k) => (error?.campo === k ? error.mensaje : null);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    if (f.clave && f.clave !== f.repetir) {
      return setError({ campo: "repetir", mensaje: "Las dos contraseñas no son iguales." });
    }
    setEnviando(true);
    try {
      await crearPrimerAdministrador({ codigo: f.codigo, nombre: f.nombre, cedula: f.cedula, clave: f.clave });
    } catch (err) {
      setError({
        campo: err.campo ?? null,
        mensaje: err.deRed ? "No hay conexión con el servidor." : err.message
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Marco
      titulo="Crear el administrador"
      descripcion="Es la primera vez que se abre esta tienda. Esta cuenta después crea las de cajeros y bodega."
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Aviso tono="info" titulo="¿Dónde está el código?">
          Aparece en la consola del servidor cuando arranca la API. En el servidor:{" "}
          <code className="cifras text-sm">pm2 logs mercado-api</code>
        </Aviso>
        {error && !error.campo && <Aviso tono="error" titulo="No se pudo crear">{error.mensaje}</Aviso>}

        <Campo id="codigo" etiqueta="Código de instalación" placeholder="ABCD-2345"
          autoComplete="off" autoCapitalize="characters" spellCheck={false}
          value={f.codigo} onChange={cambiar("codigo")} error={errorDe("codigo")} />
        <Campo id="nombre" etiqueta="Tu nombre" autoComplete="name"
          value={f.nombre} onChange={cambiar("nombre")} error={errorDe("nombre")} />
        <Campo id="cedula" etiqueta="Cédula" inputMode="numeric" autoComplete="username"
          value={f.cedula} onChange={cambiar("cedula")} error={errorDe("cedula")} />
        <CampoClave id="clave" etiqueta="Contraseña" autoComplete="new-password"
          ayuda="Mínimo 8 caracteres. Una frase corta sirve: canasta-verde-17."
          value={f.clave} onChange={cambiar("clave")} error={errorDe("clave")} />
        <CampoClave id="repetir" etiqueta="Repite la contraseña" autoComplete="new-password"
          value={f.repetir} onChange={cambiar("repetir")} error={errorDe("repetir")} />

        <Boton type="submit" tono="principal" tam="grande" cargando={enviando} className="mt-1 w-full">
          Crear y entrar
        </Boton>
      </form>
    </Marco>
  );
}
