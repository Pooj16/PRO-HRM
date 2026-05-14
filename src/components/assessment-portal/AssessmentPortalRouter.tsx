import React from 'react';
import { useLocation } from 'react-router-dom';
import AssessmentLanding from './AssessmentLanding';
import AssessmentPage from './AssessmentPage';
import AssessmentConfirmation from './AssessmentConfirmation';

/**
 * Assessment Portal Router
 * 
 * Routes (nested under /assessment/*):
 * - /assessment/start?token=<secure-token>   → AssessmentLanding
 * - /assessment/test?token=<secure-token>    → AssessmentPage
 * - /assessment/confirmation                 → AssessmentConfirmation
 * - /assessment/<token>                      → AssessmentLanding (fallback)
 */

export const AssessmentPortalRouter = () => {
  const location = useLocation();
  const pathname = location.pathname;

  if (pathname.includes('/test')) {
    return <AssessmentPage />;
  }

  if (pathname.includes('/confirmation')) {
    return <AssessmentConfirmation />;
  }

  // Default: landing page for /assessment, /assessment/start, /assessment/<token>
  return <AssessmentLanding />;
};

export default AssessmentPortalRouter;
