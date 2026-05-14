import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AssessmentLanding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);

  const getToken = () => {
    const fromParams = searchParams.get('token');
    if (fromParams) return fromParams;

    // Fallback: extract from path /assessment/TOKEN
    const parts = window.location.pathname.split('/assessment/');
    if (parts.length > 1) {
      return parts[1].split('/')[0].split('?')[0];
    }
    return null;
  };

  const token = getToken();

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No assessment token provided');
        setLoading(false);
        return;
      }

      try {
        // Validate token and get session metadata
        const { data, error: validateError } = await supabase.functions.invoke(
          'validate-assessment-token',
          { body: { token, action: 'start' } }
        );

        if (validateError || !data?.valid) {
          setError(data?.error || 'Invalid or expired assessment link');
          setLoading(false);
          return;
        }

        setSession(data.session);

        // Fetch assessment details
        const { data: assessmentData, error: assessmentError } = await supabase
          .from('assessments')
          .select('id, title, description, duration, questions')
          .eq('id', data.session.assessment_id)
          .single();

        if (assessmentError) {
          setError('Failed to load assessment details');
          setLoading(false);
          return;
        }

        setAssessment(assessmentData);
        setLoading(false);
      } catch (err: any) {
        setError(String(err));
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleStartAssessment = () => {
    navigate(`/assessment/test?token=${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating your assessment link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">Assessment Unavailable</h1>
          <p className="text-red-700 mb-6">{error}</p>
          <p className="text-sm text-gray-600">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    );
  }

  const expiryTime = new Date(session?.token_expires_at);
  const hoursRemaining = Math.floor((expiryTime.getTime() - Date.now()) / (1000 * 60 * 60));

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-2xl mx-auto py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to Your Assessment
          </h1>
          <p className="text-xl text-gray-600">
            You're one step closer to the next opportunity
          </p>
        </div>

        {/* Assessment Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {assessment?.title || 'Technical Assessment'}
            </h2>
            <p className="text-gray-600">
              {assessment?.description || 'Please complete this assessment to proceed in the hiring process.'}
            </p>
          </div>

          {/* Assessment Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8 py-6 border-y border-gray-200">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-cyan-600" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-semibold text-gray-900">{assessment?.duration || 30} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-cyan-600" />
              <div>
                <p className="text-sm text-gray-600">Questions</p>
                <p className="font-semibold text-gray-900">{assessment?.questions || 10}</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Before You Start</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span className="text-cyan-600 font-bold mt-0.5">✓</span>
                <span>Make sure you have a stable internet connection</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-600 font-bold mt-0.5">✓</span>
                <span>Find a quiet place where you won't be interrupted</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-600 font-bold mt-0.5">✓</span>
                <span>Do NOT refresh the page or navigate away</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-600 font-bold mt-0.5">✓</span>
                <span>You have only ONE attempt to complete this assessment</span>
              </li>
            </ul>
          </div>

          {/* Deadline Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-amber-800">
            <p className="font-semibold mb-1">⏰ Time Limit</p>
            <p>This link expires in <strong>{Math.max(hoursRemaining, 0)} hours</strong>. Please complete your assessment before then.</p>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartAssessment}
            className="w-full bg-cyan-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Start Assessment Now
          </button>

          <p className="text-center text-sm text-gray-600 mt-4">
            By starting, you accept the assessment terms
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>Questions? <a href="mailto:support@example.com" className="text-cyan-600 hover:underline">Contact support</a></p>
        </div>
      </div>
    </div>
  );
};

export default AssessmentLanding;
