"""
export_docs.py
Run with: python export_docs.py
Reads DOCUMENTATION.md and produces DOCUMENTATION.docx in the same folder.
Requires: python-docx  (pip install python-docx)
"""

import re
import os
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "DOCUMENTATION.md")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "DOCUMENTATION.docx")

# ── Colour palette ────────────────────────────────────────────────────────────
PRIMARY      = RGBColor(0x43, 0x38, 0xCA)   # indigo
HEADING1_BG  = RGBColor(0x43, 0x38, 0xCA)
CODE_BG      = RGBColor(0xF3, 0xF4, 0xF6)
TABLE_HEADER = RGBColor(0x43, 0x38, 0xCA)
WHITE        = RGBColor(0xFF, 0xFF, 0xFF)
DARK         = RGBColor(0x1F, 0x29, 0x37)
MUTED        = RGBColor(0x6B, 0x72, 0x80)


# ── Helpers ───────────────────────────────────────────────────────────────────

def set_cell_bg(cell, rgb: RGBColor):
    """Fill a table cell with a solid background colour."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    hex_col = f"{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_col)
    tcPr.append(shd)


def set_para_border_left(para, color: RGBColor, width_eighths: int = 24):
    """Add a left border to a paragraph (used for code blocks)."""
    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    hex_col = f"{color[0]:02X}{color[1]:02X}{color[2]:02X}"
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), str(width_eighths))
    left.set(qn("w:space"), "4")
    left.set(qn("w:color"), hex_col)
    pBdr.append(left)
    pPr.append(pBdr)


def add_run_with_style(para, text: str, bold=False, italic=False,
                       font_size=11, color: RGBColor = None, font_name="Calibri"):
    run = para.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(font_size)
    run.font.name = font_name
    if color:
        run.font.color.rgb = color
    return run


def para_space(para, before=0, after=6):
    para.paragraph_format.space_before = Pt(before)
    para.paragraph_format.space_after  = Pt(after)


def render_inline(para, text: str, base_size=11):
    """
    Render a line of text with inline markdown:
    **bold**, `code`, and bare text.
    """
    # Split on **bold** and `code` markers
    parts = re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            add_run_with_style(para, part[2:-2], bold=True,
                               font_size=base_size, color=DARK)
        elif part.startswith("`") and part.endswith("`"):
            run = para.add_run(part[1:-1])
            run.font.name = "Courier New"
            run.font.size = Pt(base_size - 0.5)
            run.font.color.rgb = RGBColor(0xBE, 0x18, 0x5D)
        else:
            add_run_with_style(para, part, font_size=base_size, color=DARK)


# ── Title page ────────────────────────────────────────────────────────────────

def add_title_page(doc: Document):
    # App name
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para_space(p, before=60, after=4)
    run = p.add_run("ScanQ")
    run.bold = True
    run.font.size = Pt(36)
    run.font.color.rgb = PRIMARY
    run.font.name = "Calibri"

    # Subtitle
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para_space(p2, before=0, after=4)
    r2 = p2.add_run("Project Documentation")
    r2.font.size = Pt(18)
    r2.font.color.rgb = DARK
    r2.font.name = "Calibri"

    # Meta info
    for line in [
        "CS Department  |  2026 Batch  |  Group 6  |  Project 20",
        "Supervisor: Eric Opoku Osei",
    ]:
        p3 = doc.add_paragraph()
        p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para_space(p3, before=0, after=3)
        r3 = p3.add_run(line)
        r3.font.size = Pt(11)
        r3.font.color.rgb = MUTED
        r3.font.name = "Calibri"

    doc.add_page_break()


# ── Section heading renderers ─────────────────────────────────────────────────

def add_h1(doc: Document, text: str):
    """Big numbered section heading with an indigo accent bar."""
    p = doc.add_paragraph()
    para_space(p, before=18, after=6)
    # Accent bar via left border
    set_para_border_left(p, PRIMARY, width_eighths=36)
    p.paragraph_format.left_indent = Cm(0.4)
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(16)
    run.font.color.rgb = PRIMARY
    run.font.name = "Calibri"


def add_h2(doc: Document, text: str):
    p = doc.add_paragraph()
    para_space(p, before=12, after=4)
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(13)
    run.font.color.rgb = DARK
    run.font.name = "Calibri"


def add_h3(doc: Document, text: str):
    p = doc.add_paragraph()
    para_space(p, before=8, after=3)
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(11)
    run.font.color.rgb = PRIMARY
    run.font.name = "Calibri"


# ── Code block ────────────────────────────────────────────────────────────────

def add_code_block(doc: Document, lines: list[str]):
    """Render a fenced code block with monospace font and shaded background."""
    for line in lines:
        p = doc.add_paragraph()
        para_space(p, before=0, after=0)
        p.paragraph_format.left_indent  = Cm(0.5)
        p.paragraph_format.right_indent = Cm(0.5)
        # Light grey background via shading on the paragraph
        pPr = p._p.get_or_add_pPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), "F3F4F6")
        pPr.append(shd)
        run = p.add_run(line if line else " ")
        run.font.name = "Courier New"
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    # Small gap after block
    gap = doc.add_paragraph()
    para_space(gap, before=0, after=4)


# ── Table renderer ────────────────────────────────────────────────────────────

def add_markdown_table(doc: Document, header: list[str], rows: list[list[str]]):
    col_count = len(header)
    table = doc.add_table(rows=1 + len(rows), cols=col_count)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Header row
    hdr_row = table.rows[0]
    for i, cell_text in enumerate(header):
        cell = hdr_row.cells[i]
        set_cell_bg(cell, TABLE_HEADER)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run(cell_text)
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = WHITE
        run.font.name = "Calibri"

    # Data rows
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        for c_idx, cell_text in enumerate(row_data):
            cell = row.cells[c_idx]
            if r_idx % 2 == 1:
                set_cell_bg(cell, RGBColor(0xF9, 0xFA, 0xFB))
            p = cell.paragraphs[0]
            render_inline(p, cell_text, base_size=10)

    doc.add_paragraph()  # spacing after table


# ── Markdown parser / renderer ────────────────────────────────────────────────

def parse_table(lines: list[str]):
    """Extract header and rows from a markdown table block."""
    header = []
    rows   = []
    for i, line in enumerate(lines):
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if i == 0:
            header = cells
        elif re.match(r'^[\s\-|:]+$', line):
            continue   # separator row
        else:
            rows.append(cells)
    return header, rows


def render_md(doc: Document, md_text: str):
    lines = md_text.splitlines()
    i = 0
    skip_toc = False   # skip the ToC block (links not useful in docx)

    while i < len(lines):
        line = lines[i]

        # ── Skip YAML / horizontal rules ──────────────────────────────────
        if line.strip() in ("---", "***", "___"):
            i += 1
            continue

        # ── Skip the table-of-contents block ──────────────────────────────
        if line.strip() == "## Table of Contents":
            skip_toc = True
            i += 1
            continue
        if skip_toc:
            if line.startswith("## ") or (line.strip() == "" and
               i + 1 < len(lines) and lines[i+1].startswith("## ")):
                skip_toc = False
                # Don't skip this line — fall through to heading handler
            else:
                i += 1
                continue

        # ── Headings ──────────────────────────────────────────────────────
        if line.startswith("# ") and not line.startswith("## "):
            # Top-level H1 — used only for the document title in the md
            # We already have a title page, so skip it
            i += 1
            continue

        if line.startswith("## "):
            add_h1(doc, line[3:].strip())
            i += 1
            continue

        if line.startswith("### "):
            add_h2(doc, line[4:].strip())
            i += 1
            continue

        if line.startswith("#### "):
            add_h3(doc, line[5:].strip())
            i += 1
            continue

        # ── Fenced code block ─────────────────────────────────────────────
        if line.strip().startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            add_code_block(doc, code_lines)
            i += 1  # consume closing ```
            continue

        # ── Markdown table ────────────────────────────────────────────────
        if line.strip().startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            header, rows = parse_table(table_lines)
            if header and rows:
                add_markdown_table(doc, header, rows)
            continue

        # ── Bullet / list item ────────────────────────────────────────────
        if re.match(r'^(\s*[-*+]|\s*\d+\.) ', line):
            # Strip leading marker
            content = re.sub(r'^\s*[-*+]\s+', '', line)
            content = re.sub(r'^\s*\d+\.\s+', '', content)
            p = doc.add_paragraph(style="List Bullet")
            para_space(p, before=0, after=2)
            p.paragraph_format.left_indent = Cm(0.6)
            render_inline(p, content)
            i += 1
            continue

        # ── Blank line ────────────────────────────────────────────────────
        if line.strip() == "":
            i += 1
            continue

        # ── Normal paragraph ──────────────────────────────────────────────
        p = doc.add_paragraph()
        para_space(p, before=0, after=5)
        render_inline(p, line.strip())
        i += 1


# ── Page margins ─────────────────────────────────────────────────────────────

def set_margins(doc: Document, top=2.0, bottom=2.0, left=2.5, right=2.5):
    for section in doc.sections:
        section.top_margin    = Cm(top)
        section.bottom_margin = Cm(bottom)
        section.left_margin   = Cm(left)
        section.right_margin  = Cm(right)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: {INPUT_FILE} not found.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = Document()
    set_margins(doc)

    # Default body font
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    style.font.color.rgb = DARK

    add_title_page(doc)
    render_md(doc, md_text)

    doc.save(OUTPUT_FILE)
    print(f"Done! Saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
