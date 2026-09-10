export default [
  {
    files: ["apps/api/src/modulos/**/*.js"],
    rules: {
      // Regla 1 de ARQUITECTURA.md: index.js es la única puerta de cada módulo.
      // Se permite "../inventario"; se bloquea "../inventario/repo.js".
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["../*/*", "../../modulos/*/*", "**/modulos/*/!(index).js"],
          message: "Importa el módulo por su index.js. Si lo necesitas y no está exportado ahí, exponlo en el index o replantea la dependencia."
        }]
      }]
    }
  },
  {
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }]
    }
  }
];
