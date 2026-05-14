/**
 * Helper hook to add sample candidate data for testing
 * Usage: const { addSampleData } = useSampleData();
 */

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SAMPLE_CANDIDATES = [
  {
    name: 'Alice Johnson',
    email: 'alice.johnson@example.com',
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
    email: 'bob.smith@example.com',
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
    email: 'carol.williams@example.com',
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
    email: 'david.brown@example.com',
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
    email: 'emma.davis@example.com',
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

export const useSampleData = () => {
  const { toast } = useToast();

  const addSampleCandidates = async () => {
    try {
      // Check existing candidates
      const { data: existing } = await supabase
        .from('candidates')
        .select('email');

      const existingEmails = new Set(existing?.map(c => c.email) || []);

      // Filter out duplicates
      const candidatesToAdd = SAMPLE_CANDIDATES.filter(
        c => !existingEmails.has(c.email)
      );

      if (candidatesToAdd.length === 0) {
        toast({
          title: "Sample Data Already Added",
          description: "All sample candidates are already in the database.",
        });
        return;
      }

      // Insert new candidates
      const { data, error } = await supabase
        .from('candidates')
        .insert(candidatesToAdd)
        .select();

      if (error) throw error;

      toast({
        title: "Sample Data Added",
        description: `Added ${data?.length || 0} sample candidates to the database.`,
      });

      return data;
    } catch (error) {
      console.error('Error adding sample candidates:', error);
      toast({
        title: "Error",
        description: "Failed to add sample candidates.",
        variant: "destructive",
      });
    }
  };

  return {
    addSampleCandidates,
    sampleCandidateCount: SAMPLE_CANDIDATES.length,
  };
};
