#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory of current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('VITE_SUPABASE_URL:', SUPABASE_URL);
  console.error('VITE_SUPABASE_PUBLISHABLE_KEY:', SUPABASE_ANON_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixStorage() {
  try {
    console.log('🔍 Checking storage configuration...\n');

    // Test 1: List buckets
    console.log('1️⃣ Listing buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }

    console.log('✅ Buckets found:', buckets.map(b => b.name).join(', '));
    
    const resumesBucket = buckets.find(b => b.name === 'resumes');
    if (!resumesBucket) {
      console.error('❌ Resumes bucket NOT found!');
      return;
    }

    console.log('✅ Resumes bucket exists');
    console.log('   - Public:', resumesBucket.public);
    console.log('   - ID:', resumesBucket.id);

    // Test 2: Try uploading a test file
    console.log('\n2️⃣ Testing file upload...');
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(`test/${Date.now()}-test.txt`, testFile, { upsert: true });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      console.error('   Error code:', uploadError.code);
      console.error('   Full error:', JSON.stringify(uploadError, null, 2));
      return;
    }

    console.log('✅ File uploaded successfully!');
    console.log('   - Path:', uploadData.path);
    console.log('   - Full path:', uploadData.fullPath);

    // Test 3: Get public URL
    console.log('\n3️⃣ Getting public URL...');
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(uploadData.path);

    console.log('✅ Public URL:', urlData.publicUrl);

    // Test 4: List files
    console.log('\n4️⃣ Listing files in resumes bucket...');
    const { data: files, error: listError } = await supabase.storage
      .from('resumes')
      .list('test');

    if (listError) {
      console.error('❌ Error listing files:', listError);
    } else {
      console.log('✅ Files found:', files.length);
      files.forEach(f => console.log('   -', f.name));
    }

    // Test 5: Clean up
    console.log('\n5️⃣ Cleaning up test files...');
    const { error: deleteError } = await supabase.storage
      .from('resumes')
      .remove([uploadData.path]);

    if (deleteError) {
      console.error('❌ Error deleting test file:', deleteError);
    } else {
      console.log('✅ Test file deleted');
    }

    console.log('\n✅ All storage tests passed! Resume uploads should work now.');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

fixStorage();
