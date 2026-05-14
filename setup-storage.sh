#!/bin/bash

# Setup storage bucket and policies via SQL in Supabase
# This script runs SQL queries directly through Supabase SQL Editor API

PROJECT_REF="yupofnjbfsrqvvrtmrhi"
ACCESS_TOKEN="<YOUR_SUPABASE_TOKEN>"

echo "🔧 Setting up storage bucket and policies..."
echo ""

# SQL to execute
SQL=$(cat <<'EOF'
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow public upload to resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update resumes" ON storage.objects;

-- Create new permissive policies for resumes bucket
CREATE POLICY "Allow public upload to resumes" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Allow public read resumes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes');

CREATE POLICY "Allow public delete resumes" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'resumes');

CREATE POLICY "Allow public update resumes" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'resumes');

-- Create the resumes bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('resumes', 'resumes', true, 10485760)
ON CONFLICT (id) DO NOTHING;
EOF
)

echo "1️⃣ Creating storage bucket..."
echo "2️⃣ Setting RLS policies..."
echo ""

# Execute via Supabase API
RESPONSE=$(curl -s -X POST \
  "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: sb_publishable_dd6w3p8NXmOsWcimbu0Z7g_CU2Z0FaM" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": $(echo "$SQL" | jq -R -s '.')}" 2>&1)

echo "Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "error"; then
  echo "⚠️ SQL execution result - check Supabase dashboard"
else
  echo "✅ Setup commands sent to Supabase"
fi

echo ""
echo "📋 Next steps:"
echo "1. Go to Supabase SQL Editor: https://app.supabase.com/project/${PROJECT_REF}/sql"
echo "2. Run the SQL from RESUME_UPLOAD_FIX.md to set policies"
echo "3. Create bucket manually: Storage → New bucket → Name: 'resumes' → Public ✓"
echo "4. Test at: http://localhost:5173/careers"
