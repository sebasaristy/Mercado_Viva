# Cómo trabajamos

Somos 4. Nadie trabaja sobre `main`.

## Ramas

```
main                     lo que está desplegado. Protegida.
└── develop              donde se integra todo
    ├── feat/api-inventario         catálogo, libro de movimientos, migraciones
    ├── feat/api-disponibilidad     ATP, reservas, colchón, pedidos
    ├── feat/pwa-offline            Dexie, cola de salida, sync, pantalla de bodega
    └── feat/pwa-conteo-picking     pantallas de conteo y recolección
```

Las cuatro ramas de trabajo están partidas igual que los módulos de
[ARQUITECTURA.md](ARQUITECTURA.md), a propósito: cada persona toca carpetas distintas y
así los conflictos de merge casi no aparecen. Si dos ramas empiezan a chocar seguido en
los mismos archivos, el problema no es git — es que el límite entre módulos quedó mal.

Ramas nuevas: `feat/` para funcionalidad, `fix/` para arreglos, `docs/` para documentación.

## El ciclo

```bash
git switch develop
git pull
git switch -c feat/lo-que-sea

# ... trabajar ...

npm run lint && npm test
git add -A
git commit -m "inventario: rechaza decimales en productos por unidad"
git push -u origin feat/lo-que-sea
```

Después se abre el PR **hacia `develop`**, nunca hacia `main`.

Merges progresivos: no se guarda una rama tres semanas. Apenas algo funcione completo
—aunque sea chiquito— va a `develop`. Una rama vieja es una rama que va a doler.

## Reglas de los PR

- Hacia `develop`. A `main` solo llega `develop` cuando hay algo que mostrar.
- El CI tiene que pasar: `lint` y `test`. El lint incluye la regla de los módulos, así
  que si alguien importó `../inventario/repo.js` en vez de `../inventario`, se cae ahí.
- Lo revisa alguien más, no uno mismo. `CODEOWNERS` dice a quién le toca según la carpeta.
- PR chico. Si tiene más de ~400 líneas, casi seguro son dos PR.

## Commits

`modulo: qué cambió, en presente`

```
inventario: rechaza decimales en productos por unidad
pwa: la cola reintenta con espera creciente
db: agrega colchones y la vista v_disponible
docs: por qué el id lo genera el dispositivo
```

Nada de "cambios", "avance", "fix" a secas. En tres semanas nadie se acuerda.

## Configurar la protección de main

Se hace una sola vez, desde GitHub → Settings → Branches → Add rule sobre `main`:

- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass: `verificar`
- Do not allow bypassing the above settings

Lo mismo sobre `develop`, pero sin exigir aprobación si frena mucho al equipo.
