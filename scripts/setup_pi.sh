#!/usr/bin/env bash
# Owner: S4 | Purpose: Bootstrap a Raspberry Pi 4 — install deps, copy model, start Flask service
set -euo pipefail

echo "=========================================================="
echo " Bootstrapping Raspberry Pi for Offline STEM Question Gen  "
echo "=========================================================="

# 1. Update and install system dependencies
echo "1. Installing system packages via apt..."
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    cmake \
    libgl1-mesa-glx \
    libglib2.0-0 \
    sqlite3 \
    git

# 2. Setup Python Virtual Environment
echo "2. Setting up virtual environment..."
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install --upgrade pip

# 3. Install Python Dependencies
echo "3. Installing backend python packages..."
# Include the CPU wheel index for fast ARM64 wheel retrieval or source compile fallback
pip install -r backend/requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

# 4. Initialize Database
echo "4. Initializing SQLite Database..."
sqlite3 backend/stem_qgen.db < backend/schema.sql
echo "Database initialized."

# 5. Create Systemd Service for Autostart on Boot
PROJECT_ROOT=$(pwd)
SERVICE_PATH="/etc/systemd/system/stem-qgen.service"

echo "5. Generating Systemd service at ${SERVICE_PATH}..."
sudo tee "${SERVICE_PATH}" > /dev/null <<EOF
[Unit]
Description=Offline STEM Question Generator Service
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${PROJECT_ROOT}/backend
Environment=PYTHONUNBUFFERED=1
Environment=HOST=0.0.0.0
Environment=PORT=5000
Environment=DATABASE_PATH=${PROJECT_ROOT}/backend/stem_qgen.db
Environment=UPLOADS_DIR=${PROJECT_ROOT}/backend/data/uploads
Environment=MODEL_PATH=${PROJECT_ROOT}/backend/data/models/model.gguf
ExecStart=${PROJECT_ROOT}/backend/venv/bin/python app.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Reload and enable the service
echo "6. Activating and starting stem-qgen service..."
sudo systemctl daemon-reload
sudo systemctl enable stem-qgen.service
sudo systemctl restart stem-qgen.service

echo "=========================================================="
echo " Setup complete! Flask server running on port 5000."
echo " Status check: sudo systemctl status stem-qgen"
echo " View logs: journalctl -u stem-qgen -f"
echo "=========================================================="
