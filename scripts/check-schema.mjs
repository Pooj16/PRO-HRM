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

async function checkSchema() {
  console.log('🔍 Checking candidates table schema...\n');
  
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('✅ Candidates table columns:');
      columns.forEach(col => {
        console.log(`   • ${col}`);
      });
      
      console.log('\n📊 Sample data (first candidate):');
      console.log(JSON.stringify(data[0], null, 2));
    }
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkSchema();
