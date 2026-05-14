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
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

// Use service role key if available, otherwise use anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

async function createResumesBucket() {
  try {
    console.log('🔧 Setting up resumes storage bucket...\n');

    // List existing buckets
    console.log('1️⃣ Checking existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const existingBucket = buckets.find(b => b.name === 'resumes');
    
    if (existingBucket) {
      console.log('✅ Resumes bucket already exists');
    } else {
      console.log('❌ Resumes bucket not found. Attempting to create...');
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('resumes', {
        public: true
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        return;
      }

      console.log('✅ Resumes bucket created!');
      console.log('   - Name:', newBucket.name);
      console.log('   - Public:', newBucket.public);
    }

    console.log('\n2️⃣ Testing upload...');
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(`test/${Date.now()}-test.txt`, testFile, { upsert: true });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      return;
    }

    console.log('✅ Test file uploaded successfully!');
    console.log('   - Path:', uploadData.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(uploadData.path);

    console.log('✅ Public URL:', urlData.publicUrl);

    // Clean up
    await supabase.storage.from('resumes').remove([uploadData.path]);
    console.log('✅ Test file cleaned up');
    console.log('\n✅ Storage bucket is ready for resume uploads!');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

createResumesBucket();
