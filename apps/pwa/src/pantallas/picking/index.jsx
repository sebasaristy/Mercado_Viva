// Recolección. Lo importante de esta pantalla es el botón de "no lo encontré":
// cuando el recolector lo toca, un humano acaba de mirar el estante.
// Es el mejor dato de inventario que tiene la cadena, y hoy casi nadie lo guarda.
//
// Pendiente:
//  - lista de líneas del pedido
//  - marcar faltante -> encolar POST /pedidos/lineas/:id/faltante
//  - mostrar los reemplazos que devuelve el servidor
export function Picking() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Recolección</h1>
      <p>No hay pedidos asignados.</p>
    </main>
  );
}
