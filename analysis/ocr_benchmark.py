# Owner: S1+S5 | Purpose: Compares OCR engine output against ground-truth benchmark texts

import os
import sys
import time
import logging
from typing import Dict, Any, List
from PIL import Image, ImageDraw

# Set up simple logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ocr_benchmark")

def edit_distance(s1: str, s2: str) -> int:
    """Calculates the Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]

def calculate_accuracy(pred: str, gt: str) -> float:
    """Computes character recognition accuracy (1.0 - CER)."""
    # Normalize strings (strip whitespace, lowercase for comparison if needed, 
    # but here we do exact match including whitespace and case for rigorous benchmark)
    pred_clean = pred.strip()
    gt_clean = gt.strip()
    
    if not pred_clean and not gt_clean:
        return 1.0
        
    max_len = max(len(pred_clean), len(gt_clean))
    dist = edit_distance(pred_clean, gt_clean)
    
    accuracy = 1.0 - (dist / max_len)
    return max(0.0, accuracy)

def create_sample_benchmarks(benchmark_dir: str):
    """Creates dummy images and ground-truth text files if none exist."""
    os.makedirs(benchmark_dir, exist_ok=True)
    logger.info(f"Creating sample benchmark files in {benchmark_dir}...")
    
    samples = [
        {
            "name": "sample_math",
            "text": "Algebraic Formula:\n(a + b)^2 = a^2 + 2ab + b^2",
            "size": (500, 100),
            "text_offset": (20, 20)
        },
        {
            "name": "sample_chemistry",
            "text": "Chemical Equation:\n2H2 + O2 -> 2H2O",
            "size": (400, 100),
            "text_offset": (20, 25)
        }
    ]
    
    for sample in samples:
        img_path = os.path.join(benchmark_dir, f"{sample['name']}.png")
        txt_path = os.path.join(benchmark_dir, f"{sample['name']}.txt")
        
        # Save ground truth text
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(sample["text"])
            
        # Create and save image
        img = Image.new('RGB', sample["size"], color='white')
        draw = ImageDraw.Draw(img)
        
        lines = sample["text"].split("\n")
        y_offset = sample["text_offset"][1]
        for line in lines:
            draw.text((sample["text_offset"][0], y_offset), line, fill='black')
            y_offset += 25
            
        img.save(img_path)
        logger.info(f"Generated {img_path} and {txt_path}")

def run_benchmarks(benchmark_dir: str) -> List[Dict[str, Any]]:
    # Import OcrEngine
    # Setup path
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
    sys.path.append(backend_dir)
    # pyrefly: ignore [missing-import]
    from ocr_engine import OcrEngine
    
    engine = OcrEngine(lang='en', device='cpu', enable_mkldnn=False)
    
    # Supported image extensions
    valid_exts = {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}
    
    files = os.listdir(benchmark_dir)
    image_files = [f for f in files if os.path.splitext(f)[1].lower() in valid_exts]
    
    # Sort for deterministic order
    image_files.sort()
    
    results = []
    
    for img_file in image_files:
        name_without_ext, _ = os.path.splitext(img_file)
        img_path = os.path.join(benchmark_dir, img_file)
        txt_path = os.path.join(benchmark_dir, f"{name_without_ext}.txt")
        
        if not os.path.exists(txt_path):
            logger.warning(f"No ground-truth file found for {img_file}. Expected {name_without_ext}.txt. Skipping.")
            continue
            
        # Read ground truth
        with open(txt_path, "r", encoding="utf-8") as f:
            gt_text = f.read()
            
        logger.info(f"Running OCR on {img_file}...")
        start_time = time.time()
        try:
            ocr_res = engine.extract_text_from_image(img_path)
            duration = time.time() - start_time
            pred_text = ocr_res["full_text"]
            
            accuracy = calculate_accuracy(pred_text, gt_text)
            
            results.append({
                "filename": img_file,
                "accuracy": accuracy,
                "duration_sec": duration,
                "gt": gt_text,
                "pred": pred_text
            })
            logger.info(f"Accuracy for {img_file}: {accuracy:.2%}")
        except Exception as e:
            logger.error(f"Failed to process {img_file}: {str(e)}")
            results.append({
                "filename": img_file,
                "accuracy": 0.0,
                "duration_sec": 0.0,
                "gt": gt_text,
                "pred": f"ERROR: {str(e)}"
            })
            
    return results

def main():
    # Base paths relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    benchmark_dir = os.path.abspath(os.path.join(script_dir, "..", "backend", "data", "ocr_benchmark"))
    
    # Check if directory has benchmark pairs
    valid_exts = {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}
    has_benchmarks = False
    
    if os.path.exists(benchmark_dir):
        files = os.listdir(benchmark_dir)
        image_files = [f for f in files if os.path.splitext(f)[1].lower() in valid_exts]
        for img in image_files:
            name, _ = os.path.splitext(img)
            if f"{name}.txt" in files:
                has_benchmarks = True
                break
                
    if not has_benchmarks:
        logger.info("No benchmark image/text pairs found in ocr_benchmark directory.")
        create_sample_benchmarks(benchmark_dir)
        
    logger.info(f"Starting OCR benchmarks from: {benchmark_dir}")
    results = run_benchmarks(benchmark_dir)
    
    if not results:
        print("No benchmarks ran.")
        return
        
    # Compile stats
    total_acc = 0.0
    total_time = 0.0
    successful_runs = 0
    
    print("\n" + "="*80)
    print(f"{'OCR BENCHMARK RESULTS':^80}")
    print("="*80)
    print(f"{'Filename':<25} | {'Accuracy':<10} | {'Duration (s)':<12} | {'Status':<15}")
    print("-"*80)
    
    for res in results:
        status = "Success" if "ERROR:" not in res["pred"] else "Failed"
        print(f"{res['filename']:<25} | {res['accuracy']:<10.2%} | {res['duration_sec']:<12.3f} | {status:<15}")
        total_acc += res["accuracy"]
        total_time += res["duration_sec"]
        successful_runs += 1
        
    avg_acc = total_acc / len(results) if results else 0.0
    
    print("="*80)
    print(f"Total files: {len(results)}")
    print(f"Average Character Accuracy: {avg_acc:.2%}")
    print(f"Total time elapsed: {total_time:.3f} seconds")
    print("="*80 + "\n")
    
    # Optional detailed output for low accuracy
    for res in results:
        if res["accuracy"] < 0.95:
            print(f"--- Low Accuracy Detail for: {res['filename']} ({res['accuracy']:.1%}) ---")
            print(f"GROUND TRUTH:\n{res['gt']}")
            print(f"PREDICTED:\n{res['pred']}")
            print("-" * 50)

if __name__ == "__main__":
    main()
