# Arquitectura y Stack — Sistema Integral para Supermercado Grande

## 1. Contexto y problemática

Se necesita diseñar una plataforma para un supermercado grande que permita separar claramente tres grandes áreas:

1. **Gestión de inventario interno**
   - Utilizada principalmente por empleados y supervisores.
   - Debe funcionar desde celulares/tablets mediante una PWA.
   - Debe permitir escanear códigos de barras/QR.
   - Debe soportar entradas, salidas, traslados, conteos, ajustes, pérdidas y devoluciones.
   - Debe contemplar múltiples sedes/bodegas.
   - Debe tolerar caídas temporales de Internet y sincronizar posteriormente.

2. **Gestión general de clientes / CRM**
   - Información de clientes.
   - Historial.
   - Membresías o relaciones comerciales si aplica.
   - Compras e interacciones.
   - Gestión desde un panel administrativo.

3. **Clientes en línea**
   - Aplicación/web/PWA orientada al cliente final.
   - Registro e inicio de sesión.
   - Catálogo.
   - Carrito.
   - Pedidos.
   - Pagos.
   - Reservas u otros servicios que el negocio implemente.
   - Estado de pedidos en tiempo real cuando sea necesario.

Además, al tratarse de un supermercado grande, existe un cuarto dominio potencialmente crítico:

4. **POS / cajas**
   - Las cajas no deberían depender exclusivamente de Internet.
   - Deben poder continuar operando ante caídas temporales de conectividad.
   - Deben sincronizar operaciones posteriormente.
   - Deben integrarse con inventario y ventas de forma controlada.

---

# 2. Arquitectura recomendada

No comenzar directamente con una arquitectura de microservicios excesivamente compleja.

La recomendación inicial es una:

> **Arquitectura distribuida/modular, preparada para evolucionar hacia microservicios.**

La separación principal sería:

```text
                    INTERNET
                       |
                 API GATEWAY
                       |
       +---------------+----------------+
       |               |                |
       v               v                v
 INVENTORY API    CUSTOMERS API     ONLINE API
    NestJS            NestJS           NestJS
       |               |                |
       v               v                v
 Inventory DB      Customer DB       Online DB
```

Frontend:

```text
PWA Inventario ------> Inventory API

Admin / CRM ---------> Customers API
                    -> Inventory API
                    -> Online API

Web/PWA Cliente -----> Online API
```

Auth:

```text
                  IDENTITY / AUTH
                       |
          +------------+------------+
          |            |            |
      Empleados      Admins      Clientes
```

La identidad debe ser centralizada.

---

# 3. Stack tecnológico

## Frontend

### Angular

Usar Angular + TypeScript como base para las aplicaciones web.

Aplicaciones:

- PWA de inventario.
- Panel administrativo/CRM.
- Web/PWA de clientes.

Ventaja: TypeScript puede utilizarse también en backend si se elige Node.js/NestJS.

### PWA

La aplicación de empleados debe ser una Progressive Web App.

Objetivos:

- Instalación en celulares/tablets.
- Funcionamiento parcial offline.
- Acceso a cámara.
- Escaneo de códigos.
- Caché de recursos.
- Sincronización posterior.
- Posibilidad de notificaciones push.

---

# 4. Backend

## Node.js + TypeScript + NestJS

La recomendación es utilizar:

- Node.js
- TypeScript
- NestJS

Evitar construir un backend empresarial grande únicamente con Express sin una estructura definida.

NestJS permite organizar los dominios y mantener límites claros.

Ejemplo:

```text
Inventory API
├── Products
├── Stock
├── Movements
├── Warehouses
├── Barcode
└── Audit

Customers API
├── Customers
├── Profiles
├── Memberships
├── History
└── CRM

Online API
├── Catalog
├── Cart
├── Orders
├── Payments
├── Reservations
└── Notifications
```

---

# 5. Base de datos

## PostgreSQL / Supabase

Supabase puede utilizarse principalmente como plataforma administrada alrededor de PostgreSQL.

Componentes posibles:

- PostgreSQL.
- Auth.
- Storage.
- Realtime.

Sin embargo, para la lógica de negocio crítica se recomienda:

```text
Frontend
    |
    v
API Gateway
    |
    v
NestJS
    |
    v
Supabase PostgreSQL
```

No hacer que las PWAs modifiquen directamente las tablas de negocio para operaciones críticas.

Ejemplo de movimiento de inventario:

```text
PWA
 |
 | POST /inventory/movements
 v
Inventory API
 |
 +--> validar JWT
 |
 +--> validar permisos
 |
 +--> validar producto
 |
 +--> validar stock
 |
 +--> ejecutar reglas de negocio
 |
 +--> registrar movimiento
 |
 +--> actualizar existencia
 |
 +--> registrar auditoría
 |
 v
PostgreSQL
```

---

# 6. ¿Una base de datos o varias?

Para un sistema grande, la arquitectura objetivo debería permitir:

```text
Inventory API  ---> Inventory DB

Customers API  ---> Customers DB

Online API     ---> Online DB
```

No permitir que todos los servicios conozcan y modifiquen libremente todas las tablas.

Si el MVP necesita simplificar infraestructura, se puede comenzar con una misma instancia PostgreSQL/Supabase y separar claramente el ownership de los módulos/esquemas.

Posteriormente se pueden separar físicamente las bases de datos sin cambiar el dominio completo.

---

# 7. Arquitectura interna de cada servicio

Usar:

> **Arquitectura modular + capas internas / Clean Architecture ligera.**

Ejemplo:

```text
Inventory
├── Domain
│   ├── Product
│   ├── Stock
│   ├── Movement
│   └── Warehouse
│
├── Application
│   ├── CreateMovement
│   ├── RegisterEntry
│   ├── RegisterExit
│   ├── TransferStock
│   └── CountInventory
│
├── Infrastructure
│   ├── Database
│   ├── Repositories
│   └── ExternalServices
│
└── API
    ├── Controllers
    ├── DTOs
    └── Endpoints
```

La idea es separar primero por **dominio de negocio**, no por carpetas globales de Controllers/Services/Repositories.

---

# 8. Inventario

El inventario debe estar basado en movimientos, no simplemente en un campo `stock`.

Tipos de movimiento:

```text
ENTRADA
SALIDA
TRASLADO
AJUSTE
CONTEO
PÉRDIDA
DEVOLUCIÓN
```

Cada movimiento debería permitir trazabilidad:

```text
Movimiento
├── producto
├── cantidad
├── tipo
├── usuario
├── sede
├── bodega
├── fecha
├── motivo
└── referencia
```

El sistema debe poder reconstruir por qué el stock cambió.

---

# 9. Productos y códigos

El sistema debe soportar códigos comerciales comunes:

- EAN-13
- EAN-8
- UPC
- Code 128
- QR
- Códigos internos propios

Flujo:

```text
Empleado
   |
   v
Abrir escáner
   |
   v
Cámara
   |
   v
Detectar código
   |
   v
Obtener valor
   |
   v
Inventory API
   |
   v
Buscar producto
   |
   v
Mostrar producto + stock
```

El código debe funcionar principalmente como identificador.

La información completa del producto debe permanecer en la base de datos.

---

# 10. PWA offline

La PWA debe utilizar:

## Service Worker

Responsabilidades:

- Cachear recursos.
- Permitir carga de la aplicación sin conexión.
- Gestionar determinadas solicitudes offline.
- Participar en estrategias de actualización/sincronización.
- Push notifications cuando aplique.

## IndexedDB

Usar IndexedDB como almacenamiento local para:

- Datos temporales.
- Productos consultados recientemente.
- Configuración necesaria.
- Operaciones pendientes.
- Cola de sincronización.

Ejemplo:

```text
Internet OFFLINE

Empleado
   |
   v
PWA
   |
   v
IndexedDB
   |
   v
Movimiento pendiente
```

Cuando vuelve Internet:

```text
Internet ONLINE
      |
      v
PWA
      |
      v
Cola de sincronización
      |
      v
POST /inventory/movements
      |
      v
Inventory API
      |
      v
PostgreSQL
```

La sincronización debe contemplar:

- Idempotencia.
- Reintentos.
- Conflictos.
- Duplicados.
- Orden de operaciones.
- Confirmación del servidor.

No confiar únicamente en `navigator.onLine`.

---

# 11. REST + HTTPS

REST será el mecanismo principal de comunicación entre frontend y backend.

Ejemplos:

```text
GET    /inventory/products
GET    /inventory/products/:id
POST   /inventory/movements
POST   /customers
GET    /customers/:id
POST   /orders
PUT    /customers/:id
```

Todo debe viajar por HTTPS.

Modelo:

```text
PWA
 |
 | HTTPS
 v
API Gateway
 |
 v
NestJS API
 |
 v
Database
```

---

# 12. WebSockets

WebSockets NO deben reemplazar REST.

Usarlos únicamente cuando se necesite comunicación en tiempo real.

REST:

> "Haz esta operación."

WebSocket:

> "Ocurrió este evento."

Casos útiles:

### Inventario

```text
Empleado A registra salida
       |
       v
Inventory API
       |
       v
StockUpdated
       |
       v
WebSocket
       |
       +----> Dashboard
       +----> Supervisor
       +----> Otros clientes autorizados
```

### POS

- Estado de cajas.
- Caja conectada/desconectada.
- Solicitud de supervisor.
- Alertas.

### Dashboard

- Ventas en tiempo real.
- Stock crítico.
- Métricas.

### Pedidos online

```text
Pedido recibido
      ↓
Preparando
      ↓
Listo
      ↓
Enviado
      ↓
Entregado
```

El cliente puede recibir estos cambios sin refrescar la página.

---

# 13. Autenticación y autorización

Usar un sistema centralizado de identidad.

Tecnologías posibles:

- OAuth 2.0
- OpenID Connect
- JWT

El JWT puede contener:

```json
{
  "sub": "123",
  "role": "inventory_employee",
  "scope": "inventory:read inventory:movement",
  "exp": 1787654321
}
```

---

# 14. API Gateway

El Gateway es la puerta de entrada pública.

Ejemplo:

```text
api.supermercado.com
```

Rutas:

```text
/inventory/*  -> Inventory API
/customers/*  -> Customers API
/online/*     -> Online API
/admin/*      -> Admin API
```

El Gateway puede:

- Validar JWT.
- Validar scopes/roles.
- Routing.
- Rate limiting.
- TLS.
- CORS.
- Balanceo.
- Políticas de seguridad.

Ejemplo conceptual:

```text
/inventory/**
    -> Inventory API
    -> requiere inventory:*

/customers/**
    -> Customers API
    -> requiere customers:*

/online/**
    -> Online API
    -> requiere online:*
```

Importante:

**El Gateway no debe ser la única capa de autorización.**

Cada API debe volver a validar:

- JWT.
- Usuario.
- Permisos.
- Reglas de negocio.
- Acceso al recurso.
- Sede/bodega cuando corresponda.

Ejemplo:

```text
Gateway:
"El usuario tiene permiso inventory:movement."

Inventory API:
"Sí, pero este empleado solo puede modificar la sede 3."
```

---

# 15. Comunicación entre servicios

Cuando una operación afecta a más de un dominio, evitar acoplar directamente todos los servicios.

Utilizar eventos/mensajería cuando tenga sentido.

Ejemplo:

```text
Online API
    |
    | OrderCreated
    v
Message Broker
    |
    +----> Inventory
    |
    +----> Customers
    |
    +----> Notifications
```

Tecnologías posibles:

- RabbitMQ.
- Azure Service Bus.
- Kafka si realmente se necesita un volumen/event streaming elevado.

Para comenzar, RabbitMQ es una opción razonable.

---

# 16. Redis

Redis puede utilizarse para:

- Caché.
- Datos temporales.
- Rate limiting.
- Sesiones si aplica.
- Locks distribuidos.
- Optimización de consultas frecuentes.

No utilizar Redis como sustituto de la base de datos principal.

Ejemplo:

```text
API
 |
 +--> Redis -> dato frecuente
 |
 +--> PostgreSQL -> dato persistente
```

---

# 17. Docker

Docker empaqueta las aplicaciones y sus dependencias.

Ejemplo:

```text
Docker
├── Inventory API
├── Customers API
├── Online API
├── Auth
├── Redis
└── Message Broker
```

Beneficios:

- Entornos reproducibles.
- Desarrollo local consistente.
- Despliegues más sencillos.
- Aislamiento de servicios.
- Facilita CI/CD.

---

# 18. CI/CD

CI/CD automatiza:

```text
Developer
   |
   v
Git Push
   |
   v
GitHub
   |
   v
Tests
   |
   v
Build
   |
   v
Docker Image
   |
   v
Deploy
   |
   v
Servidor
```

Herramientas posibles:

- GitHub Actions.
- GitLab CI/CD.
- Azure DevOps.

Pipeline mínimo:

1. Lint.
2. Tests.
3. Build.
4. Construcción de imagen Docker.
5. Security checks.
6. Deploy.
7. Health check.

---

# 19. Logs centralizados

Todos los servicios deben enviar logs a un sistema central.

```text
Inventory API ──┐
Customers API ──┤
Online API ─────┼──> Central Logs
Auth ───────────┘
```

Los logs deberían incluir:

- Timestamp.
- Servicio.
- Nivel.
- Request ID / Correlation ID.
- Usuario cuando corresponda.
- Endpoint.
- Resultado.
- Error.

No registrar:

- Contraseñas.
- Tokens completos.
- Datos sensibles innecesarios.
- Información de tarjetas.

Herramientas posibles:

- Grafana Loki.
- Elasticsearch.
- Datadog.
- Otros servicios de observabilidad.

---

# 20. Monitoring

Monitoring responde:

> "¿Cómo está funcionando el sistema?"

Métricas:

```text
CPU
RAM
Requests/sec
Latencia
Error rate
DB connections
Queue length
Cache hit rate
```

Alertas:

```text
API caída
Error rate alto
Latencia excesiva
Base de datos sin espacio
Cola creciendo
Servidor sin recursos
```

Una combinación posible:

- Prometheus.
- Grafana.
- OpenTelemetry.

---

# 21. Backups

La información crítica debe tener backups automatizados.

Datos importantes:

- Clientes.
- Productos.
- Inventario.
- Ventas.
- Pedidos.
- Movimientos.
- Auditoría.

Diseñar:

```text
Base de datos
     |
     +--> Backup diario
     +--> Backup periódico
     +--> Retención
     +--> Copia externa
```

No basta con crear backups.

Se debe probar periódicamente la restauración.

---

# 22. Seguridad

Principios mínimos:

- HTTPS obligatorio.
- JWT/OIDC.
- Roles y scopes.
- Principio de mínimo privilegio.
- Validación de entrada.
- Rate limiting.
- Auditoría.
- Secret management.
- CORS correctamente configurado.
- No exponer bases de datos públicamente.
- APIs internas protegidas.
- Rotación de secretos.
- Backups protegidos.

---

# 23. POS / cajas

Para un supermercado grande, POS debe considerarse un dominio crítico.

No debería depender completamente de:

```text
Internet -> API -> DB
```

porque una caída de Internet no puede detener las ventas.

Arquitectura conceptual:

```text
             POS
              |
        Local Database
              |
       +------+------+
       |             |
   Internet OK    Internet OFF
       |             |
       v             v
     API          Cola local
       |             |
       v             |
   Central DB <------+
```

El POS debe tener mecanismos de:

- Operación local.
- Cola de transacciones.
- Idempotencia.
- Sincronización.
- Resolución de conflictos.
- Auditoría.

---

# 24. Evolución de la arquitectura

## Etapa inicial / MVP

No construir una infraestructura gigantesca.

Objetivo:

```text
Angular/PWA
     |
API Gateway
     |
NestJS
     |
PostgreSQL/Supabase
```

Con:

- Docker.
- CI/CD.
- Backups.
- Logs.
- Monitoring básico.
- Auth.
- IndexedDB para offline.

## Etapa de crecimiento

Separar servicios cuando exista una razón real:

```text
              API Gateway
                   |
       +-----------+-----------+
       |           |           |
   Inventory    Customers    Online
    Service      Service     Service
       |           |           |
       DB          DB          DB
```

Agregar:

- Redis.
- RabbitMQ.
- Observabilidad avanzada.
- Escalado horizontal.
- Bases de datos independientes.

## Etapa de alta escala

Separar servicios críticos:

```text
Inventory
POS
Orders
Payments
Customers
Catalog
Notifications
```

y utilizar eventos para comunicación entre dominios.

---

# 25. Stack final recomendado

## Frontend

- Angular.
- TypeScript.
- PWA.
- Service Worker.
- IndexedDB.
- Librería de barcode/QR scanning.
- REST.
- WebSocket donde aporte valor.

## Backend

- Node.js.
- TypeScript.
- NestJS.
- REST API.
- WebSocket.
- OAuth 2.0 / OpenID Connect.
- JWT.

## Datos

- PostgreSQL.
- Supabase como plataforma administrada si conviene.
- Redis.
- IndexedDB para almacenamiento local de la PWA.

## Mensajería

- RabbitMQ inicialmente.
- Kafka solo si los requisitos de volumen/event streaming lo justifican.

## Infraestructura

- Docker.
- API Gateway.
- CI/CD.
- Monitoring.
- Logs centralizados.
- Backups.
- Secret management.

## Desarrollo

- Git.
- GitHub/GitLab.
- Tests unitarios.
- Tests de integración.
- Tests E2E.
- Linting.
- Formateo automático.

---

# 26. Principio arquitectónico principal

No diseñar la plataforma pensando solamente en tecnologías.

Primero definir los **dominios del supermercado**:

```text
Productos
Inventario
Compras
Proveedores
POS
Ventas
Clientes
Precios
Promociones
Pagos
Pedidos online
Sedes
Bodegas
Usuarios
Reportes
```

Después establecer qué servicio es dueño de cada dominio.

La regla fundamental debe ser:

> **Un dominio debe tener un propietario claro de sus datos y reglas de negocio.**

Esto permite comenzar de forma relativamente sencilla y evolucionar a microservicios cuando el tamaño y la carga del supermercado realmente lo justifiquen.
