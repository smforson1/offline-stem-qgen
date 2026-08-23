#!/usr/bin/env python3
"""
Downloads Qwen2.5-0.5B-Instruct-Q4_K_M.gguf for ultra-fast local inference.
"""

import os
import sys
import urllib.request

MODEL_URL = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
DEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "data", "models")
DEST_FILE = os.path.join(DEST_DIR, "qwen2.5-0.5b-instruct-q4_k_m.gguf")


def download_progress_hook(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100.0, (downloaded / total_size) * 100)
        mb_down = downloaded / (1024 * 1024)
        mb_tot = total_size / (1024 * 1024)
        sys.stdout.write(f"\rDownloading: {mb_down:.1f}MB / {mb_tot:.1f}MB [{percent:.1f}%]")
        sys.stdout.flush()


def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    if os.path.exists(DEST_FILE) and os.path.getsize(DEST_FILE) > 100 * 1024 * 1024:
        print(f"Model already exists at: {DEST_FILE} ({os.path.getsize(DEST_FILE)/(1024*1024):.1f} MB)")
        return

    print(f"Downloading Qwen2.5-0.5B-Instruct-Q4_K_M from:\n{MODEL_URL}\nTo: {DEST_FILE}...")
    temp_file = DEST_FILE + ".tmp"
    try:
        urllib.request.urlretrieve(MODEL_URL, temp_file, reporthook=download_progress_hook)
        print("\nDownload complete! Finalizing file...")
        if os.path.exists(DEST_FILE):
            os.remove(DEST_FILE)
        os.rename(temp_file, DEST_FILE)
        print(f"Successfully saved model to: {DEST_FILE} ({os.path.getsize(DEST_FILE)/(1024*1024):.1f} MB)")
    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        print(f"\nDownload failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
