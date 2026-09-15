import { create } from "zustand";

// Instalar la app en el celular.
//
// Android (Chrome) avisa que se puede instalar con el evento beforeinstallprompt,
// y con él se abre el diálogo nativo desde un botón propio. El evento llega una
// sola vez y muy temprano, por eso se escucha al arrancar y se guarda.
//
// iPhone no tiene ese evento: Apple solo deja instalar desde el menú Compartir
// de Safari. Ahí lo único que se puede hacer es mostrar los pasos.

export const esInstalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

export const usarInstalacion = create(() => ({
  evento: null,
  instalada: esInstalada()
}));

export function escucharInstalacion() {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    usarInstalacion.setState({ evento: e });
  });
  addEventListener("appinstalled", () => {
    usarInstalacion.setState({ evento: null, instalada: true });
  });
}

export async function pedirInstalacion() {
  const { evento } = usarInstalacion.getState();
  if (!evento) return false;
  evento.prompt();
  const { outcome } = await evento.userChoice;
  usarInstalacion.setState({ evento: null });
  return outcome === "accepted";
}

export function detectarEquipo() {
  const ua = navigator.userAgent;
  // El iPad con iPadOS se presenta como Mac; se le reconoce por la pantalla táctil.
  const esIos = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (esIos) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "computador";
}

// En iPhone, Chrome, Firefox y Edge se identifican con su propia marca.
export const esSafari = () => !/crios|fxios|edgios|opios|gsa\//i.test(navigator.userAgent);
