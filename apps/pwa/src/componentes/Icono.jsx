// Iconos en línea, trazo de 1.75 para que se lean a un brazo de distancia.
// Nada de emoji: no heredan color, se ven distinto en cada Android y el lector
// de pantalla los dice completos en mitad de la frase.
const TRAZOS = {
  bodega: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z M3 7.5 12 12m0 0 9-4.5M12 12v9",
  conteo: "M4 6h16M4 12h16M4 18h10 M18 16.5l2 2 3-3.5",
  picking: "M4 5h2l2.2 10.5a2 2 0 0 0 2 1.5h7.4a2 2 0 0 0 2-1.6L21 8H7 M10 20.5h.01M17 20.5h.01",
  entrada: "M12 3v11 M7.5 9.5 12 14l4.5-4.5 M4 17v3h16v-3",
  merma: "M12 4 2.5 20h19L12 4Z M12 10v4 M12 17h.01",
  traslado: "M4 8h13l-3-3 M20 16H7l3 3",
  escanear: "M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3 M4 12h16",
  sinRed: "M3 3l18 18 M8.5 16.5a5 5 0 0 1 6-7.9 M5.5 12.5a8.5 8.5 0 0 1 2-2.4 M12 20h.01",
  subir: "M12 19V6 M6.5 11.5 12 6l5.5 5.5",
  listo: "M4.5 12.5 9.5 17.5 20 7",
  falta: "M6 6l12 12M18 6 6 18",
  atras: "M15 5l-7 7 7 7"
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
      className={className}
    >
      {d.split(" M").map((parte, i) => (
        <path key={i} d={i === 0 ? parte : "M" + parte} />
      ))}
    </svg>
  );
}
