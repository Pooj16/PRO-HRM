/**
 * Utility functions for handling resume URLs
 * 
 * IMPORTANT: We store ONLY the file path in the database, not the full URL
 * This allows us to regenerate URLs dynamically using the current Supabase project
 * 
 * Why this approach?
 * - If the Supabase project changes, URLs don't break
 * - URLs are always generated from the correct project
 * - No coupling between database and storage URLs
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Get the public URL for a resume file stored by its path
 * @param resumePath - The file path stored in the database (e.g., "candidates/1700000-resume.pdf")
 * @returns The full public URL that can be opened in a browser or downloaded
 */
export const getResumePublicUrl = (resumePath: string | null): string | null => {
  if (!resumePath) {
    return null;
  }

  try {
    // If it's already a full URL (old data), return it as-is for backwards compatibility
    if (resumePath.startsWith('http://') || resumePath.startsWith('https://')) {
      console.warn('⚠️ Found full URL in database:', resumePath);
      console.warn('This is old data. New submissions should store only the path.');
      return resumePath;
    }

    // For paths, regenerate the full URL using the current Supabase project
    const { data } = supabase.storage
      .from('resumes')
      .getPublicUrl(resumePath);

    return data?.publicUrl || null;
  } catch (error) {
    console.error('Error generating resume URL:', error);
    return null;
  }
};

/**
 * Open a resume in a new tab
 * @param resumePath - The file path stored in the database
 * @param candidateName - Optional name for logging
 */
export const openResume = (resumePath: string | null, candidateName?: string): void => {
  if (!resumePath) {
    console.warn('No resume path provided');
    return;
  }

  const url = getResumePublicUrl(resumePath);
  if (url) {
    window.open(url, '_blank');
  } else {
    console.error('Could not generate resume URL for:', candidateName || 'candidate');
  }
};

/**
 * Download a resume file
 * @param resumePath - The file path stored in the database
 * @param candidateName - Optional name for the downloaded file
 */
export const downloadResume = async (
  resumePath: string | null,
  candidateName?: string
): Promise<void> => {
  if (!resumePath) {
    console.warn('No resume path provided');
    return;
  }

  try {
    const { data, error } = await supabase.storage
      .from('resumes')
      .download(resumePath);

    if (error) {
      console.error('Download error:', error);
      throw error;
    }

    // Create a blob URL and download
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = candidateName ? `${candidateName}-resume.pdf` : 'resume.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading resume:', error);
  }
};
