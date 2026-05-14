import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'short' | 'open_ended' | 'coding';
  options?: { value: string; label: string }[];
  points?: number;
  saved_response?: { response_text: string; selected_option: any } | null;
}

interface SessionState {
  session_id: string;
  questions: Question[];
  current_question_index: number;
  responses: { [key: string]: any };
  time_remaining: number;
  submitted: boolean;
  saving: boolean;
  save_error: string | null;
}

export const AssessmentPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const getToken = () => {
    const fromParams = searchParams.get('token');
    if (fromParams) return fromParams;

    const parts = window.location.pathname.split('/assessment/');
    if (parts.length > 1) {
      return parts[1].split('/')[0].split('?')[0];
    }
    return null;
  };

  const token = getToken();

  const [state, setState] = useState<SessionState>({
    session_id: '',
    questions: [],
    current_question_index: 0,
    responses: {},
    time_remaining: 0,
    submitted: false,
    saving: false,
    save_error: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load questions on mount
  useEffect(() => {
    const loadQuestions = async () => {
      if (!token) {
        setError('No assessment token provided');
        setLoading(false);
        return;
      }

      try {
        const { data, error: questionsError } = await supabase.functions.invoke(
          'get-assessment-questions',
          { body: { token } }
        );

        if (questionsError || !data?.questions) {
          setError('Failed to load assessment questions');
          setLoading(false);
          return;
        }

        // Initialize responses from saved responses
        const initialResponses: { [key: string]: any } = {};
        data.questions.forEach((q: Question) => {
          if (q.saved_response) {
            initialResponses[q.id] = q.saved_response;
          }
        });

        setState(prev => ({
          ...prev,
          session_id: data.session_id,
          questions: data.questions,
          responses: initialResponses,
          time_remaining: data.duration_minutes * 60 // in seconds
        }));

        setLoading(false);
      } catch (err: any) {
        setError(String(err));
        setLoading(false);
      }
    };

    loadQuestions();
  }, [token]);

  // Timer effect: countdown and auto-submit
  useEffect(() => {
    if (state.questions.length === 0 || state.submitted) return;

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.time_remaining <= 1) {
          // Auto-submit
          handleSubmit();
          return prev;
        }
        return { ...prev, time_remaining: prev.time_remaining - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.questions.length, state.submitted]);

  // Auto-save every 10 seconds or when moving between questions
  useEffect(() => {
    if (state.saving || state.submitted || state.questions.length === 0) return;

    saveTimerRef.current = setInterval(() => {
      saveCurrentResponse();
    }, 10000);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [state.saving, state.submitted, state.responses, state.current_question_index]);

  const saveCurrentResponse = async () => {
    const currentQuestion = state.questions[state.current_question_index];
    if (!currentQuestion || !state.responses[currentQuestion.id]) return;

    setState(prev => ({ ...prev, saving: true, save_error: null }));

    try {
      const response = state.responses[currentQuestion.id];
      const { error: saveError } = await supabase.functions.invoke(
        'save-assessment-response',
        {
          body: {
            token,
            question_id: currentQuestion.id,
            response_text: response.response_text || null,
            selected_option: response.selected_option || null,
          },
        }
      );

      if (saveError) {
        setState(prev => ({ ...prev, save_error: 'Failed to save response' }));
      } else {
        setState(prev => ({ ...prev, save_error: null }));
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, save_error: String(err) }));
    } finally {
      setState(prev => ({ ...prev, saving: false }));
    }
  };

  const handleResponseChange = (value: any, fieldType: 'text' | 'option') => {
    const currentQuestion = state.questions[state.current_question_index];
    if (!currentQuestion) return;

    setState(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [currentQuestion.id]: {
          ...prev.responses[currentQuestion.id],
          [fieldType === 'text' ? 'response_text' : 'selected_option']: value,
        },
      },
    }));
  };

  const handleNext = async () => {
    await saveCurrentResponse();
    setState(prev => ({
      ...prev,
      current_question_index: Math.min(prev.current_question_index + 1, prev.questions.length - 1),
    }));
  };

  const handlePrev = async () => {
    await saveCurrentResponse();
    setState(prev => ({
      ...prev,
      current_question_index: Math.max(prev.current_question_index - 1, 0),
    }));
  };

  const handleSubmit = async () => {
    if (state.submitted) return;

    await saveCurrentResponse();

    setState(prev => ({ ...prev, submitted: true }));

    try {
      const { data, error: submitError } = await supabase.functions.invoke(
        'submit-assessment-token',
        { body: { token } }
      );

      if (submitError || !data?.success) {
        setError('Failed to submit assessment');
        setState(prev => ({ ...prev, submitted: false }));
        return;
      }

      // Navigate to confirmation page
      navigate('/assessment/confirmation', { state: { session_id: state.session_id } });
    } catch (err: any) {
      setError(String(err));
      setState(prev => ({ ...prev, submitted: false }));
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = ((state.current_question_index + 1) / state.questions.length) * 100;
  const currentQuestion = state.questions[state.current_question_index];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">Error</h1>
          <p className="text-red-700 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div>No questions available</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Question {state.current_question_index + 1} of {state.questions.length}
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full w-48">
              <div
                className="h-full bg-cyan-600 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${state.time_remaining < 300 ? 'text-red-600' : 'text-gray-600'}`}>
              <Clock className="h-5 w-5" />
              <span className="font-mono font-semibold">{formatTime(state.time_remaining)}</span>
            </div>

            {state.saving && (
              <div className="flex items-center gap-2 text-cyan-600 text-sm">
                <Save className="h-4 w-4 animate-spin" />
                Saving...
              </div>
            )}

            {state.save_error && (
              <div className="text-red-600 text-sm">Save failed</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Question */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {currentQuestion.question_text}
            </h2>
            {currentQuestion.points && (
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{currentQuestion.points} points</span>
              </p>
            )}
          </div>

          {/* Answer Input */}
          <div className="mb-8">
            {currentQuestion.question_type === 'mcq' ? (
              <div className="space-y-3">
                {currentQuestion.options?.map(option => (
                  <label
                    key={option.value}
                    className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-cyan-50 transition-colors"
                    style={{
                      borderColor:
                        state.responses[currentQuestion.id]?.selected_option?.value === option.value
                          ? '#2563eb'
                          : '#e5e7eb',
                      backgroundColor:
                        state.responses[currentQuestion.id]?.selected_option?.value === option.value
                          ? '#eff6ff'
                          : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option.value}
                      checked={state.responses[currentQuestion.id]?.selected_option?.value === option.value}
                      onChange={e => handleResponseChange({ value: e.target.value, label: option.label }, 'option')}
                      className="w-4 h-4"
                    />
                    <span className="ml-3 text-gray-900">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={state.responses[currentQuestion.id]?.response_text || ''}
                onChange={e => handleResponseChange(e.target.value, 'text')}
                placeholder="Type your answer here..."
                className="w-full h-48 p-4 border-2 border-gray-200 rounded-lg font-sans text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600"
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-8 border-t">
            <button
              onClick={handlePrev}
              disabled={state.current_question_index === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex gap-3">
              {state.current_question_index < state.questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={state.submitted}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {state.submitted ? 'Submitting...' : 'Submit Assessment'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Warning - No Refresh */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Do not refresh or navigate away</p>
          <p>Your progress is automatically saved, but refreshing may cause data loss.</p>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPage;
