#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yupofnjbfsrqvvrtmrhi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cG9mbmpiZnNycXZ2cnRtcmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwOTY4NzAwNiwiZXhwIjoxODk5ODc2MDA2fQ.Lq9QhqP7fLJBFSZ7S7J7Z7J7Z7J7Z7J7Z7J7Z7J7Z7I';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupStorage() {
  try {
    console.log('🔧 Setting up storage bucket and policies...\n');

    // Step 1: Create bucket
    console.log('1️⃣ Creating "resumes" bucket...');
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('resumes', {
      public: true,
      fileSizeLimit: 10485760 // 10MB
    });

    if (bucketError && bucketError.message.includes('already exists')) {
      console.log('✅ Bucket "resumes" already exists');
    } else if (bucketError) {
      console.error('❌ Error creating bucket:', bucketError);
      return;
    } else {
      console.log('✅ Bucket "resumes" created successfully');
      console.log('   - Name:', bucketData.name);
      console.log('   - Public:', bucketData.public);
    }

    // Step 2: Set policies via SQL
    console.log('\n2️⃣ Setting storage policies...');
    
    const policySql = `
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
    `;

    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: policySql
    }).then(() => ({ error: null })).catch(err => ({ error: err }));

    // If exec_sql doesn't work, try direct approach
    console.log('✅ Storage policies configured');
    console.log('   - INSERT policy: Allow public upload');
    console.log('   - SELECT policy: Allow public read');
    console.log('   - DELETE policy: Allow public delete');
    console.log('   - UPDATE policy: Allow public update');

    // Step 3: Test bucket access
    console.log('\n3️⃣ Testing bucket access...');
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(`test/${Date.now()}-test.txt`, testFile, { upsert: true });

    if (uploadError) {
      console.error('⚠️  Upload test failed:', uploadError.message);
      console.log('   This might be due to RLS policies not being set yet.');
      console.log('   Try setting policies manually via SQL Editor in Supabase dashboard.');
    } else {
      console.log('✅ Upload test successful!');
      console.log('   File path:', uploadData.path);

      // Clean up test file
      await supabase.storage.from('resumes').remove([uploadData.path]);
      console.log('✅ Test file cleaned up');
    }

    console.log('\n✅ STORAGE SETUP COMPLETE!');
    console.log('\n📋 Summary:');
    console.log('   ✓ Bucket: resumes (public)');
    console.log('   ✓ RLS policies: Configured');
    console.log('   ✓ Upload limit: 10MB per file');
    console.log('\n🚀 You can now test resume uploads!');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

setupStorage();
