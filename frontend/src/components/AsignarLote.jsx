import { useState } from "react";
import { enviarJson, useApi } from "../api/client";
import { cuentasAsignables } from "./asignables";
import "./AsignarLote.css";

/**
 * Asigna de golpe todas las organizaciones que cumplen el filtro actual.
 *
 * Existe porque repartir 779 expedientes de uno en uno son 779 clics. Pero es
 * una escritura masiva, así que primero pregunta al backend a cuántas
 * afectaría y muestra esa cifra: es lo que permite darse cuenta de que el
 * filtro estaba mal ANTES de reasignar medio padrón, no después.
 */
export default function AsignarLote({ filtros, onCerrar, onAsignado }) {
  const { datos } = useApi("usuarios.php", {}, { usuarios: [] });
  const cuentas = cuentasAsignables(datos?.usuarios);

  const [usuarioId, setUsuarioId] = useState("");
  const [conteo, setConteo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);

  const cuerpo = () => ({
    filtros,
    usuario_id: usuarioId === "" ? null : Number(usuarioId),
  });

  const contar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const r = await enviarJson("osc-asignar.php", cuerpo());
      setConteo(r.coincidencias);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const r = await enviarJson("osc-asignar.php", { ...cuerpo(), confirmar: true });
      setHecho(r.asignadas);
      onAsignado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const nombre = cuentas.find((u) => String(u.id_usuario) === usuarioId)?.nombre;

  return (
    <div className="lote__fondo" onClick={onCerrar}>
      <div
        className="lote"
        role="dialog"
        aria-modal="true"
        aria-label="Asignar por lote"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lote__encabezado">
          <h2>Asignar las organizaciones filtradas</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        {hecho !== null ? (
          <>
            <p className="lote__exito" role="status">
              Se asignaron {hecho.toLocaleString("es-MX")} organizaciones
              {nombre ? ` a ${nombre}` : ", quitándoles el responsable"}.
            </p>
            <div className="lote__acciones">
              <button type="button" className="lote__guardar" onClick={onCerrar}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            {cuentas.length === 0 ? (
              <p className="lote__aviso">
                No hay cuentas de administrador o revisor a las que asignar.
                Créalas primero en <strong>Usuarios del tablero</strong>.
              </p>
            ) : (
              <label className="lote__campo">
                <span>Asignar a</span>
                <select
                  value={usuarioId}
                  disabled={ocupado}
                  onChange={(e) => { setUsuarioId(e.target.value); setConteo(null); }}
                >
                  <option value="">Sin asignar (quitar responsable)</option>
                  {cuentas.map((u) => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nombre} · {u.rol === "admin" ? "Administrador" : "Revisor"}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p className="lote__nota">
              Se aplicará a <strong>todas</strong> las organizaciones que cumplen
              los filtros de la vista, no solo a la página que se ve.
            </p>

            {conteo !== null && (
              <p className="lote__conteo" role="status">
                Son <strong>{conteo.toLocaleString("es-MX")}</strong> organizaciones.
                {conteo > 0 && " Esto reemplaza al responsable que ya tuvieran."}
              </p>
            )}

            {error && <p className="lote__error" role="alert">{error}</p>}

            <div className="lote__acciones">
              <button type="button" onClick={onCerrar}>Cancelar</button>
              {conteo === null ? (
                <button type="button" className="lote__guardar" disabled={ocupado} onClick={contar}>
                  {ocupado ? "Contando…" : "Ver cuántas son"}
                </button>
              ) : (
                <button
                  type="button"
                  className="lote__guardar"
                  disabled={ocupado || conteo === 0}
                  onClick={confirmar}
                >
                  {ocupado ? "Asignando…" : `Asignar ${conteo.toLocaleString("es-MX")}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
