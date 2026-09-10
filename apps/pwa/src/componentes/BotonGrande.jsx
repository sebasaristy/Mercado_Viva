// Se usa con guantes, con frío y a un brazo de distancia.
// El tamaño mínimo no es estético: es para que no se falle el toque.
export function BotonGrande({ children, onClick, tono = "normal", disabled }) {
  const fondos = { normal: "#1b1f19", peligro: "#a8342a", suave: "#f2f3ef" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 64, minWidth: 64, width: "100%",
        fontSize: 19, fontWeight: 600, padding: "16px 20px",
        border: 0, borderRadius: 8,
        background: fondos[tono], color: tono === "suave" ? "#1b1f19" : "#fff",
        opacity: disabled ? .5 : 1
      }}
    >
      {children}
    </button>
  );
}
