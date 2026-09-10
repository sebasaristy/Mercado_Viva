// Conteo ciego: el contador NO ve cuánto se supone que hay.
// Escribe lo que ve, y la diferencia la calcula el servidor al cerrar la sesión.
//
// Pendiente:
//  - traer la zona asignada al entrar (abrir la sesión sí necesita red)
//  - guardar cada línea en local.conteoBorrador mientras se cuenta
//  - encolar el cierre de la sesión
export function Conteo() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Conteo</h1>
      <p>Zona sin asignar. Pide una zona al supervisor.</p>
    </main>
  );
}
