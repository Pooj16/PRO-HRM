
import React from 'react';
import TeamLeadDashboard from '@/components/dashboard/TeamLeadDashboard';

const TeamLeadDashboardPage = () => {
  return (
    <div className="container mx-auto py-6">
      <TeamLeadDashboard teamLeadEmail="john.smith@company.com" />
    </div>
  );
};

export default TeamLeadDashboardPage;
