import { crearApp } from "./app.js";
import { log } from "./plataforma/log.js";

const puerto = process.env.PORT || 3000;

crearApp().listen(puerto, () => {
  log.info({ puerto }, "api arriba");
});
