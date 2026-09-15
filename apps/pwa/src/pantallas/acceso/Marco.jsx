import { Link } from "react-router-dom";

// El marco de las pantallas sin sesión: una columna angosta, la marca arriba
// y el formulario. Nada más compite con lo único que hay que hacer.
export function Marco({ titulo, descripcion, children, pie }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <span className="text-[17px] font-semibold tracking-tight">Mercado Viva</span>
        </div>

        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{titulo}</h1>
          {descripcion && <p className="mt-1.5 text-[15px] text-tenue">{descripcion}</p>}
        </div>

        <div className="rounded-pieza border border-borde bg-panel p-4 sm:p-5">{children}</div>

        {pie}
      </div>

      <p className="mx-auto w-full max-w-sm text-sm text-tenue">
        <Link to="/instalar" className="inline-flex min-h-11 items-center font-semibold text-tinta underline decoration-borde-fuerte underline-offset-4 hover:decoration-tinta">
          Instalar la app en este celular
        </Link>
      </p>
    </div>
  );
}
