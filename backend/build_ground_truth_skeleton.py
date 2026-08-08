"""
build_ground_truth_skeleton.py
Owner: S1 (Joel Yoofi Godwyll)
Purpose: Scan data/ocr_benchmark/images/ and auto-generate/update
         ground_truth.json so you only have to hand-type the "text" field
         for each image, not the whole JSON structure.

RECOMMENDED FILENAME CONVENTION (so subject + lighting can be auto-detected):

    <subject>_<lighting>_<number>.<ext>

    subject:  maths | science | english
    lighting: good | low_light | angled
    number:   any digits, e.g. 001, 002...

    Examples:
        maths_good_001.jpg
        science_low_light_014.jpg
        english_angled_027.png

If a filename doesn't match this pattern, the script still adds an entry
but leaves subject/lighting as "UNKNOWN" - you can fix those by hand in
ground_truth.json afterwards, or just rename the file and re-run this
script (it's safe to re-run any time).

SAFE TO RE-RUN: existing entries (including any "text" you've already
typed in) are preserved. Only new images get a fresh blank entry added,
and entries for images that no longer exist are removed with a warning
(not silently deleted from the file without telling you).

Usage:
    python build_ground_truth_skeleton.py
    python build_ground_truth_skeleton.py --benchmark-dir data/ocr_benchmark
"""

import argparse
import json
import re
import sys
from pathlib import Path

VALID_SUBJECTS = {"maths", "science", "english"}
VALID_LIGHTING = {"good", "low_light", "angled"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}

# matches: <subject>_<lighting>_<digits>.<ext>
# lighting may itself contain an underscore (low_light), so this pattern
# greedily tries the known lighting values rather than splitting blindly.
FILENAME_PATTERN = re.compile(
    r"^(?P<subject>[a-zA-Z]+)_(?P<lighting>good|low_light|angled)_(?P<number>\d+)$",
    re.IGNORECASE,
)


def parse_filename(stem: str) -> tuple:
    """
    Try to extract (subject, lighting) from a filename stem like
    'maths_good_001'. Returns ('UNKNOWN', 'UNKNOWN') if it doesn't match
    the expected convention.
    """
    match = FILENAME_PATTERN.match(stem)
    if not match:
        return "UNKNOWN", "UNKNOWN"

    subject = match.group("subject").lower()
    lighting = match.group("lighting").lower()

    if subject not in VALID_SUBJECTS:
        subject = "UNKNOWN"
    if lighting not in VALID_LIGHTING:
        lighting = "UNKNOWN"

    return subject, lighting


def load_existing(gt_path: Path) -> dict:
    """Load existing ground_truth.json into a dict keyed by filename, if present."""
    if not gt_path.exists():
        return {}

    with open(gt_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    return {entry["filename"]: entry for entry in entries}


def main():
    parser = argparse.ArgumentParser(
        description="Generate/update ground_truth.json skeleton from images folder"
    )
    parser.add_argument(
        "--benchmark-dir",
        type=Path,
        default=Path("data/ocr_benchmark"),
        help="Directory containing images/ and ground_truth.json (default: data/ocr_benchmark)",
    )
    args = parser.parse_args()

    images_dir = args.benchmark_dir / "images"
    gt_path = args.benchmark_dir / "ground_truth.json"

    if not images_dir.exists():
        print(f"ERROR: images folder not found at {images_dir}")
        print("Create it first, e.g.:")
        print(f"  New-Item -ItemType Directory -Force -Path {images_dir}")
        sys.exit(1)

    image_files = sorted(
        p for p in images_dir.iterdir()
        if p.suffix.lower() in IMAGE_EXTENSIONS
    )

    if not image_files:
        print(f"No images found in {images_dir}. Add some .jpg/.jpeg/.png files first.")
        sys.exit(0)

    existing = load_existing(gt_path)
    existing_filenames = set(existing.keys())
    current_filenames = {p.name for p in image_files}

    # entries whose image file no longer exists
    stale = existing_filenames - current_filenames
    if stale:
        print(f"WARNING: {len(stale)} entries in ground_truth.json have no matching image file:")
        for name in sorted(stale):
            print(f"  - {name}")
        print("These will be dropped from the regenerated file.\n")

    new_entries = []
    added_count = 0
    unknown_count = 0

    for image_path in image_files:
        filename = image_path.name

        if filename in existing:
            # preserve everything the user already filled in
            new_entries.append(existing[filename])
            continue

        subject, lighting = parse_filename(image_path.stem)
        if subject == "UNKNOWN" or lighting == "UNKNOWN":
            unknown_count += 1

        new_entries.append({
            "filename": filename,
            "subject": subject,
            "lighting": lighting,
            "text": "",
        })
        added_count += 1

    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(new_entries, f, indent=2, ensure_ascii=False)

    # summary
    total = len(new_entries)
    blank_text = sum(1 for e in new_entries if not e["text"].strip())

    print(f"Wrote {gt_path}")
    print(f"  Total entries:        {total}")
    print(f"  Newly added:          {added_count}")
    print(f"  Still need 'text':    {blank_text}")
    if unknown_count:
        print(f"  Unrecognised filename pattern (subject/lighting = UNKNOWN): {unknown_count}")
        print(f"  -> rename to <subject>_<lighting>_<number>.<ext> and re-run,")
        print(f"     or just fix subject/lighting by hand in {gt_path.name}")

    by_subject = {}
    by_lighting = {}
    for e in new_entries:
        by_subject[e["subject"]] = by_subject.get(e["subject"], 0) + 1
        by_lighting[e["lighting"]] = by_lighting.get(e["lighting"], 0) + 1

    print("\n  By subject:")
    for k, v in sorted(by_subject.items()):
        print(f"    {k:<10s} {v}")
    print("  By lighting:")
    for k, v in sorted(by_lighting.items()):
        print(f"    {k:<12s} {v}")

    print(f"\nNext step: open {gt_path.name} and fill in the 'text' field for each entry")
    print("with the exact ground-truth transcription of that image.")


if __name__ == "__main__":
    main()
