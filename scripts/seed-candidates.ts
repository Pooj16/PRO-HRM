import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const testCandidates = [
  {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '+1 (555) 123-4567',
    applied_role: 'Frontend Engineer',
    experience: '5 years',
    location: 'San Francisco, CA',
    skills: ['React', 'TypeScript', 'Tailwind CSS'],
    status: 'uploaded',
    assessment_status: 'pending',
    ats_score: 85,
    match_percentage: 85,
  },
  {
    name: 'Bob Smith',
    email: 'bob@example.com',
    phone: '+1 (555) 234-5678',
    applied_role: 'Backend Engineer',
    experience: '7 years',
    location: 'New York, NY',
    skills: ['Node.js', 'PostgreSQL', 'AWS'],
    status: 'uploaded',
    assessment_status: 'pending',
    ats_score: 78,
    match_percentage: 78,
  },
  {
    name: 'Carol Williams',
    email: 'carol@example.com',
    phone: '+1 (555) 345-6789',
    applied_role: 'Full Stack Engineer',
    experience: '4 years',
    location: 'Austin, TX',
    skills: ['React', 'Node.js', 'Docker'],
    status: 'text_extracted',
    assessment_status: 'pending',
    ats_score: 82,
    match_percentage: 82,
  },
  {
    name: 'David Brown',
    email: 'david@example.com',
    phone: '+1 (555) 456-7890',
    applied_role: 'Product Manager',
    experience: '6 years',
    location: 'Seattle, WA',
    skills: ['Product Strategy', 'Analytics', 'Leadership'],
    status: 'uploaded',
    assessment_status: 'completed',
    ats_score: 90,
    match_percentage: 90,
  },
  {
    name: 'Emma Davis',
    email: 'emma@example.com',
    phone: '+1 (555) 567-8901',
    applied_role: 'UX Designer',
    experience: '3 years',
    location: 'Los Angeles, CA',
    skills: ['Figma', 'UI Design', 'User Research'],
    status: 'text_extracted',
    assessment_status: 'pending',
    ats_score: 88,
    match_percentage: 88,
  },
];

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with test candidates...');
    
    // Check existing candidates
    const { data: existing, error: checkError } = await supabase
      .from('candidates')
      .select('email');
    
    if (checkError) {
      console.error('Error checking existing candidates:', checkError);
      return;
    }
    
    const existingEmails = new Set(existing?.map(c => c.email) || []);
    
    // Filter out duplicates
    const candidatesToAdd = testCandidates.filter(c => !existingEmails.has(c.email));
    
    if (candidatesToAdd.length === 0) {
      console.log('✅ All test candidates already exist in database');
      return;
    }
    
    // Insert new candidates
    const { data, error } = await supabase
      .from('candidates')
      .insert(candidatesToAdd)
      .select();
    
    if (error) {
      console.error('Error inserting candidates:', error);
      return;
    }
    
    console.log(`✅ Successfully added ${data?.length || 0} test candidates`);
    console.log('Candidates added:');
    data?.forEach(c => {
      console.log(`  • ${c.name} (${c.email}) - ${c.applied_role}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

seedDatabase();
