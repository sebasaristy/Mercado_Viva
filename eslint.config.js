const opcionesJs = {
  ecmaVersion: 2023,
  sourceType: "module",
  parserOptions: { ecmaFeatures: { jsx: true } },
  globals: {
    // navegador
    window: "readonly", document: "readonly", navigator: "readonly",
    fetch: "readonly", crypto: "readonly", localStorage: "readonly",
    addEventListener: "readonly", setInterval: "readonly", setTimeout: "readonly",
    Response: "readonly", Request: "readonly",
    // node
    process: "readonly", console: "readonly", Buffer: "readonly"
  }
};

import react from "eslint-plugin-react";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/dev-dist/**"]
  },

  {
    files: ["**/*.jsx"],
    languageOptions: opcionesJs,
    plugins: { react },
    rules: {
      // Sin esto, ESLint cree que los imports usados solo dentro del JSX sobran.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error"
    }
  },

  {
    files: ["**/*.js", "**/*.jsx"],
    languageOptions: opcionesJs,
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none"
      }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error"
    }
  },

  {
    // Regla 1 de ARQUITECTURA.md: index.js es la única puerta de cada módulo.
    // Se permite "../inventario"; se bloquea "../inventario/repo.js".
    files: ["apps/api/src/modulos/**/*.js"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          // Se listan los módulos a mano a propósito: cuando se agregue uno nuevo,
          // se agregan sus dos líneas aquí. plataforma/ no aparece porque es
          // infraestructura compartida, no un módulo de dominio.
          group: [
            "../catalogo/*",       "!../catalogo/index.js",
            "../inventario/*",     "!../inventario/index.js",
            "../disponibilidad/*", "!../disponibilidad/index.js",
            "../conteo/*",         "!../conteo/index.js",
            "../pedidos/*",        "!../pedidos/index.js"
          ],
          message:
            "Importa el módulo por su index.js. Si necesitas algo que no está exportado ahí, " +
            "exponlo en el index o replantea la dependencia."
        }]
      }]
    }
  },

  {
    // El log del servidor sí escribe a stdout: para eso existe.
    files: ["apps/api/src/plataforma/log.js", "db/migrar.js"],
    rules: { "no-console": "off" }
  }
];
