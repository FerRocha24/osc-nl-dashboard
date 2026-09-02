"""
Genera los archivos .sql de importación a partir de los CSV reales del padrón.

Uso:
    python3 generate_imports.py --csv-dir /ruta/a/los/csv

Si no se pasa --csv-dir se usa la variable de entorno OSC_CSV_DIR, y si tampoco
existe, la carpeta de este script.

Entrada esperada:
  - organizaciones.csv   (padrón maestro, 779 filas)
  - apoyos.csv           (historial de inversión social, 598 filas)

Salida (en esta misma carpeta):
  - 01_import_municipios.sql
  - 02_import_osc.sql
  - 03_import_apoyos.sql

Dependencias: ninguna para los pasos 1 y 2 (solo biblioteca estándar).
El paso 3 necesita rapidfuzz para el emparejamiento aproximado de nombres:
    pip install rapidfuzz --break-system-packages
Si no está instalado, el paso 3 se omite y el .sql existente se deja intacto.
"""

import argparse
import csv
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def leer_csv(ruta):
    """Lee un CSV a una lista de diccionarios. utf-8-sig quita el BOM que
    Excel suele dejar al inicio del archivo."""
    with open(ruta, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def normalize_org_name(name):
    """Normaliza un nombre de OSC para comparación: mayúsculas, sin sufijos
    legales comunes (A.C., S.C., etc.) que inflan falsamente el score de
    similitud, y sin puntuación."""
    name = str(name).upper().strip()
    name = re.sub(r',?\s*(A\.?\s?C\.?|A\.?\s?B\.?\s?P\.?|S\.?\s?C\.?|I\.?\s?A\.?\s?P\.?)\s*$', '', name)
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def esc(value):
    """Escapa un valor para uso seguro dentro de una sentencia SQL."""
    if value is None:
        return "NULL"
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return "NULL"
    text = text.replace("\\", "\\\\").replace("'", "''")
    return f"'{text}'"


def esc_int(value):
    if value is None:
        return "NULL"
    try:
        return str(int(str(value).strip()))
    except (ValueError, TypeError):
        return "NULL"


def main():
    parser = argparse.ArgumentParser(description="Genera los .sql de importación.")
    parser.add_argument(
        "--csv-dir",
        default=os.environ.get("OSC_CSV_DIR", SCRIPT_DIR),
        help="Carpeta que contiene organizaciones.csv y apoyos.csv",
    )
    args = parser.parse_args()

    csv_dir = args.csv_dir
    ruta_org = os.path.join(csv_dir, "organizaciones.csv")
    if not os.path.isfile(ruta_org):
        sys.exit(f"No se encontró {ruta_org}\nUsa --csv-dir para indicar dónde están los CSV.")

    org = leer_csv(ruta_org)

    # =========================================================
    # 1. MUNICIPIOS
    # =========================================================
    municipios = sorted({(r["municipio"] or "").strip() for r in org if (r["municipio"] or "").strip()})

    with open(os.path.join(SCRIPT_DIR, "01_import_municipios.sql"), "w", encoding="utf-8") as f:
        f.write("-- Importación de municipios reales del padrón (INSERT IGNORE para no duplicar\n")
        f.write("-- los 9 municipios de ejemplo que ya sembró la migración 001)\n\n")
        for m in municipios:
            f.write(f"INSERT IGNORE INTO Municipio (nombre_municipio) VALUES ({esc(m)});\n")

    print(f"01_import_municipios.sql generado con {len(municipios)} municipios")

    # =========================================================
    # 2. OSC (padrón maestro)
    # =========================================================
    # `id` del CSV es el folio propio del Registro Estatal. Se guarda en
    # no_registro para poder rastrear cada OSC contra la fuente y detectar
    # altas y bajas cuando el socio formador mande una entrega nueva.
    with open(os.path.join(SCRIPT_DIR, "02_import_osc.sql"), "w", encoding="utf-8") as f:
        f.write("-- Importación del padrón maestro de OSC (organizaciones.csv)\n")
        f.write("-- Usa subquery para resolver id_municipio a partir del nombre.\n")
        f.write("-- no_registro guarda el folio original del padrón (columna `id` del CSV).\n\n")

        for row in org:
            municipio_nombre = (row.get("municipio") or "").strip()
            municipio_subquery = (
                "NULL" if not municipio_nombre
                else f"(SELECT id_municipio FROM Municipio WHERE nombre_municipio = {esc(municipio_nombre)} LIMIT 1)"
            )

            f.write(
                "INSERT INTO OSC "
                "(no_registro, razon_social, alias, rubro, id_municipio, direccion, telefono, "
                "correos, sitio_web, mision, actividad_principal, nombre_contacto, "
                "nombre_presidente) VALUES ("
                f"{esc(row.get('id'))}, {esc(row.get('nombre'))}, {esc(row.get('alias'))}, "
                f"{esc(row.get('rubro'))}, {municipio_subquery}, {esc(row.get('direccion'))}, "
                f"{esc(row.get('telefono'))}, {esc(row.get('correos'))}, {esc(row.get('sitio_web'))}, "
                f"{esc(row.get('mision'))}, {esc(row.get('actividad_principal'))}, "
                f"{esc(row.get('contacto'))}, {esc(row.get('presidente'))});\n"
            )

    print(f"02_import_osc.sql generado con {len(org)} organizaciones")

    # =========================================================
    # 3. APOYOS (con fuzzy matching contra el padrón maestro)
    # =========================================================
    ruta_apoyos = os.path.join(csv_dir, "apoyos.csv")
    if not os.path.isfile(ruta_apoyos):
        print(f"AVISO: no se encontró {ruta_apoyos}; se omite 03_import_apoyos.sql")
        return

    try:
        from rapidfuzz import process, fuzz
    except ImportError:
        print("AVISO: rapidfuzz no está instalado; se omite 03_import_apoyos.sql")
        print("       (el archivo existente se deja intacto)")
        print("       pip install rapidfuzz --break-system-packages")
        return

    apoyos = leer_csv(ruta_apoyos)

    master_names_raw = [r["nombre"] for r in org if (r.get("nombre") or "").strip()]
    master_names_norm = [normalize_org_name(n) for n in master_names_raw]
    norm_to_raw = dict(zip(master_names_norm, master_names_raw))

    MATCH_THRESHOLD = 90  # score mínimo (0-100) tras normalizar sufijos legales
    matched_count = unmatched_count = 0

    with open(os.path.join(SCRIPT_DIR, "03_import_apoyos.sql"), "w", encoding="utf-8") as f:
        f.write("-- Importación del historial de apoyos 2023-2024 (apoyos.csv)\n")
        f.write("-- Cada organización se empareja por nombre (fuzzy matching, ignorando\n")
        f.write("-- sufijos legales como A.C./S.C.) contra el padrón maestro ya importado.\n")
        f.write("-- Si no hay match >= 90, id_osc queda NULL y se conserva el nombre\n")
        f.write("-- original en nombre_organizacion_original para revisión manual.\n\n")

        for row in apoyos:
            nombre_original = str(row["organizacion"]).strip()
            match = process.extractOne(
                normalize_org_name(nombre_original), master_names_norm, scorer=fuzz.ratio
            )

            if match and match[1] >= MATCH_THRESHOLD:
                id_osc_subquery = (
                    f"(SELECT id_osc FROM OSC WHERE razon_social = {esc(norm_to_raw[match[0]])} LIMIT 1)"
                )
                matched_count += 1
            else:
                id_osc_subquery = "NULL"
                unmatched_count += 1

            f.write(
                "INSERT INTO Apoyos "
                "(id_osc, nombre_organizacion_original, anio, tipo_apoyo, linea_accion, "
                "poblacion, fin_proposito, alcance) VALUES ("
                f"{id_osc_subquery}, {esc(nombre_original)}, {esc_int(row.get('anio'))}, "
                f"{esc(row.get('tipo_apoyo'))}, {esc(row.get('linea_accion'))}, "
                f"{esc(row.get('poblacion'))}, {esc(row.get('fin_proposito'))}, "
                f"{esc(row.get('alcance'))});\n"
            )

    total = matched_count + unmatched_count
    print(f"03_import_apoyos.sql generado: {matched_count} emparejados, {unmatched_count} sin match")
    print(f"Tasa de emparejamiento: {matched_count / total * 100:.1f}%")


if __name__ == "__main__":
    main()
