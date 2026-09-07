import { useEffect, useId, useRef, useState } from "react";
import "./NotaInfo.css";

/**
 * Signo de admiración que despliega una nota al pasar el ratón o al enfocarlo
 * con el teclado.
 *
 * Es para contexto que ayuda a interpretar lo que se ve pero que no hace falta
 * leer siempre: puesto como párrafo fijo, se vuelve ruido y se deja de leer a
 * la tercera vez.
 */
export default function NotaInfo({ children, etiqueta = "Más información" }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  const ref = useRef(null);

  useEffect(() => {
    if (!abierta) return;
    const alPresionar = (e) => {
      if (e.key === "Escape") setAbierta(false);
    };
    const clicFuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierta(false);
    };
    document.addEventListener("keydown", alPresionar);
    document.addEventListener("mousedown", clicFuera);
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.removeEventListener("mousedown", clicFuera);
    };
  }, [abierta]);

  return (
    <span
      className="nota"
      ref={ref}
      // El ratón la abre sin obligar a hacer clic; el teclado usa foco y clic.
      onMouseEnter={() => setAbierta(true)}
      onMouseLeave={() => setAbierta(false)}
    >
      <button
        type="button"
        className="nota__boton"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-describedby={abierta ? id : undefined}
        onClick={() => setAbierta((v) => !v)}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
      >
        !
      </button>
      {abierta && (
        <span className="nota__globo" id={id} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
