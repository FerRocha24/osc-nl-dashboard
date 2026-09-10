# -*- coding: utf-8 -*-
"""Arma el PDF del reporte a partir de contenido.py."""
import os, glob, sys
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, Image, KeepTogether,
                                PageBreak, HRFlowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from contenido import DOC, TITULO, SUBTITULO, SOCIO

NARANJA  = colors.HexColor("#C2650A")
OSCURO   = colors.HexColor("#262220")
SUAVE    = colors.HexColor("#6B6259")
BORDE    = colors.HexColor("#E5E1DA")
FONDO    = colors.HexColor("#FAF9F7")
AMBAR_BG = colors.HexColor("#FBF0DC")
AMBAR_TX = colors.HexColor("#8A5A02")

# Fuentes del sistema con soporte completo de acentos. Las incrustadas de
# ReportLab (Helvetica) usan Latin-1 y bastan para español, pero una TrueType
# real evita sorpresas con comillas tipográficas y guiones largos.
def registrar_fuentes():
    candidatos = [
        ("Cuerpo", "/System/Library/Fonts/Supplemental/Arial.ttf",
                   "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                   "/System/Library/Fonts/Supplemental/Arial Italic.ttf"),
    ]
    for nombre, reg, neg, ita in candidatos:
        if all(os.path.exists(p) for p in (reg, neg, ita)):
            pdfmetrics.registerFont(TTFont(nombre, reg))
            pdfmetrics.registerFont(TTFont(nombre + "-B", neg))
            pdfmetrics.registerFont(TTFont(nombre + "-I", ita))
            pdfmetrics.registerFontFamily(nombre, normal=nombre,
                                          bold=nombre + "-B", italic=nombre + "-I")
            return nombre
    return "Helvetica"

F = registrar_fuentes()
FB = F + "-B" if F != "Helvetica" else "Helvetica-Bold"
MONO = "Courier"

ss = getSampleStyleSheet()
E = {
 "titulo":  ParagraphStyle("titulo", fontName=FB, fontSize=26, leading=31,
                           textColor=OSCURO, alignment=TA_CENTER, spaceAfter=6),
 "subtit":  ParagraphStyle("subtit", fontName=F, fontSize=13.5, leading=18,
                           textColor=SUAVE, alignment=TA_CENTER, spaceAfter=26),
 "portada": ParagraphStyle("portada", fontName=F, fontSize=11, leading=17,
                           textColor=OSCURO, alignment=TA_CENTER),
 "h0":      ParagraphStyle("h0", fontName=FB, fontSize=17, leading=21,
                           textColor=NARANJA, spaceBefore=4, spaceAfter=10),
 "h1":      ParagraphStyle("h1", fontName=FB, fontSize=12.5, leading=16,
                           textColor=OSCURO, spaceBefore=15, spaceAfter=6),
 "h2":      ParagraphStyle("h2", fontName=FB, fontSize=10.8, leading=14,
                           textColor=SUAVE, spaceBefore=11, spaceAfter=4),
 "p":       ParagraphStyle("p", fontName=F, fontSize=10, leading=15.5,
                           textColor=OSCURO, alignment=TA_JUSTIFY, spaceAfter=8),
 "li":      ParagraphStyle("li", fontName=F, fontSize=10, leading=15,
                           textColor=OSCURO, alignment=TA_JUSTIFY,
                           leftIndent=13, bulletIndent=3, spaceAfter=5),
 "celda":   ParagraphStyle("celda", fontName=F, fontSize=8.7, leading=12,
                           textColor=OSCURO),
 "celdaEnc":ParagraphStyle("celdaEnc", fontName=FB, fontSize=8.7, leading=12,
                           textColor=colors.white),
 "code":    ParagraphStyle("code", fontName=MONO, fontSize=7.9, leading=11.2,
                           textColor=OSCURO),
 "nota":    ParagraphStyle("nota", fontName=F, fontSize=9.2, leading=14,
                           textColor=AMBAR_TX, alignment=TA_JUSTIFY),
 "pie":     ParagraphStyle("pie", fontName=F, fontSize=8.6, leading=12,
                           textColor=SUAVE, alignment=TA_CENTER, spaceBefore=4),
}

ANCHO_UTIL = LETTER[0] - 4.4 * cm

def escapar(t):
    """Escapa lo que XML de ReportLab interpretaría, dejando pasar las etiquetas
    de formato que sí usamos a propósito."""
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for etq in ("b", "i"):
        t = t.replace(f"&lt;{etq}&gt;", f"<{etq}>").replace(f"&lt;/{etq}&gt;", f"</{etq}>")
    return t

def tabla(encabezados, filas):
    datos = [[Paragraph(escapar(c), E["celdaEnc"]) for c in encabezados]]
    datos += [[Paragraph(escapar(c), E["celda"]) for c in f] for f in filas]
    n = len(encabezados)
    # La primera columna suele ser la etiqueta y necesita menos espacio.
    anchos = [ANCHO_UTIL * 0.26] + [ANCHO_UTIL * 0.74 / (n - 1)] * (n - 1) if n > 1 else [ANCHO_UTIL]
    t = Table(datos, colWidths=anchos, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NARANJA),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, FONDO]),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t

def bloque_codigo(codigo):
    lineas = [Paragraph(escapar(l).replace(" ", "&nbsp;") or "&nbsp;", E["code"])
              for l in codigo.split("\n")]
    t = Table([[l] for l in lineas], colWidths=[ANCHO_UTIL], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FONDO),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 1.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
    ]))
    return t

def bloque_nota(texto):
    t = Table([[Paragraph(escapar(texto), E["nota"])]], colWidths=[ANCHO_UTIL], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMBAR_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, colors.HexColor("#D98E04")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t

def capturas():
    """Cada PNG de capturas/ entra como una figura. El nombre del archivo, sin
    el número de orden, se usa como pie."""
    salida = []
    archivos = sorted(glob.glob(os.path.join(BASE, "capturas", "*.png")))
    if not archivos:
        return [bloque_nota(
            "Pendiente: colocar las capturas de pantalla en la carpeta "
            "entregables/capturas/ y volver a generar el documento.")]
    from PIL import Image as PILImage
    for ruta in archivos:
        pie = os.path.splitext(os.path.basename(ruta))[0]
        pie = pie.split("_", 1)[1].replace("-", " ") if "_" in pie else pie
        w, h = PILImage.open(ruta).size
        ancho = min(ANCHO_UTIL, 17 * cm)
        alto = ancho * h / w
        # Ninguna figura debe pasar de media página: si no, cada captura
        # empujaría su pie a la hoja siguiente.
        maximo = 11.5 * cm
        if alto > maximo:
            alto, ancho = maximo, maximo * w / h
        salida.append(KeepTogether([
            Spacer(1, 6),
            Image(ruta, width=ancho, height=alto, hAlign="CENTER"),
            Paragraph(escapar(pie[0].upper() + pie[1:]), E["pie"]),
            Spacer(1, 10),
        ]))
    return salida

def construir(destino):
    doc = BaseDocTemplate(destino, pagesize=LETTER,
                          leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                          topMargin=2.0 * cm, bottomMargin=2.0 * cm,
                          title=TITULO, author="Equipo 1")
    marco = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="cuerpo")

    def decorar(canvas, documento):
        canvas.saveState()
        if documento.page > 1:
            canvas.setFont(F, 8)
            canvas.setFillColor(SUAVE)
            canvas.drawString(doc.leftMargin, 1.3 * cm, TITULO)
            canvas.drawRightString(LETTER[0] - doc.rightMargin, 1.3 * cm, str(documento.page - 1))
            canvas.setStrokeColor(BORDE)
            canvas.setLineWidth(0.4)
            canvas.line(doc.leftMargin, 1.65 * cm, LETTER[0] - doc.rightMargin, 1.65 * cm)
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="normal", frames=[marco], onPage=decorar)])

    hist = []
    # ---- Portada ----
    hist += [Spacer(1, 5.5 * cm),
             Paragraph(escapar(TITULO), E["titulo"]),
             Paragraph(escapar(SUBTITULO), E["subtit"]),
             HRFlowable(width="42%", thickness=2, color=NARANJA, spaceAfter=22),
             Paragraph(escapar(SOCIO).replace("\n", "<br/>"), E["portada"]),
             Spacer(1, 2.2 * cm),
             Paragraph("Septiembre de 2026", E["portada"]),
             PageBreak()]

    # ---- Cuerpo ----
    for tipo, valor in DOC:
        if tipo == "h0":
            hist += [PageBreak() if hist and not isinstance(hist[-1], PageBreak) else Spacer(1, 0),
                     Paragraph(escapar(valor), E["h0"]),
                     HRFlowable(width="100%", thickness=1.6, color=NARANJA, spaceAfter=12)]
        elif tipo in ("h1", "h2"):
            hist.append(Paragraph(escapar(valor), E[tipo]))
        elif tipo == "p":
            hist.append(Paragraph(escapar(valor), E["p"]))
        elif tipo == "l":
            for item in valor:
                hist.append(Paragraph(escapar(item), E["li"], bulletText="•"))
            hist.append(Spacer(1, 5))
        elif tipo == "t":
            hist += [Spacer(1, 3), tabla(valor[0], valor[1]), Spacer(1, 11)]
        elif tipo == "code":
            hist += [Spacer(1, 3), bloque_codigo(valor), Spacer(1, 11)]
        elif tipo == "nota":
            hist += [Spacer(1, 3), bloque_nota(valor), Spacer(1, 11)]
        elif tipo == "capturas":
            hist += capturas()

    doc.build(hist)
    return destino

if __name__ == "__main__":
    salida = os.path.join(BASE, "Implementacion_Tablero_OSC_NL.pdf")
    construir(salida)
    print("generado:", salida, os.path.getsize(salida) // 1024, "KB")
