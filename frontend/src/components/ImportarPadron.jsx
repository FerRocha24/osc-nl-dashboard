import { useRef, useState } from "react";
import { subirArchivo } from "../api/client";
import "./ImportarPadron.css";

// Importación del padrón desde el CSV que la Secretaría usa en su operación.
//
// El flujo es de dos pasos a propósito: primero se analiza el archivo y se
// muestra qué va a pasar, y solo entonces se confirma. Importar 779
// organizaciones sin ver antes el resultado es el tipo de acción que nadie
// debería poder hacer de un clic.

const PASOS = { ELEGIR: "elegir", PREVIA: "previa", HECHO: "hecho" };

export default function ImportarPadron({ onCerrar, onImportado }) {
  const [paso, setPaso] = useState(PASOS.ELEGIR);
  const [archivo, setArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const inputArchivo = useRef(null);

  const analizar = async (elegido) => {
    if (!elegido) return;
    setArchivo(elegido);
    setError(null);
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.append("archivo", elegido);
      // Sin "confirmar": el backend solo analiza y reporta.
      const r = await subirArchivo("padron-importar.php", datos);
      setPrevia(r);
      setPaso(PASOS.PREVIA);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  };

  const confirmar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      datos.append("confirmar", "1");
      const r = await subirArchivo("padron-importar.php", datos);
      setResultado(r);
      setPaso(PASOS.HECHO);
      onImportado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const reiniciar = () => {
    setPaso(PASOS.ELEGIR);
    setArchivo(null);
    setPrevia(null);
    setResultado(null);
    setError(null);
  };

  return (
    <div className="importar__fondo" onClick={onCerrar}>
      <div
        className="importar"
        role="dialog"
        aria-modal="true"
        aria-label="Importar padrón"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="importar__encabezado">
          <h2>Importar padrón</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className="importar__cuerpo">
          {error && <p className="importar__error" role="alert">{error}</p>}

          {paso === PASOS.ELEGIR && (
            <>
              <p className="importar__intro">
                Sube el archivo CSV del padrón. El sistema lo va a revisar y te
                mostrará qué cambiaría <strong>antes</strong> de guardar nada.
              </p>
              <label className="importar__zona">
                <span className="importar__boton">
                  {ocupado ? "Analizando…" : "Elegir archivo CSV"}
                </span>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={ocupado}
                  onChange={(e) => analizar(e.target.files?.[0])}
                />
                <span className="importar__ayuda">Máximo 15 MB · hasta 5,000 organizaciones</span>
              </label>
              <p className="importar__nota">
                La importación <strong>actualiza, no reemplaza</strong>: las
                organizaciones que estén en el sistema pero no en el archivo se
                quedan como están. Ninguna se da de baja.
              </p>
            </>
          )}

          {paso === PASOS.PREVIA && previa && (
            <>
              <p className="importar__intro">
                Se revisó <strong>{archivo?.name}</strong>. Esto es lo que pasaría:
              </p>

              <div className="importar__cifras">
                <div className="importar__cifra importar__cifra--crear">
                  <b>{previa.se_crearian}</b>
                  <span>se crearían</span>
                </div>
                <div className="importar__cifra importar__cifra--actualizar">
                  <b>{previa.se_actualizarian}</b>
                  <span>se actualizarían</span>
                </div>
                <div className="importar__cifra">
                  <b>{previa.con_ubicacion}</b>
                  <span>con ubicación</span>
                </div>
                <div className="importar__cifra">
                  <b>{previa.documentos_marcados}</b>
                  <span>documentos</span>
                </div>
              </div>

              {previa.sin_identificador > 0 && (
                <p className="importar__aviso">
                  {previa.sin_identificador} fila(s) no traen
                  <code> ID_Organizacion</code>. Se crearán como organizaciones
                  nuevas, y si vuelves a subir el archivo se crearán otra vez.
                </p>
              )}

              {previa.muestra?.length > 0 && (
                <>
                  <h3>Primeras filas leídas</h3>
                  <div className="importar__tabla-envoltura">
                    <table className="importar__tabla">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Organización</th><th>Municipio</th>
                          <th>Rubro</th><th>Estatus</th><th>Docs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previa.muestra.map((m) => (
                          <tr key={m.linea}>
                            <td>{m.no_registro ?? "—"}</td>
                            <td>{m.razon_social}</td>
                            <td>{m.municipio ?? "—"}</td>
                            <td>{m.rubro_general ?? "—"}</td>
                            <td>{m.estatus ?? "—"}</td>
                            <td>{m.documentos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="importar__ayuda">
                    Revisa que las columnas se hayan leído en su lugar. Si algo
                    se ve movido, el archivo puede tener otro formato.
                  </p>
                </>
              )}

              {previa.advertencias?.length > 0 && (
                <>
                  <h3>
                    Advertencias
                    <span className="importar__conteo">{previa.advertencias.length}</span>
                  </h3>
                  <ul className="importar__advertencias">
                    {previa.advertencias.slice(0, 20).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  {previa.advertencias.length > 20 && (
                    <p className="importar__ayuda">
                      …y {previa.advertencias.length - 20} más.
                    </p>
                  )}
                  <p className="importar__ayuda">
                    Estas filas <strong>sí se importan</strong>; solo se deja
                    vacío el dato que no se pudo interpretar.
                  </p>
                </>
              )}

              {previa.columnas_ignoradas?.length > 0 && (
                <>
                  <h3>Columnas que el sistema no reconoce</h3>
                  <p className="importar__ayuda">
                    {previa.columnas_ignoradas.join(", ")}
                  </p>
                  <p className="importar__ayuda">
                    No impiden la importación, pero su contenido no se guarda.
                    Si son campos nuevos del padrón, hay que agregarlos al sistema.
                  </p>
                </>
              )}

              <div className="importar__acciones">
                <button type="button" className="importar__confirmar"
                  onClick={confirmar} disabled={ocupado}>
                  {ocupado ? "Importando…" : `Importar ${previa.filas_leidas} organizaciones`}
                </button>
                <button type="button" onClick={reiniciar} disabled={ocupado}>
                  Elegir otro archivo
                </button>
              </div>
            </>
          )}

          {paso === PASOS.HECHO && resultado && (
            <>
              <div className="importar__exito">
                <p className="importar__exito-titulo">Importación completada</p>
                <p>
                  Se crearon <strong>{resultado.creadas}</strong> organizaciones
                  y se actualizaron <strong>{resultado.actualizadas}</strong>.
                </p>
              </div>
              <div className="importar__acciones">
                <button type="button" className="importar__confirmar" onClick={onCerrar}>
                  Cerrar
                </button>
                <button type="button" onClick={reiniciar}>Importar otro archivo</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
