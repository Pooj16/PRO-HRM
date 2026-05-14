#!/usr/bin/env node

import fetch from 'node-fetch';

const PROJECT_REF = 'yupofnjbfsrqvvrtmrhi';
const SUPABASE_URL = 'https://yupofnjbfsrqvvrtmrhi.supabase.co';
const ACCESS_TOKEN = '<YOUR_SUPABASE_TOKEN>';

async function createBucket() {
  try {
    console.log('🔧 Creating resumes bucket...\n');

    // Create bucket via Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/storage/buckets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'resumes',
        public: true,
        file_size_limit: 10485760 // 10MB
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.message && data.message.includes('already exists')) {
        console.log('✅ Bucket "resumes" already exists');
      } else {
        console.error('❌ Error:', data.message || data);
      }
      return;
    }

    console.log('✅ Bucket "resumes" created successfully!');
    console.log('   - Name:', data.name);
    console.log('   - Public:', data.public);
    console.log('   - ID:', data.id);

    console.log('\n📋 Next step: Run the SQL policies in Supabase SQL Editor');
    console.log('   Go to: https://app.supabase.com/project/' + PROJECT_REF + '/sql');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createBucket();
