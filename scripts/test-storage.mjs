import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env file
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      let value = rest.join('=').trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key.trim()] = value;
    }
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorageUpload() {
  console.log('🔍 Testing Supabase Storage Upload...\n');
  
  try {
    // Test 1: Check if bucket exists
    console.log('1️⃣  Checking if resumes bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('   ❌ Error listing buckets:', bucketsError);
      return;
    }
    
    const resumesBucket = buckets?.find(b => b.name === 'resumes');
    if (resumesBucket) {
      console.log('   ✅ Resumes bucket exists');
      console.log(`      Public: ${resumesBucket.public}`);
    } else {
      console.error('   ❌ Resumes bucket does not exist!');
      console.log('   📋 Available buckets:', buckets?.map(b => b.name).join(', '));
      return;
    }
    
    // Test 2: Try uploading a test file
    console.log('\n2️⃣  Testing file upload...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'This is a test file for resume upload verification';
    const testFile = new File([testContent], testFileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(`test/${testFileName}`, testFile);
    
    if (uploadError) {
      console.error('   ❌ Upload failed:', uploadError.message);
      console.error('      Error details:', uploadError);
      return;
    }
    
    console.log('   ✅ File uploaded successfully');
    console.log(`      Path: ${uploadData.path}`);
    
    // Test 3: Get public URL
    console.log('\n3️⃣  Testing public URL generation...');
    const { data: publicUrlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(`test/${testFileName}`);
    
    console.log('   ✅ Public URL generated:');
    console.log(`      ${publicUrlData.publicUrl}`);
    
    // Test 4: List files in bucket
    console.log('\n4️⃣  Listing files in resumes bucket...');
    const { data: files, error: listError } = await supabase.storage
      .from('resumes')
      .list('test');
    
    if (listError) {
      console.error('   ❌ Error listing files:', listError);
    } else {
      console.log(`   ✅ Found ${files?.length || 0} files`);
      files?.forEach(f => {
        console.log(`      • ${f.name}`);
      });
    }
    
    // Test 5: Delete test file
    console.log('\n5️⃣  Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('resumes')
      .remove([`test/${testFileName}`]);
    
    if (deleteError) {
      console.error('   ⚠️  Could not delete test file:', deleteError);
    } else {
      console.log('   ✅ Test file deleted');
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ STORAGE UPLOAD IS WORKING!\n');
    console.log('If uploads still fail in the form:');
    console.log('1. Check browser console for errors');
    console.log('2. Verify the file size is under 10MB');
    console.log('3. Try a different file format (PDF, DOC, TXT)');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testStorageUpload();
