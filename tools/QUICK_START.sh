#!/bin/bash
# Quick ATS Setup Checklist
# Copy & paste commands from this file

echo "================================"
echo "🚀 ATS Scoring Fix - Quick Setup"
echo "================================"
echo ""

# Step 1: Install
echo "📦 Step 1: Install Dependencies"
echo "Run this:"
echo ""
echo "  cd /Users/poojashivakumar16/Downloads/spark-hire-smart-c233f1fc-main/tools"
echo "  python3 -m venv ml_env"
echo "  source ml_env/bin/activate"
echo "  pip install flask pytesseract pdf2image pillow torch transformers"
echo "  brew install tesseract  # macOS"
echo ""
echo "Wait for installation to complete (5-10 minutes)..."
echo ""

# Step 2: Start OCR
echo "💾 Step 2: Start OCR Service"
echo "Open Terminal 1 and run:"
echo ""
echo "  cd /Users/poojashivakumar16/Downloads/spark-hire-smart-c233f1fc-main"
echo "  source tools/ml_env/bin/activate"
echo "  python3 tools/ocr_service.py"
echo ""
echo "You should see:"
echo "  🚀 Starting OCR Service on http://localhost:5000"
echo ""

# Step 3: Start ATS
echo "🤖 Step 3: Start ATS Service"
echo "Open Terminal 2 and run:"
echo ""
echo "  cd /Users/poojashivakumar16/Downloads/spark-hire-smart-c233f1fc-main"
echo "  source tools/ml_env/bin/activate"
echo "  python3 tools/ats_scoring_service.py"
echo ""
echo "You should see:"
echo "  🚀 Starting ATS Scoring Service on http://localhost:5001"
echo "  ✅ ATS model loaded successfully!"
echo ""

# Step 4: Start Frontend
echo "🌐 Step 4: Start Frontend"
echo "Open Terminal 3 and run:"
echo ""
echo "  cd /Users/poojashivakumar16/Downloads/spark-hire-smart-c233f1fc-main"
echo "  npm run dev"
echo ""

# Step 5: Test
echo "🧪 Step 5: Test (Optional but recommended)"
echo "Open Terminal 4 and run:"
echo ""
echo "  node /Users/poojashivakumar16/Downloads/spark-hire-smart-c233f1fc-main/tools/test-ocr-service.mjs"
echo ""
echo "You should see:"
echo "  ✅ Health check passed"
echo "  ✅ Extraction succeeded"
echo ""

# Step 6: Test End-to-End
echo "📨 Step 6: Test with Real Resume"
echo ""
echo "  1. Open http://localhost:8080"
echo "  2. Click 'Apply Now' on careers page"
echo "  3. Upload a PDF resume"
echo "  4. Submit form"
echo "  5. Wait 10-15 seconds"
echo "  6. Open HR Dashboard"
echo "  7. Should see: ats_score populated ✅"
echo ""

# Step 7: Deploy
echo "🚀 Step 7: Deploy to Supabase"
echo "After testing works, run:"
echo ""
echo "  supabase functions deploy ai-assistant --project-id yupofnjbfsrqvvrtmrhi"
echo ""

# Monitoring
echo "📊 Monitoring"
echo "Check Supabase logs for:"
echo "  - 📄 Using OCR model for text extraction..."
echo "  - 🤖 Using ATS model for resume scoring..."
echo "  - ✅ ATS Analysis complete. Score: XX%"
echo ""

# Troubleshooting
echo "🔧 Troubleshooting"
echo ""
echo "OCR Service won't start:"
echo "  - Check: python3 --version"
echo "  - Check: which tesseract"
echo "  - Install: brew install tesseract"
echo ""

echo "ATS Service won't start:"
echo "  - Check: ls models/ats-cpu/"
echo "  - Should show: config.json model.safetensors tokenizer.json tokenizer_config.json"
echo "  - Check: pip list | grep torch"
echo ""

echo "Services running but no scores:"
echo "  - Check: curl http://localhost:5000/health"
echo "  - Check: curl http://localhost:5001/health"
echo "  - Check Supabase logs for errors"
echo ""

echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Your resume analysis pipeline is ready:"
echo "  1. ✅ Upload resume → Career storage"
echo "  2. ✅ Sync to HR → HR storage"
echo "  3. ✅ Extract text → OCR Service"
echo "  4. ✅ Score resume → ATS Service"
echo "  5. ✅ Save to DB → Candidates table"
echo "  6. ✅ View in UI → HR Dashboard"
echo ""
