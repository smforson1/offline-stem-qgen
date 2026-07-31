# Owner: S2 | Purpose: llama.cpp wrapper — loads the local GGUF model and runs inference

import os
import logging
import re
import random
import json
from typing import Optional

logger = logging.getLogger(__name__)

class LlmEngine:
    """
    A wrapper around llama-cpp-python to load a local GGUF model and run inference.
    Includes a fallback mock generator if the model path is missing or invalid.
    """
    def __init__(self, model_path: str = "data/models/model.gguf"):
        # Resolve path relative to backend root if it is relative
        if not os.path.isabs(model_path):
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            self.model_path = os.path.abspath(os.path.join(backend_dir, model_path))
        else:
            self.model_path = model_path
            
        self._model = None
        self.mock_mode = False
        
        # Check if the GGUF model file exists, if not, activate mock fallback mode
        if not os.path.exists(self.model_path):
            logger.warning(
                f"Local GGUF model file not found at: {self.model_path}. "
                "LlmEngine is entering MOCK FALLBACK mode for development."
            )
            self.mock_mode = True

    def _get_model(self):
        """Lazily loads the Llama model instance."""
        if self.mock_mode:
            return None
            
        if self._model is not None:
            return self._model
            
        logger.info(f"Loading local GGUF model from {self.model_path} on CPU...")
        try:
            from llama_cpp import Llama
            self._model = Llama(
                model_path=self.model_path,
                n_ctx=4096,     # Large enough for truncated input + 10 questions of output
                n_threads=8,    # Use 8 of the 10 available cores for inference
                n_batch=512,    # Process more tokens in parallel
                verbose=False
            )
            logger.info("GGUF model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Llama GGUF model: {str(e)}")
            logger.warning("Falling back to MOCK mode due to model load failure.")
            self.mock_mode = True
            
        return self._model

    def generate_response(self, prompt: str, num_questions: int = 3) -> str:
        """
        Generates a text completion for the provided prompt.

        Args:
            prompt: The fully compiled prompt string.
            num_questions: Expected number of questions — used to size max_tokens
                           so the output is never cut short mid-JSON.
        """
        if self.mock_mode:
            logger.info("Generating dynamic mock STEM questions from context...")
            return self._generate_mock_questions(prompt, num_questions=num_questions)

        model = self._get_model()
        if self.mock_mode: # check if model loading failed and flagged mock_mode
            return self._generate_mock_questions(prompt, num_questions=num_questions)

        # Each MCQ question is roughly 180 tokens of JSON; short-answer ~120.
        # Use 200 per question as a safe ceiling, with a 150-token base overhead.
        max_tokens = 150 + (num_questions * 200)

        try:
            logger.info(f"Running local GGUF inference (num_questions={num_questions}, max_tokens={max_tokens})...")
            output = model(
                prompt,
                max_tokens=max_tokens,
                temperature=0.2,      # low temp for structured correctness
                top_p=0.95,
                # Stop on Qwen's turn-end tokens and runaway whitespace.
                # Do NOT include ``` — validator handles markdown fences.
                stop=["<|im_end|>", "<|im_start|>", "\n\n\n\n"],
            )
            response_text = output["choices"][0]["text"].strip()
            if not response_text:
                logger.warning("GGUF model returned empty response. Falling back to mock generator.")
                return self._generate_mock_questions(prompt, num_questions=num_questions)
            return response_text
        except Exception as e:
            logger.error(f"Error during GGUF model inference: {str(e)}")
            raise RuntimeError(f"LLM inference failed: {str(e)}") from e

    def generate_response_stream(self, prompt: str, num_questions: int = 3):
        """
        Generator version of generate_response — yields raw text chunks as they
        are produced by llama.cpp so the caller can stream them to the client.
        Falls back to yielding the full mock response as a single chunk.
        """
        if self.mock_mode:
            logger.info("Mock mode: yielding full mock response as single stream chunk...")
            yield self._generate_mock_questions(prompt, num_questions=num_questions)
            return

        model = self._get_model()
        if self.mock_mode:
            yield self._generate_mock_questions(prompt, num_questions=num_questions)
            return

        max_tokens = 100 + (num_questions * 160)
        logger.info(f"Running streaming GGUF inference (num_questions={num_questions}, max_tokens={max_tokens})...")

        try:
            stream = model(
                prompt,
                max_tokens=max_tokens,
                temperature=0.2,
                top_p=0.95,
                # Stop on Qwen's turn-end tokens and runaway whitespace.
                # Do NOT include ``` here — if the model wraps JSON in a code
                # fence the validator's markdown-unwrap step handles it; stopping
                # on ``` would cut the output before the JSON even starts.
                stop=["<|im_end|>", "<|im_start|>", "\n\n\n\n"],
                stream=True,
            )
            for chunk in stream:
                token = chunk["choices"][0].get("text", "")
                if token:
                    yield token
        except Exception as e:
            logger.error(f"Error during streaming GGUF inference: {str(e)}")
            raise RuntimeError(f"LLM streaming inference failed: {str(e)}") from e

    def _generate_mock_questions(self, prompt: str, num_questions: int = 3) -> str:
        """
        Generates dynamic mock questions based on the terms found in the prompt context.
        Ensures strict JSON compatibility matching the output schemas.
        """
        # 1. Determine subject
        subject = "STEM"
        for sub in ("physics", "chemistry", "biology", "mathematics", "algebra"):
            if sub in prompt.lower():
                subject = sub.title()
                break

        # 2. Check question type
        is_mcq = "options" in prompt.lower()
        
        # 3. Extract textbook context
        context = ""
        context_idx = prompt.find("TEXTBOOK CONTEXT:")
        if context_idx != -1:
            context = prompt[context_idx + len("TEXTBOOK CONTEXT:"):].strip()
        else:
            context = prompt
            
        # Extract keywords from context
        words = re.findall(r'\b[a-zA-Z]{5,15}\b', context)
        # Filter common words
        common_stops = {
            "textbook", "context", "question", "questions", "generated", "options", "explain",
            "correct", "explanation", "subject", "difficulty", "understand", "theory", "process",
            "where", "there", "their", "about", "which", "would", "should", "could"
        }
        keywords = list(set([w.lower() for w in words if w.lower() not in common_stops]))
        
        if len(keywords) < 5:
            keywords = ["acceleration", "molecule", "reaction", "velocity", "photosynthesis", "gravity", "energy"]
            
        # Seed generator based on context string hash for stable outputs per page
        random.seed(abs(hash(context)) % 5000)
        
        questions = []
        for i in range(num_questions):
            term1 = keywords[i % len(keywords)]
            term2 = keywords[(i + 1) % len(keywords)]
            term3 = keywords[(i + 2) % len(keywords)]
            
            q_text = f"Regarding {subject} principles, how does the behavior of {term1} directly influence the rate of {term2}?"
            correct = f"It accelerates the process by aligning {term1} molecules to facilitate optimal {term2} bonding."
            explanation = f"According to {subject} theory, the density of {term1} directly scales with the occurrence of {term2} transitions, requiring less net {term3} input."
            
            if is_mcq:
                options = [
                    correct,
                    f"It blocks the pathways of {term1}, preventing any sustainable {term2} cycles.",
                    f"It forces a spontaneous decomposition of {term3} compounds independent of {term2}.",
                    f"It decreases overall {term3} levels without affecting either {term1} or {term2}."
                ]
                # Shuffle options so correct answer isn't always choice A
                random.shuffle(options)
                
                questions.append({
                    "question_text": q_text,
                    "options": options,
                    "correct_answer": correct,
                    "explanation": explanation
                })
            else:
                questions.append({
                    "question_text": q_text,
                    "correct_answer": correct,
                    "explanation": explanation
                })
                
        return json.dumps({"questions": questions}, indent=2)
