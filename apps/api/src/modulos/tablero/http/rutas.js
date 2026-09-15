import { Router } from "express";

export function crearRutas(tablero) {
  const rutas = Router();

  rutas.get("/resumen", async (req, res, siguiente) => {
    try {
      res.json(await tablero.verResumen(req.usuario.tenantId));
    } catch (e) {
      siguiente(e);
    }
  });

  return rutas;
}
