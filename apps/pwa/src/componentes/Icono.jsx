// Iconos en línea, trazo de 1.75 para que se lean a un brazo de distancia.
// Nada de emoji: no heredan color, se ven distinto en cada Android y el lector
// de pantalla los lee completos en mitad de la frase.
const TRAZOS = {
  inventario: "M21 8 12 3 3 8v8l9 5 9-5V8Z M3 8l9 5 9-5 M12 13v8",
  caja: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2 M9.5 21h.01 M17.5 21h.01",
  tablero: "M4 20V11 M10 20V4 M16 20v-7 M21 20H3",
  escanear: "M4 7V4h3 M17 4h3v3 M20 17v3h-3 M7 20H4v-3 M4 12h16",
  camara: "M4 8h3l2-3h6l2 3h3v11H4V8Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4",
  mas: "M12 5v14 M5 12h14",
  menos: "M5 12h14",
  quitar: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
  alerta: "M12 4 2.5 20h19L12 4Z M12 10v4 M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8h.01",
  listo: "M4.5 12.5 9.5 17.5 20 7",
  cerrar: "M6 6l12 12 M18 6 6 18",
  entrada: "M12 3v11 M7.5 9.5 12 14l4.5-4.5 M4 17v3h16v-3",
  sube: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  baja: "M3 7l6 6 4-4 8 8 M15 17h6v-6",
  efectivo: "M3 7h18v10H3z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  tarjeta: "M3 6h18v12H3z M3 10h18 M7 15h3",
  transferencia: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M11 18h2",
  subir: "M12 19V6 M6.5 11.5 12 6l5.5 5.5",
  sinRed: "M3 3l18 18 M8.5 16.5a5 5 0 0 1 6-7.9 M5.5 12.5a8.5 8.5 0 0 1 2-2.4 M12 20h.01",
  recargar: "M20 11a8 8 0 0 0-14.3-4.9L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.3 4.9L20 16 M20 20v-4h-4",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2"
};

export function Icono({ nombre, tam = 22, className = "" }) {
  const d = TRAZOS[nombre];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={"shrink-0 " + className}
    >
      {d.split(" M").map((parte, i) => (
        <path key={i} d={i === 0 ? parte : "M" + parte} />
      ))}
    </svg>
  );
}
