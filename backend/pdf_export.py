# Owner: S4 | Purpose: PDF generation — compiles questions and explanations into a formatted PDF

import io
import json
import logging
from typing import List, Dict, Any, Union
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

class NumberedCanvas(canvas.Canvas):
    """
    A canvas that enables dynamic page number rendering ('Page X of Y')
    by performing a two-pass layout sweep. It also draws consistent headers and footers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        
        # Color definitions matching our palette
        text_color = colors.HexColor("#475569") # Slate 600
        border_color = colors.HexColor("#cbd5e1") # Slate 300
        
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(text_color)
        
        # Draw Header (Only on page 2 and onwards, page 1 has the large title)
        if self._pageNumber > 1:
            self.drawString(54, 750, "STEM PRACTICE WORKSHEET")
            self.setStrokeColor(border_color)
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
        # Draw Footer (On all pages)
        self.setFont("Helvetica", 8)
        self.setFillColor(text_color)
        self.drawString(54, 40, "Generated offline via local LLM & OCR")
        
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_str)
        
        self.setStrokeColor(border_color)
        self.setLineWidth(0.5)
        self.line(54, 52, 558, 52)
        
        self.restoreState()


class PdfExporter:
    @staticmethod
    def generate_pdf_bytes(questions: List[Dict[str, Any]], subject: str = "STEM", difficulty: str = "Medium") -> bytes:
        """
        Renders a list of questions and answer keys into a PDF byte stream.
        """
        buffer = io.BytesIO()
        
        # 1. Setup Document Template (margin: 0.75 in / 54 pt)
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=72 # larger bottom margin to make space for footer
        )
        
        # 2. Styles Definition
        styles = getSampleStyleSheet()
        
        # Color Palette
        primary_color = colors.HexColor("#1e3a8a")  # Deep Navy Blue
        body_text_color = colors.HexColor("#0f172a") # Slate 900
        explanation_color = colors.HexColor("#1e293b") # Slate 800
        
        # Custom Typography
        title_style = ParagraphStyle(
            'WorksheetTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=primary_color,
            spaceAfter=15
        )
        
        section_heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=primary_color,
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        )
        
        meta_label_style = ParagraphStyle(
            'MetaLabel',
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#475569")
        )
        
        meta_val_style = ParagraphStyle(
            'MetaValue',
            fontName='Helvetica',
            fontSize=9,
            leading=11,
            textColor=body_text_color
        )
        
        question_text_style = ParagraphStyle(
            'QuestionText',
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=body_text_color,
            spaceAfter=8,
            keepWithNext=True
        )
        
        option_text_style = ParagraphStyle(
            'OptionText',
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=body_text_color
        )
        
        ans_text_style = ParagraphStyle(
            'AnswerText',
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#059669") # Green 600
        )
        
        exp_text_style = ParagraphStyle(
            'ExplanationText',
            fontName='Helvetica-Oblique',
            fontSize=9.5,
            leading=13,
            textColor=explanation_color
        )
        
        story = []
        
        # 3. Header Title Banner
        story.append(Paragraph("STEM Practice Worksheet", title_style))
        
        # 4. Student Metadata Block Table
        meta_data = [
            [
                Paragraph("Student Name: _______________________", meta_label_style),
                Paragraph(f"Date: _______________________", meta_label_style)
            ],
            [
                Paragraph(f"Subject: {subject.title()}", meta_val_style),
                Paragraph(f"Difficulty: {difficulty.title()}", meta_val_style)
            ]
        ]
        meta_table = Table(meta_data, colWidths=[250, 250])
        meta_table.setStyle(TableStyle([
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        
        story.append(meta_table)
        story.append(Spacer(1, 15))
        
        # Divider Line
        divider = Table([[""]], colWidths=[504])
        divider.setStyle(TableStyle([
            ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor("#1e3a8a")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(divider)
        story.append(Spacer(1, 15))
        
        # 5. Questions Rendering Section
        story.append(Paragraph("Practice Questions", section_heading_style))
        
        for idx, q in enumerate(questions):
            q_story = []
            
            # Question Body
            q_text = q.get("question_text", f"Question {idx+1}")
            q_story.append(Paragraph(f"{idx+1}. {q_text}", question_text_style))
            
            # Extract and Parse Options (if any)
            options = q.get("options_json")
            if isinstance(options, str) and options:
                try:
                    options = json.loads(options)
                except Exception:
                    options = None
            
            if options and isinstance(options, list):
                # Render choices in a clean 2x2 grid if exactly 4 choices, otherwise stack
                choices_story = []
                if len(options) == 4:
                    choices_data = [
                        [
                            Paragraph(f"<b>A)</b> {options[0]}", option_text_style),
                            Paragraph(f"<b>B)</b> {options[1]}", option_text_style)
                        ],
                        [
                            Paragraph(f"<b>C)</b> {options[2]}", option_text_style),
                            Paragraph(f"<b>D)</b> {options[3]}", option_text_style)
                        ]
                    ]
                    choices_table = Table(choices_data, colWidths=[252, 252])
                    choices_table.setStyle(TableStyle([
                        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                        ('TOPPADDING', (0,0), (-1,-1), 4),
                    ]))
                    q_story.append(choices_table)
                else:
                    # Stacking format
                    letters = ["A", "B", "C", "D", "E", "F"]
                    for o_idx, opt in enumerate(options):
                        letter_prefix = letters[o_idx] if o_idx < len(letters) else str(o_idx + 1)
                        q_story.append(Paragraph(f"<b>{letter_prefix})</b> {opt}", option_text_style))
                        q_story.append(Spacer(1, 3))
            else:
                # Free Response Question - Draw writing lines for the student
                lines_data = [[""], [""]]
                lines_table = Table(lines_data, colWidths=[504], rowHeights=[20, 20])
                lines_table.setStyle(TableStyle([
                    ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ]))
                q_story.append(Spacer(1, 5))
                q_story.append(lines_table)
            
            q_story.append(Spacer(1, 15))
            
            # Keep each question and its choices on the same page
            story.append(KeepTogether(q_story))

        # 6. Page Break for Answer Key
        story.append(PageBreak())
        
        # 7. Answer Key Rendering Section
        story.append(Paragraph("Answer Key & Explanations", section_heading_style))
        story.append(Spacer(1, 10))
        
        for idx, q in enumerate(questions):
            ans_story = []
            
            # Question Reference
            q_ref = q.get("question_text", "")
            if len(q_ref) > 80:
                q_ref = q_ref[:77] + "..."
            ans_story.append(Paragraph(f"<b>Question {idx+1}:</b> <i>{q_ref}</i>", option_text_style))
            
            # Answer Value
            correct_ans = q.get("correct_answer", "N/A")
            ans_story.append(Paragraph(f"<b>Correct Answer:</b> {correct_ans}", ans_text_style))
            
            # Explanation Value
            explanation = q.get("explanation")
            if explanation:
                ans_story.append(Paragraph(f"<b>Explanation:</b> {explanation}", exp_text_style))
                
            ans_story.append(Spacer(1, 12))
            
            story.append(KeepTogether(ans_story))
            
        # Build Document
        doc.build(story, canvasmaker=NumberedCanvas)
        
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data
