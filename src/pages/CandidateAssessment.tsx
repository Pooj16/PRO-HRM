import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  options: any; // Can be string[] or Record<string, string>
  points: number;
  question_type?: string;
}

interface AssessmentSession {
  id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
  expires_at: string;
  auto_submitted: boolean;
  title: string;
  description: string;
  duration: number;
  difficulty: string;
  questions: Question[];
  candidateName: string;
  score?: number | null;
}

const CandidateAssessment: React.FC = () => {
  const { token: urlToken } = useParams();

  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionData, setSessionData] = useState<AssessmentSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Secure token extraction
  const getToken = () => {
    if (urlToken) return urlToken.trim();

    // Fallback 1: Manual pathname split (Handles Splat routes)
    const loc = window.location.pathname;
    if (loc.includes('/assessment/')) {
      const extractedToken = loc.split('/assessment/')[1]?.split('?')[0].replace(/\/$/, '');
      if (extractedToken) return extractedToken.trim();
    }

    // Fallback 2: Direct Search Parameter
    const searchParams = new URLSearchParams(window.location.search);
    const searchToken = searchParams.get('token') || searchParams.get('token_id');
    if (searchToken) return searchToken.trim();

    return null;
  };

  const token = getToken();

  useEffect(() => {
    if (token) {
      loadAssessmentSession();
    } else {
      setError('No assessment token provided.');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (started && timeLeft > 0 && !completed) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmit(true); // Auto-submit when time expires
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [started, timeLeft, completed]);

  const loadAssessmentSession = async () => {
    try {
      if (!token) throw new Error('No assessment token found in URL.');

      // DIAGNOSTIC START
      const diagnostics: any = { token_received: token };

      // 1. Basic session check (No joins)
      const { data: rawSession, error: rawError } = await (supabase as any)
        .from('assessment_sessions')
        .select('id, candidate_id, assessment_id')
        .eq('token', token)
        .maybeSingle();

      diagnostics.raw_session_lookup = { data: !!rawSession, error: rawError?.message };

      if (!rawSession) {
        throw new Error(`CRITICAL: Session not found for token in DB. Link might be invalid or RLS is blocking anonymous reads on 'assessment_sessions'. Details: ${JSON.stringify(diagnostics)}`);
      }

      // 2. Candidate check
      const { data: candidate, error: candidateError } = await (supabase as any)
        .from('candidates')
        .select('id, name')
        .eq('id', rawSession.candidate_id)
        .maybeSingle();

      diagnostics.candidate_lookup = { data: !!candidate, error: candidateError?.message };

      // 3. Assessment check
      const { data: assessment, error: assessmentError } = await (supabase as any)
        .from('assessments')
        .select('id, title')
        .eq('id', rawSession.assessment_id)
        .maybeSingle();

      diagnostics.assessment_lookup = { data: !!assessment, error: assessmentError?.message };

      if (!candidate || !assessment) {
        throw new Error(`RLS BLOCK: Session found, but Candidate or Assessment details are hidden from public view. Please ensure the RLS SQL migration was applied correctly. Details: ${JSON.stringify(diagnostics)}`);
      }
      // DIAGNOSTIC END

      // If we reach here, the full query SHOULD work
      const { data: session, error: sessionError } = await (supabase as any)
        .from('assessment_sessions')
        .select(`
          *,
          candidates!inner ( id, name, email ),
          assessments!inner ( id, title, description, duration, difficulty )
        `)
        .eq('token', token)
        .single();

      if (sessionError || !session) {
        throw new Error(`Assessment session not found or link is invalid. Error: ${JSON.stringify(sessionError)}`);
      }

      // Check Expiration & Status First!
      if (session.status === 'completed' || session.status === 'evaluated') {
        setSessionData({
          id: session.id,
          assessment_id: session.assessment_id,
          candidate_id: session.candidate_id,
          status: session.status,
          expires_at: session.created_at, // Placeholder
          auto_submitted: session.auto_submitted || false,
          title: session.assessments?.title || 'Assessment',
          description: session.assessments?.description || '',
          duration: session.assessments?.duration || 0,
          difficulty: session.assessments?.difficulty || '',
          questions: [],
          candidateName: session.candidates?.name || 'Candidate',
          score: session.score
        });
        setCompleted(true);
        setLoading(false);
        return;
      }

      const calculatedExpiresAt = new Date(new Date(session.created_at).getTime() + 72 * 60 * 60 * 1000).toISOString();
      if (new Date(calculatedExpiresAt).getTime() < Date.now()) {
        throw new Error('This assessment link has expired.');
      }

      // 2. Fetch Questions (Without correct_answer)
      const { data: questions, error: questionsError } = await supabase
        .from('assessment_questions')
        .select('id, question_text, options, points, question_type')
        .eq('assessment_id', session.assessment_id);

      if (questionsError) throw new Error('Failed to load assessment questions.');

      const parsedQuestions = questions.map((q) => {
        let options = q.options;
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            options = [];
          }
        }
        return {
          ...q,
          options: options || [],
        };
      });

      // Load existing answers if page refreshed
      const { data: savedResponses } = await (supabase as any)
        .from('candidate_responses')
        .select('question_id, answer_text')
        .eq('session_id', session.id);

      const loadedAnswers: Record<string, string> = {};
      if (savedResponses) {
        savedResponses.forEach(r => {
          if (r.answer_text) loadedAnswers[r.question_id] = r.answer_text;
        });
        setAnswers(loadedAnswers);
      }

      setSessionData({
        id: session.id,
        assessment_id: session.assessment_id,
        candidate_id: session.candidate_id,
        status: session.status,
        expires_at: calculatedExpiresAt,
        auto_submitted: false,
        title: session.assessments?.title || 'Spark Hire Assessment',
        description: session.assessments?.description || '',
        duration: session.assessments?.duration || 30,
        difficulty: session.assessments?.difficulty || 'intermediate',
        questions: parsedQuestions,
        candidateName: session.candidates?.name || 'Candidate',
        score: session.score
      });

      // Compute remaining time if previously started, else full duration
      let timeRemaining = (session.assessments?.duration || 30) * 60;
      if ((session as any).started_at) {
        const elapsed = Math.floor((Date.now() - new Date((session as any).started_at).getTime()) / 1000);
        timeRemaining = Math.max(0, timeRemaining - elapsed);
        if (timeRemaining > 0) {
          setStarted(true); // Resume timer immediately
        } else {
          // Time already ran out
          setCompleted(true);
          handleSubmit(true);
        }
      }
      setTimeLeft(timeRemaining);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred loading the assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!sessionData || sessionData.status !== 'pending') {
      setStarted(true);
      return;
    }

    // Mark as started in DB to lock the clock server-side
    const { error } = await (supabase as any)
      .from('assessment_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', sessionData.id);

    if (!error) {
      setStarted(true);
    } else {
      toast({ title: "Error starting assessment", variant: "destructive", description: error.message });
    }
  };

  const handleAnswerChange = async (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));

    // Auto-save logic to the secure table (Upsert allowed via insert/update RLS)
    if (!sessionData) return;

    // For upserting we first try checking if exists, or do an ON CONFLICT (id mapped differently).
    // Using standard update or insert:
    const { data: existing } = await (supabase as any).from('candidate_responses').select('id').eq('session_id', sessionData.id).eq('question_id', questionId).maybeSingle();

    if (existing) {
      await (supabase as any).from('candidate_responses').update({ answer_text: answer }).eq('id', existing.id);
    } else {
      await (supabase as any).from('candidate_responses').insert({
        session_id: sessionData.id,
        question_id: questionId,
        answer_text: answer
      });
    }
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (submitting || completed || !sessionData) return;

    setSubmitting(true);

    try {
      // Complete the session securely.
      await (supabase as any)
        .from('assessment_sessions')
        .update({
          status: 'completed',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', sessionData.id);

      // Auto-evaluate answers securely behind the scenes
      const { data: correctRefs } = await supabase
        .from('assessment_questions')
        .select('id, correct_answer, points')
        .eq('assessment_id', sessionData.assessment_id);

      let totalEarned = 0;
      let totalPossible = 0;

      if (correctRefs) {
        correctRefs.forEach((ref) => {
          const possible = ref.points || 5;
          totalPossible += possible;

          const userAnswer = (answers[ref.id] || '').toString().trim();
          const correctAnswer = (ref.correct_answer || '').toString().trim();

          if (userAnswer === correctAnswer ||
            userAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
            totalEarned += possible;
          }
        });
      }

      const rawPercentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
      const finalScore = Math.round(rawPercentage);

      console.log('--- SUBMISSION DEBUG ---');
      console.log('Session ID:', sessionData.id);
      console.log('Total Earned:', totalEarned);
      console.log('Total Possible:', totalPossible);
      console.log('Final Score:', finalScore);

      // 1. Update Assessment Session (Secure Portal)
      const { error: sessionUpdateError } = await (supabase as any).from('assessment_sessions')
        .update({
          status: 'evaluated',
          score: finalScore,
          submitted_at: new Date().toISOString()
        })
        .eq('id', sessionData.id);

      if (sessionUpdateError) console.error('Error updating assessment_sessions:', sessionUpdateError);
      else console.log('Successfully updated assessment_sessions');

      // 2. Log to Assignments (Legacy/HR View)
      const { error: assignmentUpdateError } = await (supabase as any).from('assessment_assignments')
        .update({ status: 'evaluated', score: finalScore })
        .match({
          candidate_id: sessionData.candidate_id,
          assessment_id: sessionData.assessment_id
        });

      if (assignmentUpdateError) console.error('Error updating assessment_assignments:', assignmentUpdateError);
      else console.log('Successfully updated assessment_assignments');

      // 3. Populate evaluation_results for HR Dashboard
      const { error: evalResultError } = await (supabase as any).from('evaluation_results').upsert({
        session_id: sessionData.id,
        overall_score: finalScore,
        total_possible: totalPossible,
        breakdown: JSON.stringify(correctRefs?.map(q => ({
          question_id: q.id,
          is_correct: answers[q.id] === q.correct_answer,
          points_earned: answers[q.id] === q.correct_answer ? (q.points || 5) : 0
        })))
      });

      if (evalResultError) console.error('Error upserting evaluation_results:', evalResultError);
      else console.log('Successfully upserted evaluation_results');

      // 3. Automate Interview or Reject based on >= 70% threshold
      const isPassed = finalScore >= 70;

      if (isPassed) {
        console.log('Candidate PASSED. Updating status...');
        const { error: candidateUpdateError } = await supabase.from('candidates').update({
          assessment_status: 'evaluated',
          status: 'interview_scheduled'
        }).eq('id', sessionData.candidate_id);

        if (candidateUpdateError) console.error('Error updating candidate status to interview_scheduled:', candidateUpdateError);
        else console.log('Successfully updated candidate status');

        // Check if interview already exists before scheduling
        const { data: existingInterview } = await supabase
          .from('interview_schedule')
          .select('id')
          .eq('candidate_id', sessionData.candidate_id)
          .maybeSingle();

        if (!existingInterview) {
          console.log('No existing interview found. Creating one...');
          // Add to interview pool
          const startHour = 10 + Math.floor(Math.random() * 5); // 10 AM to 3 PM
          const interviewDate = new Date();
          interviewDate.setDate(interviewDate.getDate() + 1 + Math.floor(Math.random() * 3));
          interviewDate.setHours(startHour, 0, 0, 0);

          const { error: interviewInsertError } = await supabase.from('interview_schedule').insert({
            candidate_id: sessionData.candidate_id,
            interviewer_email: 'pooja123@gmail.com',
            interview_date: interviewDate.toISOString().split('T')[0],
            interview_type: 'Technical',
            scheduled_time: interviewDate.toISOString(),
            duration_minutes: 45,
            status: 'scheduled',
            meeting_link: 'https://meet.google.com/mock-link'
          });

          if (interviewInsertError) {
            console.error('Error inserting interview_schedule:', interviewInsertError);
          } else {
            console.log('Successfully created automatic interview. Fetching ID for email...');

            // Get the ID of the newly created interview
            const { data: interviewData, error: fetchError } = await supabase
              .from('interview_schedule')
              .select('id')
              .eq('candidate_id', sessionData.candidate_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (!fetchError && interviewData) {
              console.log('Triggering email for interview:', interviewData.id);
              await supabase.functions.invoke('send-interview-invite', {
                body: {
                  candidate_id: sessionData.candidate_id,
                  interview_id: interviewData.id,
                  scheduled_time: interviewDate.toISOString(),
                  interviewer_email: 'pooja123@gmail.com',
                  duration: 45
                }
              });
            }
          }
        }
      } else {
        console.log('Candidate FAILED. Updating status to rejected...');
        // Auto Reject
        const { error: candidateRejectError } = await supabase.from('candidates').update({
          assessment_status: 'evaluated',
          status: 'rejected'
        }).eq('id', sessionData.candidate_id);

        if (candidateRejectError) console.error('Error updating candidate status to rejected:', candidateRejectError);
        else console.log('Successfully rejected candidate');
      }

      // Update local state to show score immediately
      setSessionData(prev => prev ? { ...prev, score: finalScore } : null);
      setCompleted(true);

      toast({
        title: 'Assessment Submitted Successfully',
        description: 'Thank you for completing the technical evaluation.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Submission Failed',
        description: err instanceof Error ? err.message : 'Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-700">Verifying secure token...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full shadow-lg border-red-100">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-700 text-2xl">Access Denied</CardTitle>
            <CardDescription className="text-base mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')} className="mt-4 w-full">Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    const score = sessionData?.score ?? 0;
    const isPassed = score >= 70;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className={`max-w-lg w-full shadow-lg ${isPassed ? 'border-green-100' : 'border-amber-100'}`}>
          <CardHeader className="text-center pb-2">
            <div className={`w-20 h-20 ${isPassed ? 'bg-green-100' : 'bg-amber-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isPassed ? <CheckCircle className="h-10 w-10 text-green-600" /> : <AlertCircle className="h-10 w-10 text-amber-600" />}
            </div>
            <CardTitle className={`text-2xl ${isPassed ? 'text-green-800' : 'text-amber-800'}`}>
              Assessment {isPassed ? 'Passed!' : 'Submitted'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Your responses have been successfully evaluated.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-slate-50 rounded-2xl p-6 mb-6 border border-slate-100">
              <div className="text-sm text-slate-500 uppercase font-semibold tracking-wider mb-1">Your Score</div>
              <div className={`text-5xl font-black ${isPassed ? 'text-green-600' : 'text-amber-600'}`}>
                {score}%
              </div>
              <div className="mt-4 flex justify-center">
                <Badge className={isPassed ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'}>
                  {isPassed ? 'QUALIFIED FOR INTERVIEW' : 'UNDER REVIEW'}
                </Badge>
              </div>
            </div>

            <p className="text-slate-600 mb-6">
              {isPassed
                ? "Excellent work! You've met our benchmark. Our recruitment team has been notified to schedule your technical interview."
                : "Thank you for your time. Your results have been recorded and will be reviewed by our hiring managers shortly."}
            </p>
            <Button onClick={() => window.close()} className="w-full bg-slate-900 hover:bg-slate-800 transition-all h-12 text-lg">
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionData || !sessionData.questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full shadow-lg border-yellow-200">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-yellow-700 text-2xl">Configuration Error</CardTitle>
            <CardDescription className="text-base mt-2">
              This assessment hasn't been configured with any questions yet. Please contact the administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentQ = sessionData.questions[currentQuestion];

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-2xl w-full shadow-xl">
          <CardHeader className="border-b bg-white/50 pb-6 text-center">
            <Badge className="bg-blue-100 text-blue-800 w-fit mx-auto mb-4 hover:bg-blue-200 uppercase tracking-wider">
              {sessionData.difficulty}
            </Badge>
            <CardTitle className="text-3xl font-bold text-slate-800">{sessionData.title}</CardTitle>
            <CardDescription className="text-lg mt-2 text-slate-600 max-w-lg mx-auto">
              {sessionData.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 p-4 rounded-xl border flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Clock className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium">Duration</div>
                  <div className="text-xl font-bold text-slate-800">{sessionData.duration} mins</div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm text-lg font-bold text-slate-900 w-10 h-10 flex items-center justify-center">
                  {sessionData.questions.length}
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium">Questions</div>
                  <div className="text-xl font-bold text-slate-800">Total Form</div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-8">
              <h4 className="font-semibold text-amber-800 mb-2">Important Instructions:</h4>
              <ul className="list-disc list-inside text-amber-900/80 space-y-1 text-sm">
                <li>Make sure you have a stable internet connection.</li>
                <li>The timer cannot be paused once started.</li>
                <li>Your responses are saved incrementally in real-time.</li>
                <li>The test will auto-submit when the time runs out.</li>
              </ul>
            </div>

            <Button onClick={handleStart} size="lg" className="w-full text-lg h-14 bg-cyan-600 hover:bg-blue-700">
              Start Assessment Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Ribbon */}
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex items-center justify-between sticky top-4 z-10">
          <div>
            <h1 className="font-bold text-lg text-slate-800">{sessionData.title}</h1>
            <p className="text-sm text-slate-500">Candidate: {sessionData.candidateName}</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold shadow-sm ${timeLeft < 300 ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-slate-100 text-slate-700 border'
            }`}>
            <Clock className={`h-5 w-5 ${timeLeft < 300 ? 'text-red-500' : 'text-slate-400'}`} />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Question Card */}
        <Card className="shadow-md overflow-hidden border-t-4 border-t-blue-600">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <div className="flex justify-between items-center mb-2">
              <Badge variant="outline" className="text-slate-600 uppercase tracking-widest font-semibold border-slate-300">
                Question {currentQuestion + 1} of {sessionData.questions.length}
              </Badge>
              <span className="text-sm font-medium text-slate-500">
                Points: {currentQ.points}
              </span>
            </div>
            <CardTitle className="text-xl leading-relaxed text-slate-800 mt-2">
              {currentQ.question_text}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-8 pb-8 bg-white min-h-[300px]">
            {currentQ.options ? (
              <RadioGroup
                value={answers[currentQ.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
                className="space-y-4"
              >
                {Array.isArray(currentQ.options) ? (
                  currentQ.options.map((option, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-cyan-50/50 transition-colors cursor-pointer data-[state=checked]:border-blue-600 data-[state=checked]:bg-cyan-50">
                      <RadioGroupItem value={option} id={`q${currentQ.id}-opt${index}`} className="mt-1" />
                      <Label htmlFor={`q${currentQ.id}-opt${index}`} className="text-base font-normal leading-relaxed cursor-pointer flex-1">
                        {option}
                      </Label>
                    </div>
                  ))
                ) : (
                  Object.entries(currentQ.options as Record<string, string>).map(([key, value], index) => (
                    <div key={key} className="flex items-start space-x-3 p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-cyan-50/50 transition-colors cursor-pointer data-[state=checked]:border-blue-600 data-[state=checked]:bg-cyan-50">
                      <RadioGroupItem value={key} id={`q${currentQ.id}-opt${key}`} className="mt-1" />
                      <Label htmlFor={`q${currentQ.id}-opt${key}`} className="text-base font-normal leading-relaxed cursor-pointer flex-1">
                        <span className="font-bold mr-2">{key}.</span> {value}
                      </Label>
                    </div>
                  ))
                )}
              </RadioGroup>
            ) : (
              <div className="space-y-3">
                <Label htmlFor={`q${currentQ.id}-text`} className="text-slate-500">Type your descriptive answer below:</Label>
                <Textarea
                  id={`q${currentQ.id}-text`}
                  placeholder="Provide a detailed answer..."
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                  className="min-h-[200px] text-base resize-y p-4 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
          </CardContent>

          {/* Footer Navigation Controls */}
          <div className="bg-slate-50 border-t p-4 px-8 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(curr => Math.max(0, curr - 1))}
              disabled={currentQuestion === 0}
              className="gap-2 text-slate-600 border-slate-300"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>

            <div className="flex gap-1">
              {sessionData.questions.map((_, idx) => (
                <div key={idx} className={`w-2.5 h-2.5 rounded-full ${idx === currentQuestion ? 'bg-cyan-600 scale-125' :
                  answers[sessionData.questions[idx].id] ? 'bg-green-400' : 'bg-slate-200'
                  } transition-all duration-300`} />
              ))}
            </div>

            {currentQuestion === sessionData.questions.length - 1 ? (
              <Button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Submit Assessment
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestion(curr => Math.min(sessionData.questions.length - 1, curr + 1))}
                className="gap-2 bg-cyan-600 hover:bg-blue-700"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CandidateAssessment;
