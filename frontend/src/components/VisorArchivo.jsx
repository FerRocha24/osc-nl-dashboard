import { useEffect } from "react";
import "./VisorArchivo.css";

// Visor de documentos. Los PDF se muestran en un <iframe> con el visor nativo
// del navegador; las imágenes con un <img>.
//
// La URL siempre es un blob: local creado con los bytes que ya se descargaron
// autenticados. Nunca se apunta el iframe al endpoint directo, porque esa
// petición iría sin la cabecera Authorization y devolvería 401.

export default function VisorArchivo({ url, mime, nombre, onCerrar }) {
  useEffect(() => {
    const alPresionar = (e) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  const esImagen = mime?.startsWith("image/");

  return (
    <div className="visor__fondo" onClick={onCerrar}>
      <div
        className="visor"
        role="dialog"
        aria-modal="true"
        aria-label={`Documento: ${nombre}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="visor__encabezado">
          <p className="visor__nombre">{nombre}</p>
          <div className="visor__acciones">
            {/* download permite guardarlo con su nombre original en vez del
                identificador aleatorio con el que vive en el servidor. */}
            <a href={url} download={nombre} className="visor__descargar">Descargar</a>
            <button type="button" onClick={onCerrar} aria-label="Cerrar documento">✕</button>
          </div>
        </header>

        <div className="visor__cuerpo">
          {esImagen ? (
            <img src={url} alt={nombre} className="visor__imagen" />
          ) : (
            <iframe src={url} title={nombre} className="visor__iframe" />
          )}
        </div>
      </div>
    </div>
  );
}
