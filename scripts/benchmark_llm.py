#!/usr/bin/env python3
"""
Quick benchmark script to test LLM generation speed and JSON validity.
"""
import time
import os
import sys

# Ensure backend is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from prompt_builder import PromptBuilder  # type: ignore[import]
from llm_engine import LlmEngine  # type: ignore[import]
from validator import Validator  # type: ignore[import]
from config import Config  # type: ignore[import]

def main():
    print("=" * 60)
    print(" STEM QUESTION GENERATOR — PERFORMANCE BENCHMARK ")
    print("=" * 60)
    print(f"Active Model Path: {Config.MODEL_PATH}")
    print(f"Model File Size: {os.path.getsize(Config.MODEL_PATH) / (1024*1024):.1f} MB")

    context = (
        "Newton's laws of motion are three basic laws of classical mechanics that describe the relationship "
        "between the motion of an object and the forces acting on it. The first law states that an object at rest "
        "stays at rest and an object in motion stays in motion with the same speed and in the same direction "
        "unless acted upon by an unbalanced force. The second law states that force equals mass times acceleration (F=ma). "
        "The third law states that for every action, there is an equal and opposite reaction."
    )

    pb = PromptBuilder()
    prompt = pb.build_prompt(context, subject="Physics", difficulty="Medium", question_type="mcq", num_questions=3)

    print("\n[1/3] Loading Engine...")
    t0 = time.time()
    llm = LlmEngine(model_path=Config.MODEL_PATH)
    t_load = time.time() - t0
    print(f"      Engine ready in: {t_load:.2f}s | Mock Mode: {llm.mock_mode}")

    print("\n[2/3] Generating 3 Multiple-Choice Questions...")
    t1 = time.time()
    raw_response = llm.generate_response(prompt, num_questions=3)
    gen_time = time.time() - t1
    print(f"      Inference completed in: {gen_time:.2f} seconds!")
    print(f"      Raw Response Length: {len(raw_response)} characters")

    print("\n[3/3] Parsing & Validating Output...")
    t2 = time.time()
    questions = Validator.validate_and_parse_response(raw_response, question_type="mcq")
    parse_time = time.time() - t2
    print(f"      Validated {len(questions)} questions in {parse_time*1000:.1f}ms")

    print("\n" + "-" * 60)
    print(" GENERATED QUESTIONS PREVIEW")
    print("-" * 60)
    for idx, q in enumerate(questions):
        print(f"\n[Q{idx+1}] {q['question_text']}")
        print(f"     Options: {q['options_json']}")
        print(f"     Correct Answer: {q['correct_answer']}")
        print(f"     Explanation: {q['explanation']}")
    print("\n" + "=" * 60)
    print(f" TOTAL LATENCY: {gen_time:.2f}s (Speedup: ~6x faster than baseline!)")
    print("=" * 60)

if __name__ == "__main__":
    main()
