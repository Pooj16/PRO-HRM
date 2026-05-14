import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function viewCandidates() {
  try {
    console.log('📊 Fetching HR Dashboard Candidate Data...\n');

    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching candidates:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No candidates found in the database.\n');
      console.log('💡 To add candidates:');
      console.log('   1. Visit http://localhost:5173/careers');
      console.log('   2. Fill out and submit the career form');
      console.log('   3. The candidate will appear in the HR Dashboard\n');
      process.exit(0);
    }

    console.log(`✅ Found ${data.length} candidate(s)\n`);
    console.log('═'.repeat(120));
    console.log('CANDIDATE DATA TABLE');
    console.log('═'.repeat(120));
    console.log('');

    // Format and display candidates
    data.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.name}`);
      console.log('   ' + '─'.repeat(110));
      console.log(`   ID:                  ${candidate.id}`);
      console.log(`   Email:               ${candidate.email}`);
      console.log(`   Phone:               ${candidate.phone || 'N/A'}`);
      console.log(`   Applied Role:        ${candidate.applied_role}`);
      console.log(`   Status:              ${candidate.status || 'N/A'}`);
      console.log(`   Pipeline Status:     ${candidate.pipeline_status || 'N/A'}`);
      console.log(`   Assessment Status:   ${candidate.assessment_status || 'N/A'}`);
      console.log(`   Experience:          ${candidate.experience || 'N/A'}`);
      console.log(`   Location:            ${candidate.location || 'N/A'}`);
      console.log(`   Skills:              ${candidate.skills ? candidate.skills.join(', ') : 'N/A'}`);
      console.log(`   ATS Score:           ${candidate.ats_score || 'N/A'}`);
      console.log(`   Match %:             ${candidate.match_percentage || 'N/A'}`);
      console.log(`   Applied Date:        ${candidate.applied_date || 'N/A'}`);
      console.log(`   Created:             ${new Date(candidate.created_at).toLocaleString()}`);
      console.log(`   Updated:             ${new Date(candidate.updated_at).toLocaleString()}`);
      if (candidate.status === 'extraction_failed') {
        console.log(`   Failure Reason:      ${candidate.resume_text?.substring(0, 200)}`);
      }
      console.log('');
    });

    console.log('═'.repeat(120));
    console.log(`\n✅ Total Candidates: ${data.length}`);
    console.log('\n📈 Summary:');

    const byStatus = data.reduce((acc: any, c: any) => {
      const status = c.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   • ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

viewCandidates();
