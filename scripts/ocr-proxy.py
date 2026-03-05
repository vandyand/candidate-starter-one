#!/usr/bin/env python3
"""
OCR Proxy Service for Tier 4 Vision-Based Locator Resolution.

A lightweight FastAPI service that accepts a base64-encoded screenshot and a
search query, runs Tesseract OCR to find matching text with bounding boxes,
and returns the coordinates of the best match.

Usage:
    python3 scripts/ocr-proxy.py              # Starts on port 7899
    python3 scripts/ocr-proxy.py --port 8080  # Custom port

API:
    POST /ocr
    Body: {"image": "<base64>", "query": "Sign In"}
    Response: {"found": true, "x": 450, "y": 320, "width": 80, "height": 24, "confidence": 0.92}
"""

import argparse
import base64
import io
import sys

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pytesseract
from PIL import Image

app = FastAPI(title="OCR Proxy", version="1.0.0")


class OCRRequest(BaseModel):
    image: str  # base64-encoded image
    query: str  # text to search for


class OCRResult(BaseModel):
    found: bool
    x: int
    y: int
    width: int
    height: int
    confidence: float


NOT_FOUND = OCRResult(found=False, x=0, y=0, width=0, height=0, confidence=0.0)


def find_text_in_image(image_bytes: bytes, query: str) -> OCRResult:
    """Run Tesseract OCR and search for the query text in the results."""
    image = Image.open(io.BytesIO(image_bytes))

    # Upscale small images for better OCR accuracy — Tesseract works best at 300+ DPI
    MIN_WIDTH = 1600
    scale_factor = 1.0
    if image.width < MIN_WIDTH:
        scale_factor = MIN_WIDTH / image.width
        new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
        image = image.resize(new_size, Image.LANCZOS)

    # Get word-level bounding boxes with confidence scores
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

    query_lower = query.lower().strip()
    query_words = query_lower.split()

    if not query_words:
        return NOT_FOUND

    # Strategy 1: Try to find exact multi-word match by joining consecutive words
    n = len(data["text"])
    best_match = None
    best_confidence = 0.0

    for i in range(n):
        # Skip empty or low-confidence entries
        if int(data["conf"][i]) < 0:
            continue

        # Try to match the full query starting at position i
        matched_words = 0
        combined_text = ""

        for j in range(i, min(i + len(query_words) + 2, n)):
            word = data["text"][j].strip()
            if not word:
                continue
            combined_text += (" " if combined_text else "") + word
            matched_words += 1

            if matched_words >= len(query_words):
                break

        if not combined_text:
            continue

        # Check if the combined text matches the query
        combined_lower = combined_text.lower()
        if query_lower in combined_lower or combined_lower in query_lower:
            # Calculate bounding box spanning all matched words
            x_min = int(data["left"][i])
            y_min = int(data["top"][i])
            x_max = x_min + int(data["width"][i])
            y_max = y_min + int(data["height"][i])

            # Extend bounding box for multi-word matches
            for j in range(i + 1, min(i + matched_words + 2, n)):
                word = data["text"][j].strip()
                if not word:
                    continue
                x_max = max(x_max, int(data["left"][j]) + int(data["width"][j]))
                y_max = max(y_max, int(data["top"][j]) + int(data["height"][j]))
                y_min = min(y_min, int(data["top"][j]))

            avg_conf = float(data["conf"][i]) / 100.0
            if avg_conf > best_confidence:
                best_confidence = avg_conf
                best_match = OCRResult(
                    found=True,
                    x=x_min,
                    y=y_min,
                    width=x_max - x_min,
                    height=y_max - y_min,
                    confidence=round(avg_conf, 3),
                )

    if best_match:
        # Scale coordinates back to original image size
        if scale_factor != 1.0:
            best_match = OCRResult(
                found=True,
                x=int(best_match.x / scale_factor),
                y=int(best_match.y / scale_factor),
                width=int(best_match.width / scale_factor),
                height=int(best_match.height / scale_factor),
                confidence=best_match.confidence,
            )
        return best_match

    # Strategy 2: Single word partial match (fallback)
    for i in range(n):
        word = data["text"][i].strip().lower()
        conf = int(data["conf"][i])
        if conf < 0 or not word:
            continue

        if query_words[0] in word or word in query_words[0]:
            norm_conf = float(conf) / 100.0
            if norm_conf > best_confidence:
                best_confidence = norm_conf
                best_match = OCRResult(
                    found=True,
                    x=int(int(data["left"][i]) / scale_factor),
                    y=int(int(data["top"][i]) / scale_factor),
                    width=int(int(data["width"][i]) / scale_factor),
                    height=int(int(data["height"][i]) / scale_factor),
                    confidence=round(norm_conf * 0.8, 3),  # discount partial
                )

    return best_match or NOT_FOUND


@app.post("/ocr", response_model=OCRResult)
async def ocr_endpoint(request: OCRRequest) -> OCRResult:
    """Find text in a screenshot and return its bounding box."""
    try:
        image_bytes = base64.b64decode(request.image)
        result = find_text_in_image(image_bytes, request.query)
        return result
    except Exception as e:
        print(f"OCR error: {e}", file=sys.stderr)
        return NOT_FOUND


@app.get("/health")
async def health() -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse({"status": "ok", "engine": "tesseract"})


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="OCR Proxy Service")
    parser.add_argument("--port", type=int, default=7899, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    args = parser.parse_args()

    print(f"Starting OCR proxy on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
