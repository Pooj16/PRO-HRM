import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';

export const AssessmentConfirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      setRedirecting(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />
        </div>

        <h1 className="text-3xl font-bold text-green-900 mb-2">
          Assessment Submitted
        </h1>

        <p className="text-gray-600 mb-8">
          Thank you for completing the assessment. Your responses have been recorded and will be evaluated by our team.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-green-800">
            <strong>What happens next?</strong> The hiring team will review your assessment within 2-3 business days. You'll receive an update via email.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Home className="h-5 w-5" />
          Return Home
        </button>

        {redirecting && (
          <p className="text-sm text-gray-600 mt-4">Redirecting...</p>
        )}
      </div>
    </div>
  );
};

export default AssessmentConfirmation;
