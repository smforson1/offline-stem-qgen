# Owner: S2 | Purpose: llama.cpp wrapper — loads the local GGUF model and runs inference

import os
import logging
import re
import random
import json
from typing import Optional
import cloud_client

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
        self._grammar = None
        self.mock_mode = False
        
        # Check if the GGUF model file exists, if not, activate mock fallback mode
        if not os.path.exists(self.model_path):
            logger.warning(
                f"Local GGUF model file not found at: {self.model_path}. "
                "LlmEngine is entering MOCK FALLBACK mode for development."
            )
            self.mock_mode = True

    def _get_grammar(self, question_type: str = "mcq"):
        """Loads and caches the JSON schema as a LlamaGrammar tailored for question_type."""
        if not hasattr(self, "_grammars"):
            self._grammars = {}
        
        q_type_key = "mcq" if question_type.lower() in ("mcq", "multiple_choice", "multiple-choice") else "short_answer"
        if q_type_key in self._grammars:
            return self._grammars[q_type_key]

        try:
            from llama_cpp import LlamaGrammar
            if q_type_key == "mcq":
                schema = {
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "question_text": {"type": "string"},
                                    "options": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "minItems": 4,
                                        "maxItems": 4
                                    },
                                    "correct_answer": {"type": "string"},
                                    "explanation": {"type": "string"}
                                },
                                "required": ["question_text", "options", "correct_answer", "explanation"]
                            }
                        }
                    },
                    "required": ["questions"]
                }
            else:
                schema = {
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "question_text": {"type": "string"},
                                    "correct_answer": {"type": "string"},
                                    "explanation": {"type": "string"}
                                },
                                "required": ["question_text", "correct_answer", "explanation"]
                            }
                        }
                    },
                    "required": ["questions"]
                }
            self._grammars[q_type_key] = LlamaGrammar.from_json_schema(json.dumps(schema))
            logger.info(f"LlamaGrammar initialized for question_type={q_type_key}.")
            return self._grammars[q_type_key]
        except Exception as e:
            logger.warning(f"Could not initialize LlamaGrammar: {e}. Generating without grammar.")
            return None

    def _get_model(self):
        """Lazily loads the Llama model instance."""
        if self.mock_mode:
            return None
            
        if self._model is not None:
            return self._model
            
        logger.info(f"Loading local GGUF model from {self.model_path} on CPU...")
        try:
            from llama_cpp import Llama
            # Use 4-6 threads on modern multi-core CPUs for optimal throughput without thread contention
            n_threads = 4

            self._model = Llama(
                model_path=self.model_path,
                n_ctx=4096,     # Sized for Qwen/Llama context window
                n_threads=n_threads,
                n_batch=512,    # Process more tokens in parallel
                n_ubatch=512,
                verbose=False
            )
            logger.info(f"GGUF model loaded successfully with {n_threads} inference threads.")
        except Exception as e:
            logger.error(f"Failed to load Llama GGUF model: {str(e)}")
            logger.warning("Falling back to MOCK mode due to model load failure.")
            self.mock_mode = True
            
        return self._model

    def generate_response(self, prompt: str, num_questions: int = 3, question_type: str = "mcq", temperature_bump: float = 0.0) -> str:
        """
        Generates a text completion for the provided prompt.
        Attempts cloud API first if keys are configured, falling back to local GGUF.

        Args:
            prompt: The fully compiled prompt string.
            num_questions: Expected number of questions — used to size max_tokens.
            question_type: 'mcq' or 'short_answer'.
            temperature_bump: Added to base temperature (0.2) on retries.
        """
        # 1. Try Cloud Generation first (fail-safe fallback)
        if cloud_client.is_cloud_available():
            try:
                res = cloud_client.generate_cloud_response(prompt, question_type=question_type)
                if res and res.strip():
                    logger.info("Successfully generated response via Cloud API.")
                    return res
            except Exception as ce:
                logger.warning(f"Cloud generation failed: {ce}. Falling back to local/mock engine.")

        # 2. Local fallback / mock mode
        if self.mock_mode:
            logger.info("Generating dynamic mock STEM questions from context...")
            return self._generate_mock_questions(prompt, num_questions=num_questions)

        model = self._get_model()
        if self.mock_mode:
            return self._generate_mock_questions(prompt, num_questions=num_questions)

        max_tokens = 200 + (num_questions * 220)
        temperature = min(0.2 + temperature_bump, 0.8)
        grammar = self._get_grammar(question_type)

        try:
            logger.info(f"Running local GGUF inference (num_questions={num_questions}, max_tokens={max_tokens}, temp={temperature:.2f}, grammar={'enabled' if grammar else 'disabled'})...")
            gen_kwargs = {
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": 0.95,
                "stop": ["<|im_end|>", "<|im_start|>", "<|endoftext|>", "\n\n\n\n"],
            }
            if grammar is not None:
                gen_kwargs["grammar"] = grammar

            output = model(prompt, **gen_kwargs)
            response_text = output["choices"][0]["text"].strip()
            if not response_text:
                logger.warning("GGUF model returned empty response. Falling back to mock generator.")
                return self._generate_mock_questions(prompt, num_questions=num_questions)
            return response_text
        except Exception as e:
            logger.error(f"Error during GGUF model inference: {str(e)}")
            raise RuntimeError(f"LLM inference failed: {str(e)}") from e

    def generate_response_stream(self, prompt: str, num_questions: int = 3, question_type: str = "mcq", temperature_bump: float = 0.0):
        """
        Generator version of generate_response — yields raw text chunks.
        Attempts cloud streaming API first, falling back to local llama.cpp.
        """
        # 1. Try Cloud Streaming first
        if cloud_client.is_cloud_available():
            try:
                yielded_any = False
                for token in cloud_client.generate_cloud_stream(prompt, question_type=question_type):
                    if token:
                        yielded_any = True
                        yield token
                if yielded_any:
                    logger.info("Successfully streamed response via Cloud API.")
                    return
            except Exception as ce:
                logger.warning(f"Cloud streaming failed: {ce}. Falling back to local/mock engine.")

        # 2. Local fallback / mock mode
        if self.mock_mode:
            logger.info("Mock mode: yielding full mock response as single stream chunk...")
            yield self._generate_mock_questions(prompt, num_questions=num_questions)
            return

        model = self._get_model()
        if self.mock_mode:
            yield self._generate_mock_questions(prompt, num_questions=num_questions)
            return

        max_tokens = 200 + (num_questions * 220)
        temperature = min(0.2 + temperature_bump, 0.8)
        grammar = self._get_grammar(question_type)
        logger.info(f"Running streaming GGUF inference (num_questions={num_questions}, max_tokens={max_tokens}, temp={temperature:.2f})...")

        try:
            gen_kwargs = {
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": 0.95,
                "stop": ["<|im_end|>", "<|im_start|>", "<|endoftext|>", "\n\n\n\n"],
                "stream": True,
            }
            if grammar is not None:
                gen_kwargs["grammar"] = grammar

            stream = model(prompt, **gen_kwargs)
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
                
        return json.dumps({"questions": questions})
