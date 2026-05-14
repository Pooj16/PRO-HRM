#!/usr/bin/env python3
"""
Simple OCR Service for Resume Text Extraction
Uses Tesseract OCR (free, open-source, no API keys needed)

Installation:
  1. Install Tesseract: brew install tesseract (macOS)
  2. Install Python deps: pip install pytesseract pdf2image pillow flask

Run:
  python tools/ocr_service.py
  
This will start a Flask server on http://localhost:5000
"""

from flask import Flask, request, jsonify
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import base64
import io
import logging
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Enable CORS for all routes so the React frontend can call it directly

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/extract-text', methods=['POST'])
def extract_text():
    """
    Extract text from base64-encoded PDF or image
    
    Expected JSON:
    {
      "base64_data": "...",
      "content_type": "application/pdf" or "image/png" etc
    }
    
    Returns:
    {
      "extracted_text": "...",
      "success": true,
      "length": 1234
    }
    """
    try:
        data = request.get_json()
        base64_data = data.get('base64_data')
        content_type = data.get('content_type', 'application/pdf')
        
        if not base64_data:
            return jsonify({'error': 'base64_data required', 'success': False}), 400
        
        logger.info(f"📥 Received OCR request. Content-Type: {content_type}")
        
        # Decode base64
        file_bytes = base64.b64decode(base64_data)
        logger.info(f"📊 File size: {len(file_bytes)} bytes")
        
        # Extract text based on content type
        if content_type == 'application/pdf':
            logger.info("📄 Processing PDF...")
            extracted_text = extract_text_from_pdf(file_bytes)
        elif content_type.startswith('image/'):
            logger.info("🖼️  Processing image...")
            extracted_text = extract_text_from_image(file_bytes)
        else:
            return jsonify({'error': f'Unsupported content type: {content_type}', 'success': False}), 400
        
        if not extracted_text:
            return jsonify({'error': 'No text extracted', 'success': False}), 400
        
        logger.info(f"✅ Extraction successful. Extracted {len(extracted_text)} characters")
        
        return jsonify({
            'extracted_text': extracted_text,
            'success': True,
            'length': len(extracted_text)
        }), 200
    
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

from pypdf import PdfReader

def extract_text_from_pdf(file_bytes):
    """Extract text from PDF using pypdf (pure python, no poppler required)"""
    try:
        logger.info("🔄 Extracting text using pypdf...")
        reader = PdfReader(io.BytesIO(file_bytes))
        logger.info(f"📄 Found {len(reader.pages)} pages in PDF")
        
        all_text = []
        for idx, page in enumerate(reader.pages, 1):
            text = page.extract_text()
            if text:
                all_text.append(text)
                
        combined_text = '\n'.join(all_text).strip()
        
        # Fallback to Tesseract ONLY if PDF is purely scanned images
        if not combined_text:
            logger.warning("⚠️ No text found by pypdf (might be scanned). Falling back to Tesseract.")
            try:
                from pdf2image import convert_from_bytes
                import pytesseract
                images = convert_from_bytes(file_bytes)
                all_text = []
                for image in images:
                    all_text.append(pytesseract.image_to_string(image))
                combined_text = '\n'.join(all_text).strip()
            except Exception as e:
                logger.error(f"Fallback Tesseract failed (poppler missing?): {str(e)}")
                raise Exception("Missing poppler system dependency for scanned PDFs.")
                
        return combined_text
    
    except Exception as e:
        logger.error(f"PDF extraction error: {str(e)}")
        raise

def extract_text_from_image(file_bytes):
    """Extract text from image using Tesseract"""
    try:
        logger.info("🔄 Extracting text from image...")
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image)
        return text.strip()
    
    except Exception as e:
        logger.error(f"Image extraction error: {str(e)}")
        raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'OCR Service'}), 200

if __name__ == '__main__':
    logger.info("🚀 Starting OCR Service on http://localhost:5002")
    logger.info("📍 Endpoint: POST /extract-text")
    logger.info("❓ Health check: GET /health")
    app.run(host='0.0.0.0', port=5002, debug=True)
