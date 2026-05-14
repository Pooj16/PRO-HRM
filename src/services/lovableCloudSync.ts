import { supabase } from '@/integrations/supabase/client';
import { Candidate } from '@/hooks/useRealtimeData';

// Career page Supabase credentials
const CAREER_URL = 'https://ibkxiegchjjrduqbxwaz.supabase.co';
const CAREER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlia3hpZWdjaGpqcmR1cWJ4d2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMTY0MDAsImV4cCI6MjA3NDg5MjQwMH0.gxilJqvfgwRwuSpNh8tFcDbA_32cdHcO8r0Xfu0KRvo';

/**
 * Syncs candidates from external Lovable career page Supabase
 * into this HR dashboard's Supabase.
 */
// Global tracker to prevent React Strict Mode (double-firing useEffects) 
// from inserting the same candidate twice concurrently.
const globalSyncingEmails = new Set<string>();

export const syncLovableCloudToSupabase = async (): Promise<{
  synced: number;
  skipped: number;
  errors: number;
}> => {
  try {
    console.log('🔄 Syncing candidates from career page...');

    // Fetch from career page
    const careerRes = await fetch(
      `${CAREER_URL}/rest/v1/candidates?select=*&order=created_at.desc`,
      { headers: { 'apikey': CAREER_KEY, 'Authorization': `Bearer ${CAREER_KEY}` } }
    );

    if (!careerRes.ok) {
      console.warn('⚠️ Career page sync failed:', careerRes.status);
      return { synced: 0, skipped: 0, errors: 0 };
    }

    const careerCandidates = await careerRes.json();
    if (!Array.isArray(careerCandidates) || careerCandidates.length === 0) {
      console.log('No new candidates from career page');
      return { synced: 0, skipped: 0, errors: 0 };
    }

    console.log(`📥 Found ${careerCandidates.length} candidates in career page`);

    // Get existing career_ids from DB to prevent re-sync
    const { data: existing } = await supabase.from('candidates').select('career_id');
    const existingCareerIds = new Set((existing || []).map((c: any) => c.career_id).filter(Boolean));

    let synced = 0, skipped = 0, errors = 0;

    for (const c of careerCandidates) {
      const careerId = c.id;
      const email = (c.email || '').toLowerCase();

      // If it exists in the DB already, or is currently being synced by another concurrent call, skip it!
      if (existingCareerIds.has(careerId) || globalSyncingEmails.has(careerId)) {
        skipped++;
        continue;
      }

      // Claim this careerId globally so concurrent calls skip it
      globalSyncingEmails.add(careerId);

      // Track newly added careerId immediately to prevent duplicates in the same sync batch
      existingCareerIds.add(careerId);

      const { data: insertedData, error } = await supabase.from('candidates').insert({
        name: c.name,
        email: email,
        phone: c.phone || null,
        applied_role: c.applied_role || c.position || 'Not Specified',
        experience: c.experience || 'Not Specified',
        location: c.location || 'Not Specified',
        skills: c.skills || [],
        resume_url: c.resume_url || null,
        resume_text: c.resume_text || null,
        status: c.resume_text ? 'text_extracted' : 'uploaded',
        assessment_status: 'pending',
        ats_score: c.ats_score || c.ai_score || 0,
        match_percentage: c.match_percentage || 0,
        is_deleted: false,
        applied_date: c.created_at || new Date().toISOString(),
        career_id: careerId, // Store source ID for deduplication
      } as any).select().single();

      if (error) {
        errors++;
        console.warn('Sync error:', email, error.message);
      } else {
        synced++;
        console.log('✅ Synced:', c.name);

        // Auto-trigger text extraction via Supabase Edge Function
        if (insertedData && insertedData.resume_url && !insertedData.resume_text) {
          console.log(`📄 Triggering edge function extraction for: ${c.name}...`);
          try {
            const { error: extractionError } = await supabase.functions.invoke('trigger-text-extraction', {
              body: { candidateId: insertedData.id }
            });

            if (extractionError) {
              console.warn(`⚠️ Edge function extraction failed for ${c.name}:`, extractionError.message);
            } else {
              console.log(`✅ Extraction triggered successfully for ${c.name}`);
            }
          } catch (extErr) {
            console.warn(`⚠️ Could not trigger extraction for ${c.name}:`, extErr);
          }
        }
      }
    }

    console.log(`Sync: ${synced} new, ${skipped} skipped, ${errors} errors`);
    return { synced, skipped, errors };
  } catch (error) {
    console.error('Sync error:', error);
    return { synced: 0, skipped: 0, errors: 0 };
  }
};

/**
 * Fetches merged candidate list
 */
export const fetchMergedCandidates = async (): Promise<Candidate[]> => {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in fetchMergedCandidates:', error);
    return [];
  }
};
