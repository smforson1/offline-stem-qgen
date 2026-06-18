# Owner: S2 | Purpose: Prompt compiler — constructs prompts based on subject, difficulty, and OCR text

import os
import logging

logger = logging.getLogger(__name__)

class PromptBuilder:
    def __init__(self, prompts_dir: str = None):
        if prompts_dir is None:
            # Default to prompts/ folder in the same folder as this file
            self.prompts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts")
        else:
            self.prompts_dir = prompts_dir

    def build_prompt(self, context_text: str, subject: str = "STEM", difficulty: str = "Medium", question_type: str = "mcq") -> str:
        """
        Loads the template file for the specified question_type and formats it with variables.
        
        Args:
            context_text: The OCR extracted text from the textbook page.
            subject: e.g., Physics, Chemistry, Biology.
            difficulty: e.g., Easy, Medium, Hard.
            question_type: 'mcq' or 'short_answer'.
            
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

        # Compile variables into the template
        compiled_prompt = template.format(
            subject=subject,
            difficulty=difficulty,
            context=context_text
        )

        return compiled_prompt
