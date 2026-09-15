"""
generate_report.py
Run with: python generate_report.py
Produces ScanQ_Project_Report.docx in the project root.
Requires: python-docx  (pip install python-docx)
"""

import os
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "ScanQ_Project_Report.docx")

# ── Colours ───────────────────────────────────────────────────────────────────
PRIMARY = RGBColor(0x43, 0x38, 0xCA)
DARK    = RGBColor(0x11, 0x18, 0x27)
MUTED   = RGBColor(0x6B, 0x72, 0x80)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT   = RGBColor(0xF3, 0xF4, 0xF6)
TH_BG   = RGBColor(0x43, 0x38, 0xCA)


# ── Low-level helpers ─────────────────────────────────────────────────────────

def set_cell_bg(cell, rgb: RGBColor):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  f"{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}")
    tcPr.append(shd)


def cell_para(cell, text, bold=False, size=10, color=DARK,
              align=WD_ALIGN_PARAGRAPH.LEFT, font="Calibri"):
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after  = Pt(2)
    run = p.add_run(text)
    run.bold           = bold
    run.font.size      = Pt(size)
    run.font.color.rgb = color
    run.font.name      = font


def set_margins(doc, top=2.2, bottom=2.2, left=2.5, right=2.5):
    for sec in doc.sections:
        sec.top_margin    = Cm(top)
        sec.bottom_margin = Cm(bottom)
        sec.left_margin   = Cm(left)
        sec.right_margin  = Cm(right)


def para(doc, text="", bold=False, italic=False, size=11,
         color=DARK, align=WD_ALIGN_PARAGRAPH.LEFT,
         space_before=0, space_after=6, font="Calibri"):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    if text:
        run = p.add_run(text)
        run.bold           = bold
        run.italic         = italic
        run.font.size      = Pt(size)
        run.font.color.rgb = color
        run.font.name      = font
    return p


def heading(doc, text, level=1):
    sizes  = {1: 16, 2: 13, 3: 11}
    before = {1: 14, 2: 10, 3:  7}
    after  = {1:  6, 2:  4, 3:  3}
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(before[level])
    p.paragraph_format.space_after  = Pt(after[level])
    if level == 1:
        # Accent left border
        pPr  = p._p.get_or_add_pPr()
        pBdr = OxmlElement("w:pBdr")
        left = OxmlElement("w:left")
        left.set(qn("w:val"),   "single")
        left.set(qn("w:sz"),    "36")
        left.set(qn("w:space"), "8")
        left.set(qn("w:color"), "4338CA")
        pBdr.append(left)
        pPr.append(pBdr)
        p.paragraph_format.left_indent = Cm(0.3)
    run = p.add_run(text)
    run.bold           = True
    run.font.size      = Pt(sizes[level])
    run.font.color.rgb = PRIMARY if level in (1, 3) else DARK
    run.font.name      = "Calibri"
    return p


def bullet(doc, text, size=11, indent=0.5):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_before  = Pt(0)
    p.paragraph_format.space_after   = Pt(3)
    p.paragraph_format.left_indent   = Cm(indent)
    run = p.add_run(text)
    run.font.size      = Pt(size)
    run.font.color.rgb = DARK
    run.font.name      = "Calibri"


def divider(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after  = Pt(2)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bot  = OxmlElement("w:bottom")
    bot.set(qn("w:val"),   "single")
    bot.set(qn("w:sz"),    "4")
    bot.set(qn("w:space"), "1")
    bot.set(qn("w:color"), "E5E7EB")
    pBdr.append(bot)
    pPr.append(pBdr)


def styled_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style     = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Header
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        set_cell_bg(cell, TH_BG)
        cell_para(cell, h, bold=True, size=10, color=WHITE)

    # Rows
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            cell = table.rows[r_i + 1].cells[c_i]
            if r_i % 2 == 1:
                set_cell_bg(cell, LIGHT)
            cell_para(cell, val, size=10)

    # Column widths
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


# ── Title page ────────────────────────────────────────────────────────────────

def title_page(doc):
    para(doc, space_before=40, space_after=0)   # top padding

    # App name
    p = para(doc, "ScanQ", bold=True, size=38,
             color=PRIMARY, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_before=0, space_after=4)

    para(doc, "Offline STEM Question Generator", bold=False, size=14,
         color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)

    para(doc, "Project Report", bold=True, size=16,
         color=DARK, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=28)

    divider(doc)

    # Meta table
    table = doc.add_table(rows=6, cols=2)
    table.style = "Table Grid"
    meta = [
        ("Department",        "Computer Science"),
        ("Batch",             "2026"),
        ("Group",             "6  |  Project 20"),
        ("Supervisor",        "Eric Opoku Osei"),
        ("Project Title",     "Offline STEM Question Generator from Textbook Photos "
                              "Using PaddleOCR and a Quantised Language Model"),
        ("GitHub Repository", "https://github.com/smforson1/offline-stem-qgen"),
    ]
    for i, (k, v) in enumerate(meta):
        row = table.rows[i]
        set_cell_bg(row.cells[0], LIGHT)
        cell_para(row.cells[0], k, bold=True,  size=10, color=PRIMARY)
        cell_para(row.cells[1], v, bold=False, size=10, color=DARK)
        row.cells[0].width = Inches(1.6)
        row.cells[1].width = Inches(4.4)

    para(doc, space_after=20)
    divider(doc)

    # Members
    para(doc, "Group Members", bold=True, size=12,
         color=PRIMARY, align=WD_ALIGN_PARAGRAPH.CENTER,
         space_before=14, space_after=8)

    members = [
        ("S1", "9021023", "GODWYLL, Joel Yoofi",       "OCR Engineer"),
        ("S2", "9021223", "GYABAAH, Linus Kwasi",      "LLM Engineer"),
        ("S3", "9021123", "GOTAH, Benjamin",            "Mobile Developer"),
        ("S4", "9021323", "GYAMFI, Helis Kisiwaa",     "Backend / Database"),
        ("S5", "9019223", "Forson Samuel Mintah",       "PM & Pilot Coordinator"),
    ]
    styled_table(doc,
                 ["Role", "Index No.", "Full Name", "Responsibility"],
                 members,
                 col_widths=[0.5, 0.9, 2.1, 2.5])

    doc.add_page_break()


# ── Page 1 — Introduction & System Overview ───────────────────────────────────

def page_one(doc):
    heading(doc, "1. Introduction", 1)
    para(doc,
         "ScanQ is an offline-first STEM question generation system designed for Ghanaian "
         "Junior High School (JHS) and Senior High School (SHS) teachers. The core premise "
         "of the project is that AI-assisted question generation should be accessible in "
         "schools where internet connectivity is unreliable or entirely absent — a condition "
         "that characterises the majority of public secondary schools in Ghana.",
         size=11, space_after=6)
    para(doc,
         "Teachers in these institutions spend an estimated three to six hours per week "
         "manually composing exam and practice questions. ScanQ addresses this burden by "
         "allowing a teacher to photograph or upload any textbook page and receive a set of "
         "custom practice questions — multiple choice or short answer — in under fifteen "
         "seconds, with no internet dependency after the system is set up.",
         size=11, space_after=6)
    para(doc,
         "The system is named ScanQ, a portmanteau of 'Scan' (the OCR-based input method) "
         "and 'Q' (questions). It is built as a client-server application: a React Native "
         "mobile app runs on the teacher's Android phone, and a Python Flask backend runs "
         "on a laptop connected to the same local Wi-Fi network.",
         size=11, space_after=10)

    heading(doc, "2. System Architecture", 1)
    para(doc,
         "ScanQ follows a two-tier local architecture. The mobile client communicates with "
         "the backend server exclusively over a local Wi-Fi network — no request ever leaves "
         "the local network during normal operation.",
         size=11, space_after=6)

    heading(doc, "2.1  Mobile Client (Android)", 2)
    para(doc,
         "The frontend is a React Native application built with Expo SDK 57. It provides "
         "seven screens covering the full teacher workflow:",
         size=11, space_after=4)
    for s in [
        "Onboarding — first-launch introduction, shown once.",
        "Home Dashboard — session statistics, quick actions, and backend connectivity status.",
        "Capture Screen — camera viewfinder (react-native-vision-camera) and gallery upload "
        "(expo-image-picker), with a pre-flight quiz configuration sheet that opens automatically.",
        "Question Screen — one question at a time with MCQ option cards or short-answer reveal.",
        "Results Screen — score report, per-question review, PDF export, and regeneration.",
        "History Screen — all past sessions from local SQLite, with delete and re-review.",
        "Settings Screen — backend URL configuration.",
    ]:
        bullet(doc, s)
    para(doc,
         "State management uses Zustand. Local persistence uses expo-sqlite, maintained by "
         "three repositories: sessionRepository, questionRepository, and ocrCacheRepository.",
         size=11, space_before=4, space_after=10)

    heading(doc, "2.2  Backend Server (Flask)", 2)
    para(doc,
         "The backend is a Python Flask application exposing five REST endpoints. It runs "
         "on the teacher's laptop and is reachable by the phone over LAN.",
         size=11, space_after=6)

    styled_table(doc,
        ["Endpoint", "Method", "Purpose"],
        [
            ("/health",           "GET",  "Connectivity check — used by the home screen banner"),
            ("/ocr",              "POST", "Accepts an image, returns extracted text via PaddleOCR"),
            ("/generate",         "POST", "Generates questions from OCR text, returns full JSON response"),
            ("/generate/stream",  "POST", "Same as /generate but streams questions via Server-Sent Events"),
            ("/export",           "POST", "Generates and returns a formatted PDF worksheet"),
        ],
        col_widths=[1.6, 0.7, 3.7])

    doc.add_page_break()


# ── Page 2 — Components, Pipeline & Evaluation ───────────────────────────────

def page_two(doc):
    heading(doc, "3. Core Components", 1)

    heading(doc, "3.1  OCR Engine  (ocr_engine.py)", 2)
    para(doc,
         "Text extraction is handled by PaddleOCR, a deep-learning OCR framework that "
         "performs well on degraded, low-contrast, and slightly angled document photographs "
         "— conditions common in Ghanaian classroom settings. Images are processed entirely "
         "in memory with no temporary files written to disk. A pre-resize step caps the "
         "longest image dimension at 1200 px before inference, reducing processing time "
         "without meaningful loss of OCR accuracy. Results are cached in memory by MD5 hash "
         "so repeated uploads of the same image skip the OCR pipeline.",
         size=11, space_after=8)

    heading(doc, "3.2  Prompt Engineering  (prompt_builder.py)", 2)
    para(doc,
         "Two prompt templates are maintained — one for multiple-choice questions and one "
         "for short-answer questions. Both use the ChatML instruction format compatible with "
         "the Qwen model family. The OCR context is truncated to a maximum of 350 words "
         "before insertion to keep the total prompt within the 4096-token context window "
         "while leaving sufficient budget for the full JSON output. Key constraints enforced "
         "in every prompt include: JSON-only output with no markdown or preamble, questions "
         "ending with a question mark, exactly four plausible MCQ options, and the correct "
         "answer matching one option character-for-character.",
         size=11, space_after=8)

    heading(doc, "3.3  LLM Engine  (llm_engine.py)", 2)
    para(doc,
         "Question generation is performed locally by the Qwen2.5-0.5B-Instruct model in "
         "4-bit GGUF quantisation (Q4_K_M), loaded via llama-cpp-python. The model has "
         "0.5 billion parameters and a file size of approximately 400 MB, enabling it to "
         "run entirely in RAM on a standard laptop CPU with no GPU requirement. Inference "
         "is grammar-constrained using LlamaGrammar to enforce strict JSON output and "
         "eliminate the need for post-hoc parsing of malformed responses. Generation "
         "typically completes in 5 to 15 seconds for a set of five questions.",
         size=11, space_after=8)

    heading(doc, "3.4  Output Validator  (validator.py)", 2)
    para(doc,
         "The validator handles three failure modes common in real LLM output: markdown "
         "code fences (stripped before parsing), trailing garbage text (handled by "
         "json.JSONDecoder.raw_decode which stops at the first complete JSON object), and "
         "option mismatches (resolved by case-insensitive whitespace-normalised comparison "
         "with substring fallback). For MCQ questions, options are padded to four if the "
         "model returns fewer, and trimmed to four if it returns more.",
         size=11, space_after=8)

    heading(doc, "3.5  PDF Export  (pdf_export.py)", 2)
    para(doc,
         "PDF worksheets are generated server-side using ReportLab. Each export includes "
         "a formatted header with subject and difficulty, numbered questions with options "
         "or answer lines, and an answer key on the final page. The binary PDF is returned "
         "directly from the /export endpoint and shared via the Android native share sheet.",
         size=11, space_after=10)

    heading(doc, "4. End-to-End Generation Pipeline", 1)
    para(doc,
         "The full pipeline from image upload to completed quiz follows these steps:",
         size=11, space_after=4)
    steps = [
        "The quiz configuration sheet opens automatically when the Capture Screen is visited, "
        "prompting the teacher to set subject, difficulty, format, and question count.",
        "The teacher uploads a textbook page image from the gallery or captures one with the camera.",
        "The app sends the image to POST /ocr. PaddleOCR extracts the text and returns it.",
        "The app sends the text to POST /generate/stream with the selected parameters.",
        "The backend builds the prompt, runs Qwen2.5-0.5B inference, and streams tokens back "
        "via Server-Sent Events. The UI updates a progress counter as each question arrives.",
        "On stream completion, the validator parses and normalises the JSON. The session and "
        "questions are saved to the backend SQLite database.",
        "The app receives the done event, saves the session locally, and navigates to the "
        "Question Screen.",
        "The teacher answers all questions. Answers are recorded in local SQLite.",
        "The Results Screen shows the score, tier label, and a detailed per-question review. "
        "The teacher can export a PDF worksheet or regenerate new questions from the same text.",
    ]
    for i, s in enumerate(steps, 1):
        bullet(doc, f"{i}.  {s}")

    doc.add_page_break()


# ── Page 3 — Tech Stack, Results & Conclusion ────────────────────────────────

def page_three(doc):
    heading(doc, "5. Technology Stack", 1)

    heading(doc, "5.1  Frontend", 2)
    styled_table(doc,
        ["Library / Tool", "Version", "Purpose"],
        [
            ("React Native + Expo",         "SDK 57",    "Cross-platform Android application framework"),
            ("TypeScript",                  "5.x",       "Statically typed JavaScript"),
            ("React Navigation",            "7.x",       "Stack and bottom-tab navigation"),
            ("Zustand",                     "5.x",       "Lightweight global state management"),
            ("expo-sqlite",                 "SDK 57",    "Local SQLite database for session history"),
            ("react-native-vision-camera",  "4.x",       "Native camera capture"),
            ("expo-image-picker",           "SDK 57",    "Gallery image selection"),
            ("lucide-react-native",         "latest",    "Icon set"),
            ("Poppins (Google Fonts)",      "—",         "Application typeface"),
        ],
        col_widths=[2.0, 0.9, 3.1])

    heading(doc, "5.2  Backend", 2)
    styled_table(doc,
        ["Library / Tool", "Version", "Purpose"],
        [
            ("Flask",              "3.0.3",     "REST API server"),
            ("PaddleOCR",         "2.7.0.3",   "Offline OCR text extraction from images"),
            ("llama-cpp-python",  "latest",    "CPU inference engine for GGUF models"),
            ("Qwen2.5-0.5B GGUF", "Q4_K_M",   "Local language model for question generation"),
            ("ReportLab",         "4.2.0",     "Server-side PDF worksheet generation"),
            ("SQLite",            "3.45",      "Embedded database for sessions and questions"),
            ("Pillow",            "10.3.0",    "Image format handling and pre-resize"),
        ],
        col_widths=[2.0, 0.9, 3.1])

    heading(doc, "6. Project Outcomes", 1)
    para(doc,
         "The following outcomes were achieved over the course of the project:",
         size=11, space_after=4)
    outcomes = [
        "A fully functional Android application built in React Native with Expo, covering "
        "the complete teacher workflow from image capture to PDF export.",
        "A Flask backend with five REST endpoints, PaddleOCR text extraction, local GGUF "
        "inference, JSON validation, and ReportLab PDF generation.",
        "End-to-end question generation latency of 5 to 15 seconds for five questions on "
        "a standard laptop CPU, meeting the sub-15-second target.",
        "An offline-first architecture: the full pipeline from OCR through question "
        "generation to PDF export requires no internet connection after initial setup.",
        "Support for two question formats — multiple choice (4 options) and short answer — "
        "across four STEM subjects at three configurable difficulty levels.",
        "Local session history with score tracking, per-question review, and PDF export "
        "persisted in SQLite on both the device and the server.",
        "A project onboarding website deployed at a public URL for presentation purposes.",
        "Full project documentation and a structured Word report.",
    ]
    for o in outcomes:
        bullet(doc, o)

    para(doc, space_after=8)
    heading(doc, "7. Conclusion", 1)
    para(doc,
         "ScanQ demonstrates that a fully offline, AI-powered question generation system "
         "is practically deployable for Ghanaian secondary school teachers using commodity "
         "hardware. By combining PaddleOCR for text extraction with a quantised 0.5-billion "
         "parameter language model for generation, the system achieves response times and "
         "question quality that are appropriate for real classroom use, without any "
         "dependency on cloud infrastructure or internet connectivity.",
         size=11, space_after=6)
    para(doc,
         "The architecture — a React Native mobile client communicating with a local Flask "
         "server over LAN — is straightforward, maintainable, and extensible. Future work "
         "could include support for additional question types such as fill-in-the-blank and "
         "true/false, multi-language OCR for Ghanaian language textbooks, on-device "
         "inference to eliminate the laptop server requirement, and a formal teacher pilot "
         "study with statistical evaluation of question quality.",
         size=11, space_after=6)
    para(doc,
         "The complete source code is publicly available at: "
         "https://github.com/smforson1/offline-stem-qgen",
         size=11, bold=False, color=PRIMARY, space_after=10)

    heading(doc, "8. Project Deliverables", 1)
    para(doc,
         "The following additional deliverables accompany this report:",
         size=11, space_after=4)

    deliverables = [
        "Onboarding Website — A public-facing presentation website for the project is "
        "live at: https://onboarding-website-theta.vercel.app  —  It showcases the app's "
        "features, how it works, the technology stack, phone mockups of all screens, and "
        "the full team.",

        "Video Presentation — A recorded video walkthrough of the application is included "
        "in the video_presentation/ folder in the project repository. The file demonstrates "
        "the complete end-to-end pipeline: launching the app, uploading a textbook page, "
        "question generation, answering, scoring, and PDF export.",

        "App Screenshots — Screenshots of all application screens are included in the "
        "screenshots/ folder in the project repository. These cover the Onboarding, Home "
        "Dashboard, Capture, Quiz Configuration, Question, Results, History, and Settings "
        "screens.",

        "Project Documentation — Full technical documentation is available as "
        "DOCUMENTATION.docx and docs/DOCUMENTATION.md in the repository root, covering "
        "system architecture, all API endpoints, component descriptions, database schema, "
        "and setup instructions.",
    ]
    for d in deliverables:
        bullet(doc, d)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    doc = Document()
    set_margins(doc)

    # Default body style
    normal = doc.styles["Normal"]
    normal.font.name      = "Calibri"
    normal.font.size      = Pt(11)
    normal.font.color.rgb = DARK

    title_page(doc)
    page_one(doc)
    page_two(doc)
    page_three(doc)

    doc.save(OUTPUT_FILE)
    print(f"Done! Saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
