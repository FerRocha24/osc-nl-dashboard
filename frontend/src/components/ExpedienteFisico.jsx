import { useState } from "react";
import { enviarJson } from "../api/client";
import { tieneRol } from "../api/auth";
import "./ExpedienteFisico.css";

/**
 * Dónde está el expediente en papel.
 *
 * Digitalizar no hace desaparecer el archivo físico: el acta original sigue en
 * una carpeta, en un archivero, en una oficina, y quien revisa necesita poder
 * ir por ella. Hasta ahora eso solo vivía en la memoria de quien la guardó.
 *
 * Texto libre a propósito. Cada oficina numera sus archiveros a su manera, y un
 * catálogo cerrado obligaría a inventar una nomenclatura que nadie usa: un
 * campo que no se puede llenar como uno habla se queda vacío.
 */
export default function ExpedienteFisico({ osc, onGuardado }) {
  const puedeEditar = tieneRol("admin", "revisor");
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(osc?.ubicacion_fisica ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const ubicacion = osc?.ubicacion_fisica;

  const abrir = () => {
    setValor(osc?.ubicacion_fisica ?? "");
    setError(null);
    setEditando(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await enviarJson("osc-ubicacion-fisica.php", {
        id: osc.id_osc,
        ubicacion: valor.trim(),
      });
      setEditando(false);
      onGuardado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="fisico">
      <h3>Expediente físico</h3>

      {!editando && (
        <>
          {ubicacion ? (
            <p className="fisico__ubicacion">{ubicacion}</p>
          ) : (
            <p className="fisico__vacio">
              Sin registrar dónde está el expediente en papel.
            </p>
          )}

          {puedeEditar && (
            <button type="button" className="fisico__editar" onClick={abrir}>
              {ubicacion ? "Cambiar ubicación" : "Registrar ubicación"}
            </button>
          )}
        </>
      )}

      {editando && (
        <form className="fisico__form" onSubmit={guardar}>
          <label htmlFor={`fisico-${osc.id_osc}`}>
            Dónde está el expediente en papel
          </label>
          <input
            id={`fisico-${osc.id_osc}`}
            type="text"
            maxLength={255}
            autoFocus
            // El ejemplo enseña el nivel de detalle que sirve —llegar hasta la
            // carpeta, no solo al cuarto— sin imponer un formato.
            placeholder="Archivero 3, gaveta B, carpeta 12"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <p className="fisico__ayuda">
            Escríbelo como lo dirías en la oficina. Déjalo vacío para borrarlo
            si el expediente se movió y ya no sabes dónde quedó: una referencia
            equivocada hace perder más tiempo que ninguna.
          </p>

          {error && <p className="fisico__error" role="alert">{error}</p>}

          <div className="fisico__acciones">
            <button type="button" onClick={() => setEditando(false)}>Cancelar</button>
            <button type="submit" className="fisico__guardar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
