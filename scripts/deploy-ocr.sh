#!/usr/bin/env bash
# GLM-OCR Deployment Guide
# ========================
#
# This script documents how to deploy GLM-OCR (0.9B parameters) on HuggingFace
# Inference Endpoints for use as the Tier 4 vision fallback.
#
# GLM-OCR was chosen because:
# - 0.9B parameters — tiny enough to run on minimal GPU
# - 94.62% on OmniDocBench V1.5 (top-ranked for its size class)
# - Supports deployment via vLLM, SGLang, and Ollama
# - Fast inference: ~1.86 pages/second for PDFs
#
# Deployment Steps:
#
# 1. Go to https://ui.endpoints.huggingface.co/new
# 2. Select model: zai-org/GLM-OCR
# 3. Choose a region close to your target (us-east-1 recommended)
# 4. Select GPU: nvidia-l4 (cheapest option with enough VRAM for 0.9B model)
# 5. Set scaling to min 0 / max 1 instances (scale-to-zero for cost savings)
# 6. Deploy and wait for the endpoint to become active
# 7. Copy the endpoint URL
# 8. Set GLM_OCR_ENDPOINT in your .env file:
#
#    GLM_OCR_ENDPOINT=https://your-endpoint-id.us-east-1.aws.endpoints.huggingface.cloud
#
# Alternative: Local Deployment via Ollama
#
# If you have a local GPU:
#   ollama pull glm-ocr
#   ollama serve
#   # Set GLM_OCR_ENDPOINT=http://localhost:11434/api/generate
#
# Cost Considerations:
# - HuggingFace Inference Endpoints: ~$0.60/hr for nvidia-l4
# - With scale-to-zero, you only pay when the model is active
# - Each OCR call adds 1-5 seconds of latency (Tier 4 is last resort)
# - The system gracefully degrades when no endpoint is configured
#
# Testing:
#   export GLM_OCR_ENDPOINT=https://your-endpoint-url
#   yarn dev  # Run automation — Tier 4 will be available

echo "GLM-OCR Deployment Guide"
echo "========================"
echo ""
echo "Model:    zai-org/GLM-OCR (0.9B parameters)"
echo "Platform: HuggingFace Inference Endpoints"
echo "GPU:      nvidia-l4 (recommended)"
echo ""
echo "See comments in this script for full deployment instructions."
echo ""
echo "Current GLM_OCR_ENDPOINT: ${GLM_OCR_ENDPOINT:-'(not configured — Tier 4 disabled)'}"
