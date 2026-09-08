# Owner: S2 | Purpose: Cloud API helper — handles high-speed cloud generation with fallback capabilities

import re
import json
import logging
import requests
from typing import Optional, Generator, Tuple
from config import Config

logger = logging.getLogger(__name__)


def is_cloud_available() -> bool:
    """Returns True if Groq or Gemini API keys are configured in the environment."""
    return bool(Config.GROQ_API_KEY or Config.GEMINI_API_KEY)


def _parse_chatml(prompt: str) -> Tuple[str, str]:
    """Helper to parse system/user instructions from ChatML template format."""
    system_match = re.search(r'<\|im_start\|>system\n(.*?)(?:<\|im_end\|>|$)', prompt, re.DOTALL)
    user_match = re.search(r'<\|im_start\|>user\n(.*?)(?:<\|im_end\|>|$)', prompt, re.DOTALL)

    system_text = system_match.group(1).strip() if system_match else "You are a STEM question generator."
    user_text = user_match.group(1).strip() if user_match else prompt

    return system_text, user_text


def generate_cloud_response(prompt: str, question_type: str = "mcq") -> Optional[str]:
    """Queries the configured cloud API (Groq then Gemini) and returns the full JSON response."""
    system_text, user_text = _parse_chatml(prompt)

    # ── 1. Groq ───────────────────────────────────────────────────────────────
    if Config.GROQ_API_KEY:
        try:
            logger.info(f"Querying Groq Cloud API ({Config.GROQ_MODEL})...")
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {Config.GROQ_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": Config.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            }
            response = requests.post(url, headers=headers, json=payload, timeout=7.5)
            if response.status_code in (401, 403):
                logger.warning(f"Groq key unauthorized ({response.status_code}). Check GROQ_API_KEY in .env.")
            else:
                response.raise_for_status()
                res_json = response.json()
                return res_json["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"Groq API call failed: {e}. Trying Gemini...")

    # ── 2. Gemini ─────────────────────────────────────────────────────────────
    if Config.GEMINI_API_KEY:
        try:
            logger.info(f"Querying Gemini Cloud API ({Config.GEMINI_MODEL})...")
            # Auth keys (AQ. prefix) use Bearer header; legacy AIzaSy keys use ?key= param.
            # We support both formats automatically.
            is_auth_key = Config.GEMINI_API_KEY.startswith("AQ.")
            if is_auth_key:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{Config.GEMINI_MODEL}:generateContent"
                )
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {Config.GEMINI_API_KEY}",
                }
            else:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{Config.GEMINI_MODEL}:generateContent?key={Config.GEMINI_API_KEY}"
                )
                headers = {"Content-Type": "application/json"}
            combined_prompt = f"System Instruction: {system_text}\n\nUser Request: {user_text}"
            payload = {
                "contents": [{"parts": [{"text": combined_prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            }
            response = requests.post(url, headers=headers, json=payload, timeout=7.5)
            if response.status_code in (401, 403):
                logger.warning(f"Gemini key unauthorized ({response.status_code}). Check GEMINI_API_KEY in .env.")
            else:
                response.raise_for_status()
                res_json = response.json()
                return res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.warning(f"Gemini API call failed: {e}. Falling back to local engine.")

    return None


def generate_cloud_stream(prompt: str, question_type: str = "mcq") -> Generator[str, None, None]:
    """Streams question generation chunks from the active cloud API (Groq → Gemini fallback)."""
    system_text, user_text = _parse_chatml(prompt)

    # ── 1. Groq streaming ─────────────────────────────────────────────────────
    if Config.GROQ_API_KEY:
        try:
            logger.info(f"Streaming from Groq Cloud API ({Config.GROQ_MODEL})...")
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {Config.GROQ_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": Config.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "stream": True,
            }
            # (connect_timeout, read_timeout) — read timeout prevents a stalled
            # stream from blocking the Flask worker thread indefinitely
            response = requests.post(url, headers=headers, json=payload, stream=True, timeout=(7.5, 60))
            if response.status_code in (401, 403):
                logger.warning(f"Groq streaming key unauthorized ({response.status_code}). Check GROQ_API_KEY in .env.")
            else:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    line_str = line.decode("utf-8").strip()
                    if line_str.startswith("data:"):
                        data_content = line_str[len("data:"):].strip()
                        if data_content == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(data_content)
                            delta = chunk_data["choices"][0]["delta"]
                            if "content" in delta:
                                yield delta["content"]
                        except Exception:
                            pass
                return
        except Exception as e:
            logger.warning(f"Groq streaming failed: {e}. Trying Gemini...")

    # ── 2. Gemini streaming ───────────────────────────────────────────────────
    if Config.GEMINI_API_KEY:
        try:
            logger.info(f"Streaming from Gemini Cloud API ({Config.GEMINI_MODEL})...")
            # Auth keys (AQ. prefix) use Bearer header; legacy AIzaSy keys use ?key= param.
            is_auth_key = Config.GEMINI_API_KEY.startswith("AQ.")
            if is_auth_key:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{Config.GEMINI_MODEL}:streamGenerateContent"
                )
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {Config.GEMINI_API_KEY}",
                }
            else:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{Config.GEMINI_MODEL}:streamGenerateContent?key={Config.GEMINI_API_KEY}"
                )
                headers = {"Content-Type": "application/json"}
            combined_prompt = f"System Instruction: {system_text}\n\nUser Request: {user_text}"
            payload = {
                "contents": [{"parts": [{"text": combined_prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            }
            response = requests.post(url, headers=headers, json=payload, stream=True, timeout=(7.5, 60))
            if response.status_code in (401, 403):
                logger.warning(f"Gemini streaming key unauthorized ({response.status_code}). Check GEMINI_API_KEY in .env.")
                return
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                line_str = line.decode("utf-8").strip()
                # Strip JSON array wrapper brackets Gemini sometimes adds
                cleaned = line_str
                if cleaned.startswith("["):
                    cleaned = cleaned[1:]
                if cleaned.endswith("]"):
                    cleaned = cleaned[:-1]
                if cleaned.startswith(","):
                    cleaned = cleaned[1:]
                cleaned = cleaned.strip()
                try:
                    data = json.loads(cleaned)
                    token = data["candidates"][0]["content"]["parts"][0]["text"]
                    yield token
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Gemini streaming failed: {e}.")
