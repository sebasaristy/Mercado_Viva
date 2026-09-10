import { useEffect, useRef, useState } from "react";

// El lector USB se comporta como un teclado: manda las teclas muy rápido y cierra
// con Enter. Se detecta por la velocidad, no por el dispositivo.
// La cámara es el plan B, no el camino principal.
const MS_ENTRE_TECLAS = 35;

export function Escaner({ onCodigo, autoFoco = true }) {
  const [valor, setValor] = useState("");
  const ultimaTecla = useRef(0);
  const campo = useRef(null);

  useEffect(() => { if (autoFoco) campo.current?.focus(); }, [autoFoco]);

  function alTeclear(e) {
    const ahora = Date.now();
    const rapido = ahora - ultimaTecla.current < MS_ENTRE_TECLAS;
    ultimaTecla.current = ahora;

    if (e.key === "Enter" && valor.length >= 6) {
      onCodigo(valor.trim(), { deLector: rapido });
      setValor("");
      e.preventDefault();
    }
  }

  return (
    <input
      ref={campo}
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onKeyDown={alTeclear}
      inputMode="numeric"
      placeholder="Escanea o escribe el código"
      style={{ fontSize: 22, padding: 14, width: "100%" }}
    />
  );
}

// Pendiente: respaldo por cámara con BarcodeDetector y @zxing/browser
// cuando el navegador no lo traiga.
