# Owner: S4 | Purpose: Docker image for the Flask API service
FROM python:3.11-slim

# Set system environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000 \
    HOST=0.0.0.0

WORKDIR /app

# Install system dependencies
# 1. build-essential and cmake are required for any pip source builds.
# 2. libgl1-mesa-glx and libglib2.0-0 are mandatory runtime dependencies for OpenCV (used by PaddleOCR).
# 3. sqlite3 is installed for debugging local database files inside the container.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgl1-mesa-glx \
    libglib2.0-0 \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .

# Use the pre-compiled CPU wheel index for llama-cpp-python to bypass compilation overhead/times inside the container
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

# Copy application files
COPY . .

EXPOSE 5000

# Start API service
CMD ["python", "app.py"]
