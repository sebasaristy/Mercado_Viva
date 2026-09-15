import { z } from "zod";
import { ROLES, normalizarCedula } from "../dominio/reglas.js";

// Forma de lo que llega. Las reglas de fondo (qué tan buena es la contraseña)
// están en el dominio; aquí solo se exige que venga y con el tipo correcto.

const texto = (mensaje) => z.string({ required_error: mensaje, invalid_type_error: mensaje });

const cedula = texto("Escribe la cédula.")
  .transform(normalizarCedula)
  .pipe(z.string().regex(/^\d{5,12}$/, "La cédula tiene que tener entre 5 y 12 números."));

const nombre = texto("Escribe el nombre.")
  .trim()
  .min(2, "El nombre es muy corto.")
  .max(80, "El nombre es muy largo.");

const clave = texto("Escribe la contraseña.")
  .min(1, "Escribe la contraseña.")
  .max(128, "La contraseña es demasiado larga.");

const rol = z.enum(ROLES, {
  errorMap: () => ({ message: "Elige un rol: administrador, cajero o bodega." })
});

export const Ingreso = z.object({ cedula, clave });

export const PrimerAdministrador = z.object({
  codigo: texto("Escribe el código de instalación.").min(1, "Escribe el código de instalación."),
  nombre,
  cedula,
  clave
});

export const UsuarioNuevo = z.object({ nombre, cedula, rol, clave });

export const CambiosDeUsuario = z.object({
  nombre: nombre.optional(),
  rol: rol.optional(),
  activo: z.boolean({ invalid_type_error: "activo tiene que ser verdadero o falso." }).optional(),
  clave: clave.optional()
}).strict();

export const CambioDeClave = z.object({
  actual: texto("Escribe tu contraseña actual.").min(1, "Escribe tu contraseña actual."),
  nueva: texto("Escribe la nueva contraseña.")
});
