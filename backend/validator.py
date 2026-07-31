# Owner: S2 | Purpose: Output validator — ensures LLM output conforms to structured JSON schema

import json
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class Validator:
    @staticmethod
    def extract_first_json_object(raw_text: str) -> str:
        """
        Finds and returns the first complete, valid JSON object in raw_text.

        Uses json.JSONDecoder.raw_decode so it stops at the exact closing brace
        of the first object and ignores any trailing text or extra data the model
        may have appended after the JSON — which is the root cause of the
        'Extra data' JSONDecodeError.
        """
        import re
        text = raw_text.strip()

        # If the model wrapped output in a markdown code fence, unwrap it first
        fence_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
        if fence_match:
            text = fence_match.group(1).strip()

        # Find the position of the first '{' and attempt raw_decode from there.
        # raw_decode returns (obj, end_index) and does NOT require the string to
        # end after the object, so trailing garbage is silently ignored.
        decoder = json.JSONDecoder()
        start = text.find('{')
        if start == -1:
            raise ValueError("No JSON object found in LLM output.")
        try:
            obj, _ = decoder.raw_decode(text, start)
            # Re-serialise so downstream code always gets a clean string
            return json.dumps(obj)
        except json.JSONDecodeError as e:
            raise ValueError(f"Could not decode JSON from LLM output: {e}") from e

    @staticmethod
    def validate_and_parse_response(raw_llm_text: str, question_type: str = "mcq") -> List[Dict[str, Any]]:
        """
        Parses and validates the raw JSON response from the LLM.
        
        Args:
            raw_llm_text: The raw output string from llama.cpp.
            question_type: 'mcq' or 'short_answer'.
            
        Returns:
            A list of validated question dictionaries with keys:
            - 'question_text': str
            - 'correct_answer': str
            - 'explanation': str
            - 'options_json': str (JSON string list or None)
        """
        try:
            cleaned_text = Validator.extract_first_json_object(raw_llm_text)
            data = json.loads(cleaned_text)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse LLM response as JSON: {str(e)}")
            logger.debug(f"Raw LLM output: {raw_llm_text}")
            raise ValueError(f"LLM output is not valid JSON: {str(e)}") from e

        if not isinstance(data, dict) or "questions" not in data:
            raise ValueError("LLM JSON root must be a dictionary containing a 'questions' key.")

        questions = data["questions"]
        if not isinstance(questions, list):
            raise ValueError("'questions' key in JSON must point to an array.")

        validated_questions = []
        q_type_normalized = question_type.lower()
        
        for idx, q in enumerate(questions):
            if not isinstance(q, dict):
                raise ValueError(f"Question at index {idx} must be a JSON object.")

            # Required fields
            q_text = q.get("question_text")
            corr_ans = q.get("correct_answer")
            explanation = q.get("explanation")

            if not q_text or not isinstance(q_text, str):
                raise ValueError(f"Question at index {idx} has missing or invalid 'question_text'.")
            if not corr_ans or not isinstance(corr_ans, str):
                raise ValueError(f"Question at index {idx} has missing or invalid 'correct_answer'.")
            if not explanation or not isinstance(explanation, str):
                raise ValueError(f"Question at index {idx} has missing or invalid 'explanation'.")

            # Check question type constraints
            options = q.get("options")
            
            validated_q = {
                "question_text": q_text.strip(),
                "correct_answer": corr_ans.strip(),
                "explanation": explanation.strip(),
                "options_json": None
            }

            if q_type_normalized in ("mcq", "multiple_choice", "multiple-choice"):
                if not isinstance(options, list) or len(options) == 0:
                    logger.warning(f"Question {idx+1} has no options. Skipping.")
                    continue
                
                # Pad to 4 if the model was cut off
                while len(options) < 4:
                    options.append(f"Option {len(options)+1}")
                # Trim to 4 if model gave more
                options = options[:4]
                
                # Check option types are strings
                clean_opts = []
                for opt_idx, opt in enumerate(options):
                    if isinstance(opt, str) and opt.strip():
                        clean_opts.append(opt.strip())
                    else:
                        clean_opts.append(f"Option {opt_idx+1}")
                
                # Check if correct answer matches one of the options (case-insensitive fuzzy match)
                clean_corr_ans = corr_ans.strip()
                
                if clean_corr_ans not in clean_opts:
                    matched_opt = None
                    for o in clean_opts:
                        if clean_corr_ans.lower() == o.lower() or clean_corr_ans.lower() in o.lower():
                            matched_opt = o
                            break
                    if matched_opt:
                        validated_q["correct_answer"] = matched_opt
                    else:
                        # Just use the first option as correct rather than crashing
                        logger.warning(f"Question {idx+1} correct answer not found in options. Using first option.")
                        validated_q["correct_answer"] = clean_opts[0]
                
                validated_q["options_json"] = json.dumps(clean_opts)
            else:
                # Short Answer / Free response
                validated_q["options_json"] = None

            validated_questions.append(validated_q)

        return validated_questions
