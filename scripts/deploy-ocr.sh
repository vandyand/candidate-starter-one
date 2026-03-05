#!/usr/bin/env bash
# Tier 4 OCR Setup Guide
# =======================
#
# The Tier 4 vision-based locator uses Tesseract OCR to find text on
# screenshots when all CSS/DOM-based strategies (Tiers 1-3) fail.
#
# Architecture:
#   Playwright screenshot → OCR Proxy (FastAPI + Tesseract) → bounding box coords
#
# The OCR proxy (scripts/ocr-proxy.py) is a lightweight FastAPI service that:
# 1. Receives a base64-encoded screenshot + search query
# 2. Upscales small images for better OCR accuracy
# 3. Runs Tesseract to extract word-level bounding boxes
# 4. Searches for the query text and returns coordinates
#
# Prerequisites:
#   sudo apt-get install -y tesseract-ocr     # System OCR engine
#   pip3 install pytesseract --break-system-packages  # Python wrapper
#   pip3 install fastapi uvicorn pillow --break-system-packages  # Already installed
#
# Quick Start:
#   python3 scripts/ocr-proxy.py              # Starts on http://127.0.0.1:7899
#   yarn dev                                  # Run automation — Tier 4 is available
#
# Or use the npm script:
#   yarn ocr-proxy &                          # Start proxy in background
#   yarn dev                                  # Run automation
#
# Configuration:
#   The OCR client defaults to http://127.0.0.1:7899/ocr
#   Override via environment variable:
#     OCR_ENDPOINT=http://your-custom-endpoint/ocr
#
# Testing:
#   python3 scripts/ocr-proxy.py &            # Start proxy
#   yarn test:ocr                             # Run OCR integration tests
#
# API:
#   POST /ocr
#   Body: {"image": "<base64-png>", "query": "Sign In"}
#   Response: {"found": true, "x": 450, "y": 320, "width": 80, "height": 24, "confidence": 0.96}
#
#   GET /health
#   Response: {"status": "ok", "engine": "tesseract"}
#
# Performance:
#   - ~300ms per OCR call (including upscaling)
#   - Tesseract works best with images >= 300 DPI
#   - The proxy auto-upscales small screenshots for accuracy
#   - Tier 4 is the last resort — only invoked after Tiers 1-3 fail

set -euo pipefail

echo "Tier 4 OCR Setup"
echo "================"
echo ""

# Check prerequisites
if command -v tesseract &>/dev/null; then
    echo "✓ Tesseract $(tesseract --version 2>&1 | head -1)"
else
    echo "✗ Tesseract not installed"
    echo "  Run: sudo apt-get install -y tesseract-ocr"
    exit 1
fi

if python3 -c "import pytesseract" 2>/dev/null; then
    echo "✓ pytesseract installed"
else
    echo "✗ pytesseract not installed"
    echo "  Run: pip3 install pytesseract --break-system-packages"
    exit 1
fi

if python3 -c "import fastapi" 2>/dev/null; then
    echo "✓ FastAPI installed"
else
    echo "✗ FastAPI not installed"
    echo "  Run: pip3 install fastapi uvicorn --break-system-packages"
    exit 1
fi

echo ""
echo "All prerequisites met. Start the OCR proxy with:"
echo "  python3 scripts/ocr-proxy.py"
echo ""
echo "Current OCR_ENDPOINT: ${OCR_ENDPOINT:-'http://127.0.0.1:7899/ocr (default)'}"
