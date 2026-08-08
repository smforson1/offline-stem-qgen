"""
evaluate_ocr.py
Owner: S1 (Joel Yoofi Godwyll)
Purpose: CER (Character Error Rate) benchmark for ocr_engine.extract_text().

Spec (section 2.3 - Benchmark Protocol):
    - 100 JPEG photos: ~34 Maths, ~33 Science, ~33 English
    - 3 conditions: good lighting, low light, angled shot (>=30 deg tilt)
    - CER = (S + D + I) / N   (substitutions, deletions, insertions, ground-truth chars)
    - Computed via jiwer
    - Target: CER < 15% (accuracy > 85%) on the full 100-image set
    - Report CER separately per subject AND per lighting condition

Expected folder layout:

    data/ocr_benchmark/
        images/
            maths_001.jpg
            maths_002.jpg
            science_001.jpg
            ...
        ground_truth.json

ground_truth.json format (one entry per image):

    [
        {
            "filename": "maths_001.jpg",
            "subject": "maths",              # "maths" | "science" | "english"
            "lighting": "good",              # "good" | "low_light" | "angled"
            "text": "the exact ground-truth transcription of the page..."
        },
        ...
    ]

Usage:
    python evaluate_ocr.py
    python evaluate_ocr.py --benchmark-dir data/ocr_benchmark
    python evaluate_ocr.py --output-csv ocr_benchmark_results.csv --output-chart ocr_cer_by_group.png
"""

import argparse
import csv
import json
import logging
import sys
from pathlib import Path

import jiwer

from ocr_engine import extract_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("evaluate_ocr")

CER_TARGET = 0.15  # 15%, per spec


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_ground_truth(benchmark_dir: Path) -> list:
    """Load and validate ground_truth.json from the benchmark directory."""
    gt_path = benchmark_dir / "ground_truth.json"
    if not gt_path.exists():
        logger.error("ground_truth.json not found at %s", gt_path)
        sys.exit(1)

    with open(gt_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    required_keys = {"filename", "subject", "lighting", "text"}
    for i, entry in enumerate(entries):
        missing = required_keys - entry.keys()
        if missing:
            logger.error("Entry %d in ground_truth.json missing keys: %s", i, missing)
            sys.exit(1)

    logger.info("Loaded %d ground-truth entries from %s", len(entries), gt_path)
    return entries


# ---------------------------------------------------------------------------
# Per-image evaluation
# ---------------------------------------------------------------------------

def evaluate_single(entry: dict, images_dir: Path) -> dict:
    """
    Run OCR on one benchmark image and compute its CER against ground truth.

    Returns a result dict with per-image metrics, or None if the image
    file is missing (logged as a warning, not a hard failure, so one bad
    file doesn't kill the whole benchmark run).
    """
    image_path = images_dir / entry["filename"]
    if not image_path.exists():
        logger.warning("Image not found, skipping: %s", image_path)
        return None

    ocr_result = extract_text(str(image_path))
    hypothesis = ocr_result["text"]
    reference = entry["text"]

    # jiwer.cer computes (S + D + I) / N directly
    cer = jiwer.cer(reference, hypothesis)

    return {
        "filename": entry["filename"],
        "subject": entry["subject"],
        "lighting": entry["lighting"],
        "cer": cer,
        "ocr_confidence_mean": ocr_result["confidence_mean"],
        "ocr_token_count": ocr_result["token_count"],
        "ocr_duration_ms": ocr_result["duration_ms"],
        "reference_len_chars": len(reference),
    }


# ---------------------------------------------------------------------------
# Aggregation + reporting
# ---------------------------------------------------------------------------

def aggregate_by(results: list, key: str) -> dict:
    """Compute mean CER grouped by the given key (e.g. 'subject' or 'lighting')."""
    groups = {}
    for r in results:
        groups.setdefault(r[key], []).append(r["cer"])

    return {
        group: {
            "mean_cer": sum(values) / len(values),
            "n": len(values),
        }
        for group, values in sorted(groups.items())
    }


def print_summary(results: list) -> None:
    overall_cer = sum(r["cer"] for r in results) / len(results)
    status = "PASS" if overall_cer < CER_TARGET else "FAIL"

    print("\n" + "=" * 60)
    print(f"OCR BENCHMARK RESULTS  ({len(results)} images evaluated)")
    print("=" * 60)
    print(f"Overall mean CER: {overall_cer:.4f}  ({overall_cer*100:.2f}%)")
    print(f"Target: CER < {CER_TARGET*100:.0f}%  ->  {status}")

    print("\nBy subject:")
    for subject, stats in aggregate_by(results, "subject").items():
        print(f"  {subject:<10s}  mean CER = {stats['mean_cer']*100:6.2f}%   (n={stats['n']})")

    print("\nBy lighting condition:")
    for lighting, stats in aggregate_by(results, "lighting").items():
        print(f"  {lighting:<12s}  mean CER = {stats['mean_cer']*100:6.2f}%   (n={stats['n']})")

    mean_conf = sum(r["ocr_confidence_mean"] for r in results) / len(results)
    mean_duration = sum(r["ocr_duration_ms"] for r in results) / len(results)
    over_budget = sum(1 for r in results if r["ocr_duration_ms"] > 5000)
    print(f"\nMean OCR confidence: {mean_conf:.4f}")
    print(f"Mean OCR duration: {mean_duration:.0f}ms")
    print(f"Images over 5000ms latency budget: {over_budget}/{len(results)}")
    print("=" * 60 + "\n")


def write_csv(results: list, output_path: Path) -> None:
    fieldnames = [
        "filename", "subject", "lighting", "cer",
        "ocr_confidence_mean", "ocr_token_count",
        "ocr_duration_ms", "reference_len_chars",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow(r)
    logger.info("Wrote per-image results to %s", output_path)


def write_bar_chart(results: list, output_path: Path) -> None:
    """Bar chart of mean CER by subject and by lighting condition, side by side."""
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        logger.warning("matplotlib not installed - skipping chart generation.")
        return

    by_subject = aggregate_by(results, "subject")
    by_lighting = aggregate_by(results, "lighting")

    fig, axes = plt.subplots(1, 2, figsize=(10, 4))

    axes[0].bar(by_subject.keys(), [v["mean_cer"] * 100 for v in by_subject.values()])
    axes[0].axhline(y=CER_TARGET * 100, color="red", linestyle="--", label="15% target")
    axes[0].set_title("Mean CER by Subject")
    axes[0].set_ylabel("CER (%)")
    axes[0].legend()

    axes[1].bar(by_lighting.keys(), [v["mean_cer"] * 100 for v in by_lighting.values()])
    axes[1].axhline(y=CER_TARGET * 100, color="red", linestyle="--", label="15% target")
    axes[1].set_title("Mean CER by Lighting Condition")
    axes[1].set_ylabel("CER (%)")
    axes[1].legend()

    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    logger.info("Wrote chart to %s", output_path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Run CER benchmark on ocr_engine.py")
    parser.add_argument(
        "--benchmark-dir",
        type=Path,
        default=Path("data/ocr_benchmark"),
        help="Directory containing images/ and ground_truth.json (default: data/ocr_benchmark)",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("ocr_benchmark_results.csv"),
        help="Path to write per-image CSV results",
    )
    parser.add_argument(
        "--output-chart",
        type=Path,
        default=Path("ocr_benchmark_chart.png"),
        help="Path to write the CER bar chart PNG",
    )
    args = parser.parse_args()

    images_dir = args.benchmark_dir / "images"
    ground_truth = load_ground_truth(args.benchmark_dir)

    results = []
    for i, entry in enumerate(ground_truth, start=1):
        logger.info("[%d/%d] Evaluating %s...", i, len(ground_truth), entry["filename"])
        result = evaluate_single(entry, images_dir)
        if result is not None:
            results.append(result)

    if not results:
        logger.error("No images were successfully evaluated. Check paths and try again.")
        sys.exit(1)

    print_summary(results)
    write_csv(results, args.output_csv)
    write_bar_chart(results, args.output_chart)


if __name__ == "__main__":
    main()
