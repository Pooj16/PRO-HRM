#!/bin/bash

# Deploy all Edge Functions to Supabase project
# Usage: ./deploy-functions.sh <ACCESS_TOKEN>

if [ -z "$1" ]; then
  echo "❌ Error: Supabase access token required"
  echo ""
  echo "Usage: ./deploy-functions.sh <ACCESS_TOKEN>"
  echo ""
  echo "How to get your access token:"
  echo "1. Go to: https://app.supabase.com/account/tokens"
  echo "2. Create a new personal access token"
  echo "3. Copy the token"
  echo "4. Run: ./deploy-functions.sh <token>"
  exit 1
fi

ACCESS_TOKEN="$1"
PROJECT_REF="yupofnjbfsrqvvrtmrhi"

echo "🚀 Deploying Edge Functions to project: $PROJECT_REF"
echo ""

# Set the access token
export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"

# Deploy all functions
cd /Users/poojashivakumar16/Downloads/spark-hire-smart-c233f1fc-main

echo "📦 Deploying functions..."
supabase functions deploy --project-ref "$PROJECT_REF" 2>&1

echo ""
echo "✅ Done!"
echo ""
echo "You can now:"
echo "1. Check functions in Supabase dashboard: https://app.supabase.com/project/$PROJECT_REF/functions"
echo "2. Test resume upload at: http://localhost:5173/careers"
