# Owner: S2 | Purpose: Prompt compiler — constructs prompts based on subject, difficulty, and OCR text

import os
import logging

logger = logging.getLogger(__name__)

# Maximum words of OCR context to feed into the LLM.
# Kept at 350 words (~470 tokens) to leave enough context budget for
# up to 10 questions of JSON output within the 4096 token window.
_MAX_CONTEXT_WORDS = 350


def _truncate_context(text: str, max_words: int = _MAX_CONTEXT_WORDS) -> str:
    """Truncate OCR text to at most max_words words to keep prompt size small."""
    words = text.split()
    if len(words) <= max_words:
        return text
    truncated = " ".join(words[:max_words])
    logger.info(
        f"OCR context truncated from {len(words)} to {max_words} words "
        "to speed up LLM inference."
    )
    return truncated

class PromptBuilder:
    def __init__(self, prompts_dir: str = None):
        if prompts_dir is None:
            # Default to prompts/ folder in the same folder as this file
            self.prompts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts")
        else:
            self.prompts_dir = prompts_dir

    def build_prompt(self, context_text: str, subject: str = "STEM", difficulty: str = "Medium", question_type: str = "mcq", num_questions: int = 3) -> str:
        """
        Loads the template file for the specified question_type and formats it with variables.
        
        Args:
            context_text: The OCR extracted text from the textbook page.
            subject: e.g., Physics, Chemistry, Biology.
            difficulty: e.g., Easy, Medium, Hard.
            question_type: 'mcq' or 'short_answer'.
            num_questions: How many questions to ask the model to generate.
            
        Returns:
            The fully compiled prompt string.
        """
        q_type_normalized = question_type.lower()
        if q_type_normalized in ("mcq", "multiple_choice", "multiple-choice"):
            template_file = "mcq_template.txt"
        elif q_type_normalized in ("short_answer", "free_response", "frq", "short-answer"):
            template_file = "short_answer_template.txt"
        else:
            raise ValueError(f"Unsupported question_type: {question_type}. Supported types are 'mcq' or 'short_answer'.")

        template_path = os.path.join(self.prompts_dir, template_file)
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Prompt template file not found at: {template_path}")

        try:
            with open(template_path, "r", encoding="utf-8") as f:
                template = f.read()
        except Exception as e:
            logger.error(f"Failed to read prompt template: {str(e)}")
            raise RuntimeError(f"Failed to read prompt template at {template_path}: {str(e)}") from e

        # Truncate OCR text before building the prompt to keep token count low
        context_text = _truncate_context(context_text)

        # Compile variables into the template
        compiled_prompt = template.format(
            subject=subject,
            difficulty=difficulty,
            context=context_text,
            num_questions=num_questions
        )

        return compiled_prompt
