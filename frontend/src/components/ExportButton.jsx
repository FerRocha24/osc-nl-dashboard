import { useState, useRef, useEffect } from "react";
import "./ExportButton.css";

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="export-btn" ref={ref}>
      <button className="export-btn__trigger" onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Exportar reporte
      </button>

      {open && (
        <div className="export-btn__menu">
          <button className="export-btn__item">
            <span className="export-btn__icon export-btn__icon--pdf">PDF</span>
            Exportar como PDF
          </button>
          <button className="export-btn__item">
            <span className="export-btn__icon export-btn__icon--xls">XLS</span>
            Exportar como Excel
          </button>
        </div>
      )}
    </div>
  );
}
