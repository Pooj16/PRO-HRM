import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UNIQUE_QUESTIONS_POOL } from "@/data/assessmentQuestions";
import { syncLovableCloudToSupabase } from '@/services/lovableCloudSync';

// Helper function to map database schema to Candidate interface
// The database uses 'position' but the app uses 'applied_role'
const mapDatabaseToCandidates = (data: any[]): Candidate[] => {
  // Sort by created_at DESC so the most recent is first
  return [...data].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).map(row => ({
    ...row,
    applied_role: row.applied_role || row.position || 'Not Specified',
    ats_score: row.ai_score !== undefined ? row.ai_score : row.ats_score
  }));
};


export interface Candidate {
  id: string;
  job_id?: string | null;
  name: string;
  email: string;
  phone?: string;
  applied_role: string;
  experience: string;
  location: string;
  skills?: string[];
  education?: string;
  salary_expectation?: number;
  resume_text?: string;
  resume_url?: string;
  ats_score?: number;
  match_percentage?: number;
  ats_notes?: string | null;
  status?: string;
  pipeline_status?: string;
  assessment_status?: string;
  bgv_status?: string;
  upload_token?: string;
  token_expiry?: string;
  education_details?: string;
  last_employer_details?: string;
  is_deleted?: boolean;
  applied_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  duration: number;
  questions: number;
  type: string;
  difficulty?: string;
  required_skills?: string[];
  pass_rate?: number;
  status: string;
  candidates_assigned: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: string;
  options?: any;
  correct_answer?: string;
  points?: number;
  created_at: string;
}

export interface CandidateAssessment {
  id: string;
  candidate_id: string;
  assessment_id: string;
  status: string;
  score?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  interviewer_email: string;
  scheduled_time: string;
  duration_minutes?: number;
  meeting_link?: string;
  notes?: string;
  status: string;
  interview_type: string;
  calendar_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RoleThreshold {
  id: string;
  role_name: string;
  min_ats_score: number;
  max_ats_score: number;
  min_assessment_score: number;
  auto_shortlist: boolean;
  team_lead_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HRUser {
  id: string;
  email: string;
  name: string;
  role: string;
  availability_days?: string[];
  availability_time?: string;
  availability_dates?: string[];
  availability_start_time?: string;
  availability_end_time?: string;
  created_at: string;
  updated_at: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  min_experience_years?: number;
  required_skills?: string[];
  education_levels?: string[];
  location_preferences?: string[];
  min_salary?: number;
  max_salary?: number;
  job_types?: string[];
  min_ats_score: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentAssignment {
  id: string;
  candidate_id: string;
  assessment_id: string;
  assigned_by?: string;
  status: string;
  score?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface ScheduledInterview {
  id: string;
  candidate_id: string;
  interviewer_email: string;
  job_role: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  calendar_event_id?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

import { useToast } from '@/hooks/use-toast';

export const useRealtimeData = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [roleThresholds, setRoleThresholds] = useState<RoleThreshold[]>([]);
  const [hrUsers, setHrUsers] = useState<HRUser[]>([]);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [assessmentAssignments, setAssessmentAssignments] = useState<AssessmentAssignment[]>([]);
  const [assessmentSessions, setAssessmentSessions] = useState<any[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<any[]>([]);
  const [verificationContacts, setVerificationContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Use ref to track subscriptions
  const subscriptionsRef = useRef<any[]>([]);

  // Function to refresh all data
  const refreshAllData = async () => {
    try {
      console.log('Refreshing all data...');

      // First, sync candidates from Lovable Cloud to Supabase
      console.log('Syncing candidates from Lovable Cloud...');
      const syncStats = await syncLovableCloudToSupabase();
      console.log('Sync stats:', syncStats);

      const [
        candidatesResult,
        assessmentsResult,
        questionsResult,
        interviewsResult,
        roleThresholdsResult,
        hrUsersResult,
        filterPresetsResult,
        assessmentAssignmentsResult,
        assessmentSessionsResult,
        evaluationResultsResult,
        verificationContactsResult
      ] = await Promise.all([
        supabase.from('candidates').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
        supabase.from('assessments').select('*').order('created_at', { ascending: false }),
        supabase.from('assessment_questions').select('*'),
        supabase.from('interview_schedule').select('*').order('scheduled_time', { ascending: true }),
        supabase.from('role_thresholds').select('*').eq('is_active', true),
        supabase.from('hr_users').select('*'),
        supabase.from('filter_presets').select('*').eq('is_active', true),
        (supabase as any).from('assessment_assignments').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('assessment_sessions').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('evaluation_results').select('*').order('created_at', { ascending: false }),
        supabase.from('bgv_verification_contacts').select('*')
      ]);

      if (candidatesResult.error) {
        console.error('Error fetching candidates:', candidatesResult.error);
      } else {
        console.log('Candidates updated:', candidatesResult.data?.length);
        setCandidates(mapDatabaseToCandidates(candidatesResult.data || []));
      }

      if (assessmentsResult.error) console.error('Error fetching assessments:', assessmentsResult.error);
      else setAssessments(assessmentsResult.data || []);

      if (questionsResult.error) console.error('Error fetching questions:', questionsResult.error);
      else setQuestions(questionsResult.data || []);

      if (interviewsResult.error) console.error('Error fetching interviews:', interviewsResult.error);
      else setInterviews(interviewsResult.data || []);

      if (roleThresholdsResult.error) console.error('Error fetching role thresholds:', roleThresholdsResult.error);
      else setRoleThresholds(roleThresholdsResult.data || []);

      if (hrUsersResult.error) console.error('Error fetching HR users:', hrUsersResult.error);
      else setHrUsers(hrUsersResult.data || []);

      if (filterPresetsResult.error) console.error('Error fetching filter presets:', filterPresetsResult.error);
      else setFilterPresets(filterPresetsResult.data || []);

      if (assessmentAssignmentsResult.error) console.error('Error fetching assessment assignments:', assessmentAssignmentsResult.error);
      else setAssessmentAssignments(assessmentAssignmentsResult.data || []);

      if (assessmentSessionsResult.error) console.error('Error fetching assessment sessions:', assessmentSessionsResult.error);
      else setAssessmentSessions(assessmentSessionsResult.data || []);

      if (evaluationResultsResult.error) console.error('Error fetching evaluation results:', evaluationResultsResult.error);
      else setEvaluationResults(evaluationResultsResult.data || []);

      if (verificationContactsResult.error) console.error('Error fetching verification contacts:', verificationContactsResult.error);
      else setVerificationContacts(verificationContactsResult.data || []);

      console.log('useRealtimeData.ts --- REFRESH COMPLETE ---');
      console.log('Candidates:', candidates.length, candidates);
      console.log('Interviews:', interviews.length, interviews);
      console.log('Sessions:', assessmentSessions.length, assessmentSessions);
      console.log('Evals:', evaluationResults.length, evaluationResults);
      console.log('Thresholds:', roleThresholds.length, roleThresholds);
      console.log('HR Users:', hrUsers.length, hrUsers);
      console.log('-------------------------');

    } catch (error) {
      console.error('Error in refreshAllData:', error);
    }
  };

  useEffect(() => {
    // Initial data fetch
    const fetchInitialData = async () => {
      setLoading(true);
      await refreshAllData();
      setLoading(false);
    };

    fetchInitialData();

    // Clean up any existing subscriptions first
    subscriptionsRef.current.forEach(subscription => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    });
    subscriptionsRef.current = [];

    // Set up real-time subscriptions with better error handling
    const candidatesChannel = supabase
      .channel(`candidates_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'candidates'
      }, (payload) => {
        console.log('Candidates real-time update:', payload);

        if (payload.eventType === 'INSERT') {
          const mappedCandidate = mapDatabaseToCandidates([payload.new])[0];
          setCandidates(prev => {
            if (prev.some(c => c.id === mappedCandidate.id)) return prev;
            return [mappedCandidate, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const mappedCandidate = mapDatabaseToCandidates([payload.new])[0];
          if (payload.new.is_deleted) {
            setCandidates(prev => prev.filter(c => c.id !== mappedCandidate.id));
          } else {
            setCandidates(prev => prev.map(candidate =>
              candidate.id === mappedCandidate.id ? mappedCandidate : candidate
            ));
          }
        } else if (payload.eventType === 'DELETE') {
          setCandidates(prev => prev.filter(candidate => candidate.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Candidates subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Candidates subscription error, will retry on next refresh');
        }
      });

    const assessmentsChannel = supabase
      .channel(`assessments_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assessments'
      }, (payload) => {
        console.log('Assessments real-time update:', payload);

        if (payload.eventType === 'INSERT') {
          setAssessments(prev => {
            if (prev.some(a => a.id === payload.new.id)) return prev;
            return [payload.new as Assessment, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setAssessments(prev => prev.map(assessment =>
            assessment.id === payload.new.id ? payload.new as Assessment : assessment
          ));
        } else if (payload.eventType === 'DELETE') {
          setAssessments(prev => prev.filter(assessment => assessment.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Assessments subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Assessments subscription error, will retry on next refresh');
        }
      });

    const assignmentsChannel = supabase
      .channel(`assignments_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assessment_assignments'
      }, (payload) => {
        console.log('Assignments real-time update:', payload);
        if (payload.eventType === 'INSERT') {
          setAssessmentAssignments(prev => [...prev, payload.new as AssessmentAssignment]);
        } else if (payload.eventType === 'UPDATE') {
          setAssessmentAssignments(prev => {
            const index = prev.findIndex(a => a.id === payload.new.id);
            if (index !== -1) {
              const next = [...prev];
              next[index] = payload.new as AssessmentAssignment;
              return next;
            }
            return [payload.new as AssessmentAssignment, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setAssessmentAssignments(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .subscribe();

    const sessionsChannel = (supabase as any)
      .channel(`sessions_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assessment_sessions'
      }, (payload: any) => {
        console.log('Sessions real-time update:', payload);
        if (payload.eventType === 'INSERT') {
          setAssessmentSessions(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setAssessmentSessions(prev => {
            const index = prev.findIndex(s => s.id === payload.new.id);
            if (index !== -1) {
              const next = [...prev];
              next[index] = payload.new;
              return next;
            }
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setAssessmentSessions(prev => prev.filter(s => s.id !== payload.old.id));
        }
      })
      .subscribe();

    const evaluationChannel = (supabase as any)
      .channel(`evaluations_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evaluation_results'
      }, (payload: any) => {
        console.log('Evaluations real-time update:', payload);
        if (payload.eventType === 'INSERT') {
          setEvaluationResults(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setEvaluationResults(prev => {
            const index = prev.findIndex(e => e.id === payload.new.id);
            if (index !== -1) {
              const next = [...prev];
              next[index] = payload.new;
              return next;
            }
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setEvaluationResults(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();
    const interviewChannel = supabase
      .channel(`interviews_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'interview_schedule'
      }, (payload) => {
        console.log('Interviews real-time update:', payload);
        if (payload.eventType === 'INSERT') {
          console.log('New interview inserted:', payload.new);
          setInterviews(prev => [...prev, payload.new as Interview]);
        } else if (payload.eventType === 'UPDATE') {
          console.log('Interview updated:', payload.new);
          setInterviews(prev => prev.map(i => i.id === payload.new.id ? payload.new as Interview : i));
        } else if (payload.eventType === 'DELETE') {
          setInterviews(prev => prev.filter(i => i.id !== payload.old.id));
        }
      })
      .subscribe();

    const hrUsersChannel = supabase
      .channel(`hr_users_realtime_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hr_users'
      }, (payload) => {
        console.log('HR Users real-time update:', payload);
        if (payload.eventType === 'INSERT') {
          setHrUsers(prev => [...prev, payload.new as HRUser]);
        } else if (payload.eventType === 'UPDATE') {
          setHrUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new as HRUser : u));
        } else if (payload.eventType === 'DELETE') {
          setHrUsers(prev => prev.filter(u => u.id !== payload.old.id));
        }
      })
      .subscribe();

    // Store subscriptions for cleanup
    subscriptionsRef.current = [
      candidatesChannel,
      assessmentsChannel,
      assignmentsChannel,
      sessionsChannel,
      evaluationChannel,
      interviewChannel,
      hrUsersChannel
    ];

    // Cleanup function
    return () => {
      subscriptionsRef.current.forEach(subscription => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      });
      subscriptionsRef.current = [];
    };
  }, []); // Empty dependency array to run only once

  // Enhanced refresh function that can be called from components
  const forceRefresh = async () => {
    console.log('Force refresh triggered');
    setLoading(true);
    await refreshAllData();
    setLoading(false);
  };

  // CRUD operations
  const addCandidate = async (candidateData: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .insert([candidateData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding candidate:', error);
      throw error;
    }
  };

  const updateCandidateStatus = async (candidateId: string, status: string, assessmentStatus?: string) => {
    try {
      const updates: any = { status };
      if (assessmentStatus) updates.assessment_status = assessmentStatus;

      const { data, error } = await supabase
        .from('candidates')
        .update(updates)
        .eq('id', candidateId)
        .select()
        .single();

      if (error) throw error;
      // If candidate was manually shortlisted, trigger assessment email flow
      try {
        if (status === 'shortlisted') {
          console.log(`Candidate ${candidateId} shortlisted — preparing to send assessment email`);

          // 1. Ensure a daily strict assignment exists
          const todayIso = new Date().toISOString().split('T')[0];
          const { data: existingAssessment } = await supabase
            .from('assessments')
            .select('id')
            .eq('status', 'active')
            .gte('created_at', todayIso)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let assessmentId = existingAssessment?.id;

          // Fallback to latest active assessment if no daily one exists
          if (!assessmentId) {
            const { data: latestAssessment } = await supabase
              .from('assessments')
              .select('id')
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            assessmentId = latestAssessment?.id;
          }

          if (assessmentId) {
            // 1. Create/Retrieve assignment
            const { data: assignmentData } = await (supabase as any)
              .from('assessment_assignments')
              .upsert({
                candidate_id: candidateId,
                assessment_id: assessmentId,
                status: 'assigned'
              }, { onConflict: 'candidate_id,assessment_id' })
              .select()
              .single();

            // 2. Fetch/Regenerate session token
            const { data: sessionData } = await (supabase as any)
              .from('assessment_sessions')
              .select('token')
              .eq('candidate_id', candidateId)
              .eq('assessment_id', assessmentId)
              .maybeSingle();

            const tokenToUse = (sessionData as any)?.token || assignmentData.id;
            const assessmentLink = `${window.location.origin}/assessment/start?token=${tokenToUse}`;

            toast({
              title: "Assessment Assigned",
              description: "Link generated for candidate",
            });

            console.log("-----------------------------------------");
            console.log(`🔗 SECURE ASSESSMENT LINK GENERATED: ${assessmentLink}`);
            console.log("-----------------------------------------");

            // Trigger email
            await supabase.functions.invoke('send-assessment-email', {
              body: { candidate_id: candidateId, assessment_id: assessmentId }
            });
          }
        }
      } catch (err) {
        console.error('Error in assessment flow:', err);
      }

      // Ensure immediate refresh
      setTimeout(() => {
        refreshAllData();
      }, 500);

      return data;
    } catch (error) {
      console.error('Error updating candidate status:', error);
      toast({
        title: "Error updating status",
        description: error instanceof Error ? error.message : "Please check your connection.",
        variant: "destructive",
      });
      return null;
    }
  };

  const analyzeResume = async (candidateId: string, resumeText: string, jobDescription?: string) => {
    try {
      console.log(`🤖 Triggering AI analysis for candidate: ${candidateId}`);
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'analyze',
          candidateId,
          resumeText,
          jobRequirements: jobDescription || ''
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Analysis failed');

      console.log('✅ AI Analysis complete:', data.result);

      // Trigger a refresh to show the new scores
      setTimeout(() => refreshAllData(), 1000);

      return data.result;
    } catch (error) {
      console.error('Error analyzing resume (falling back):', error);
      throw error;
    }
  };

  const createAssessment = async (assessmentData: {
    title: string;
    description: string;
    type: string;
    duration: number;
    difficulty?: string;
    required_skills?: string[];
  }) => {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .insert([assessmentData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  };

  const addQuestionToAssessment = async (questionData: {
    assessment_id: string;
    question_text: string;
    question_type: string;
    options?: any;
    correct_answer?: string;
    points?: number;
  }) => {
    try {
      const insertData = {
        ...questionData,
        correct_answer: questionData.correct_answer || '',
        options: questionData.options || {}
      };

      const { data, error } = await supabase
        .from('assessment_questions')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding question:', error);
      throw error;
    }
  };

  const assignAssessment = async (candidateId: string, assessmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('assessment_assignments')
        .insert([{ candidate_id: candidateId, assessment_id: assessmentId, status: 'assigned' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning assessment:', error);
      throw error;
    }
  };

  const scheduleInterview = async (interviewData: {
    candidate_id: string;
    interviewer_email: string;
    scheduled_time?: string;
    interview_type: string;
    duration_minutes?: number;
    notes?: string;
  }) => {
    try {
      // Use a mutable copy so we can override fields (e.g. email)
      let resolvedData = { ...interviewData };
      let finalScheduledTime = resolvedData.scheduled_time;

      // If no specific time is provided, find the next available slot based on HR availability
      if (!finalScheduledTime) {
        // Fetch any HR user that has availability dates set (manager or staff)
        const { data: allHrUsers } = await (supabase
          .from('hr_users')
          .select('id, email, role, availability_dates, availability_start_time, availability_end_time')
          .limit(10)
          .order('updated_at', { ascending: false }) as any);

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Pick best HR user: prefer one with email + future dates, then any with future dates, then any with dates
        const usersWithFutureDates = (allHrUsers || []).filter((u: any) =>
          (u.availability_dates || []).some((d: string) => d >= today)
        );

        const hrUser = usersWithFutureDates.find((u: any) => u.email && u.role === 'hr_manager')
          || usersWithFutureDates.find((u: any) => u.email)
          || usersWithFutureDates[0]
          || (allHrUsers || []).find((u: any) => u.availability_dates?.length > 0)
          || (allHrUsers || [])[0];

        console.log('📅 Selected HR user for scheduling:', hrUser?.email || '(no email)', 'dates:', hrUser?.availability_dates);

        // Dynamically use the HR user's email if not already set
        if (hrUser?.email && !resolvedData.interviewer_email) {
          resolvedData = { ...resolvedData, interviewer_email: hrUser.email };
        }

        // Collect all FUTURE availability dates (across all HR users as fallback)
        const futureDates = (hrUser?.availability_dates || []).filter((d: string) => d >= today);
        const availableDates = futureDates.length > 0 ? futureDates : (hrUser?.availability_dates || []);
        const startTime = hrUser?.availability_start_time || '10:00:00';
        const endTime = hrUser?.availability_end_time || '17:00:00';

        if (availableDates.length === 0) {
          throw new Error("No future availability dates set. Please update your availability in the Interviews section.");
        }

        // Sort dates to ensure we find the earliest one
        const sortedDates = [...availableDates].sort();
        let found = false;

        for (const dateStr of sortedDates) {
          const baseDate = new Date(dateStr);
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);

          // Iterate hourly slots within the window
          for (let hour = startHour; hour < endHour; hour++) {
            const slotTime = new Date(baseDate);
            slotTime.setHours(hour, 0, 0, 0);

            // Skip if slot is in the past
            if (slotTime < new Date()) continue;

            const slotIso = slotTime.toISOString();

            // Check if slot is already taken
            const { data: existing } = await supabase
              .from('interview_schedule')
              .select('id')
              .eq('scheduled_time', slotIso)
              .maybeSingle();

            if (!existing) {
              finalScheduledTime = slotIso;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          throw new Error("No available interview slots found on the selected availability dates");
        }
      }

      // Build insertData excluding columns that may not exist in live DB
      // (interview_date and interview_type were added in a local migration not yet applied to cloud)
      const { interview_type: _it, ...safeData } = resolvedData as any;
      const insertData = {
        ...safeData,
        scheduled_time: finalScheduledTime,
        status: 'scheduled'
      };

      console.log('Attempting to insert interview:', insertData);
      const { data, error } = await supabase
        .from('interview_schedule')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('CRITICAL: Insert interview_schedule failed:', error);
        throw error;
      }
      console.log('Insert interview_schedule success:', data);

      // Update candidate status to reflect interview is scheduled
      await supabase
        .from('candidates')
        .update({ status: 'interview_scheduled' })
        .eq('id', resolvedData.candidate_id);

      // Trigger email notification via edge function
      try {
        await supabase.functions.invoke('send-interview-invite', {
          body: {
            candidate_id: resolvedData.candidate_id,
            interview_id: data.id,
            scheduled_time: finalScheduledTime,
            interviewer_email: resolvedData.interviewer_email,
            duration: resolvedData.duration_minutes || 60
          }
        });
      } catch (emailErr) {
        console.warn('Failed to send interview invite email via edge function:', emailErr);
      }

      refreshAllData();
      return data;
    } catch (error) {
      console.error('Error scheduling interview:', error);
      throw error;
    }
  };
  const autoScheduleAllQualified = async () => {
    console.log('--- Auto-Schedule Debug ---');
    console.log('Initial Candidates:', candidates.length);
    // STRICT FILTER: Only based on technical assessment score meeting role threshold
    const qualified = candidates.filter(c => {
      // 1. Skip if already scheduled or rejected
      if (c.status === 'interview_scheduled' || c.status === 'rejected') return false;

      // 2. Locate score from various possible fields
      const assessmentScore = (c as any).assessment_score ?? (c as any).overall_score ?? (c as any).technical_score ?? 0;

      // 3. Check threshold for their specific role
      const threshold = roleThresholds.find(rt => rt.role_name === c.applied_role);
      const minRequired = threshold?.min_assessment_score ?? 70; // 70 is standard if no specific threshold set

      const hasPassed = assessmentScore >= minRequired && assessmentScore > 0;

      if (hasPassed) {
        console.log(`[QUALIFIED] ${c.name} passed with score ${assessmentScore}/${minRequired}`);
      }
      return hasPassed;
    });

    console.log('Qualified count:', qualified.length);
    if (qualified.length === 0) {
      console.log('No qualified candidates found for auto-scheduling');
      return 0;
    }

    let count = 0;
    for (const candidate of qualified) {
      try {
        await scheduleInterview({
          candidate_id: candidate.id,
          interviewer_email: "pooja123@gmail.com", // Default HR manager email
          interview_type: "Technical Round",
          duration_minutes: 45,
          notes: "Automated batch scheduling."
        });
        count++;
      } catch (err) {
        console.error(`Failed to auto-schedule ${candidate.name}:`, err);
      }
    }
    refreshAllData();
    return count;
  };


  const updateRoleThreshold = async (id: string, thresholdData: Partial<RoleThreshold>) => {
    try {
      const { data, error } = await supabase
        .from('role_thresholds')
        .update(thresholdData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating role threshold:', error);
      throw error;
    }
  };

  // New CRUD operations for the additional functionality
  const uploadResume = async (candidateId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `resumes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('candidates')
        .update({
          resume_file_path: filePath,
          resume_file_name: file.name,
          resume_uploaded_at: new Date().toISOString(),
          status: 'resume_uploaded'
        })
        .eq('id', candidateId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading resume:', error);
      throw error;
    }
  };

  const scheduleGoogleCalendarInterview = async (interviewData: {
    candidate_id: string;
    interviewer_email: string;
    job_role: string;
    start_time: string;
    end_time: string;
    candidate_email: string;
    candidate_name: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-integration', {
        body: {
          action: 'schedule',
          candidateId: interviewData.candidate_id,
          interviewData: {
            startTime: interviewData.start_time,
            endTime: interviewData.end_time,
            candidateEmail: interviewData.candidate_email,
            candidateName: interviewData.candidate_name,
            jobRole: interviewData.job_role,
            interviewerEmail: interviewData.interviewer_email
          },
          accessToken: 'demo_token' // In real app, get from HR user profile
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error scheduling Google Calendar interview:', error);
      throw error;
    }
  };

  const assignAssessmentToCandidate = async (candidateId: string, assessmentId: string) => {
    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('assessment_assignments')
        .select('id')
        .eq('candidate_id', candidateId)
        .eq('assessment_id', assessmentId)
        .maybeSingle();

      if (existing) return existing; // Already assigned, don't duplicate

      const { data, error } = await supabase
        .from('assessment_assignments')
        .insert({
          candidate_id: candidateId,
          assessment_id: assessmentId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning assessment:', error);
      throw error;
    }
  };

  return {
    candidates,
    assessments,
    questions,
    interviews,
    roleThresholds,
    hrUsers,
    filterPresets,
    assessmentAssignments,
    assessmentSessions,
    evaluationResults,
    verificationContacts,
    loading,
    addCandidate,
    updateCandidateStatus,
    analyzeResume,
    createAssessment,
    addQuestionToAssessment,
    assignAssessment,
    scheduleInterview,
    updateRoleThreshold,
    uploadResume,
    scheduleGoogleCalendarInterview,
    assignAssessmentToCandidate,
    autoScheduleAllQualified,
    forceRefresh: refreshAllData
  };
};
