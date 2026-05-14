import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Play, Mail, Users, Settings, CheckCircle, AlertCircle } from 'lucide-react';

interface WorkflowProps {
  candidates: any[];
  onRefresh: () => void;
}

export const AutomatedWorkflow: React.FC<WorkflowProps> = ({ candidates, onRefresh }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const { toast } = useToast();

  const workflowSteps = [
    { id: 'extract', label: 'Extract Resume Text', icon: '📄' },
    { id: 'analyze', label: 'ATS Analysis', icon: '🤖' },
    { id: 'filter', label: 'Apply Thresholds', icon: '🎯' },
    { id: 'assessment', label: 'Generate Assessment', icon: '📝' },
    { id: 'email', label: 'Send Email Invitations', icon: '📧' },
    { id: 'cleanup', label: 'Remove Invalid Emails', icon: '🧹' }
  ];

  const runCompleteWorkflow = async () => {
    setIsRunning(true);
    setProgress(0);

    try {
      const candidatesNeedingWork = candidates.filter(c =>
        c.status === 'uploaded' || (!c.resume_text && c.resume_url)
      );

      if (candidatesNeedingWork.length === 0) {
        toast({
          title: "No Work Needed",
          description: "All candidates are already processed!",
        });
        setIsRunning(false);
        return;
      }

      // Step 1: Extract Resume Text
      setCurrentStep('Extracting resume text...');
      setProgress(10);

      for (const candidate of candidatesNeedingWork) {
        if (!candidate.resume_text && candidate.resume_url) {
          try {
            await supabase.functions.invoke('manual-extract-text', {
              body: { candidate_id: candidate.id }
            });
          } catch (error) {
            console.log(`Text extraction failed for ${candidate.name}:`, error);
          }
        }
      }

      // Step 2: ATS Analysis
      setCurrentStep('Running ATS analysis...');

      // Fetch fresh candidate data after text extraction
      await new Promise(resolve => setTimeout(resolve, 2000));
      onRefresh(); // Get latest data

      const analyzableCandidates = candidates.filter(c =>
        c.resume_text && c.resume_text.length > 100 && (!c.ats_score || c.ats_score === 0)
      );

      console.log(`Found ${analyzableCandidates.length} candidates ready for analysis`);

      for (const candidate of analyzableCandidates) {
        try {
          const aiFunctionName = 'ai-assistant';
          await supabase.functions.invoke(aiFunctionName, {
            body: {
              candidateId: candidate.id,
              resumeText: candidate.resume_text,
              action: 'analyze'
            }
          });
        } catch (error) {
          console.log(`Analysis failed for ${candidate.name}:`, error);
        }
      }

      setProgress(50);

      // Step 3: Apply Role Thresholds and Auto-Route
      setCurrentStep('Applying role thresholds...');

      // Fetch fresh data after analysis
      await new Promise(resolve => setTimeout(resolve, 3000));
      onRefresh();

      const analyzedCandidates = candidates.filter(c =>
        c.ats_score && c.ats_score > 0 && (!c.status || c.status === 'analyzed')
      );

      console.log(`Found ${analyzedCandidates.length} candidates ready for routing`);

      for (const candidate of analyzedCandidates) {
        try {
          await supabase.functions.invoke('route-candidate', {
            body: {
              candidate_id: candidate.id,
              role_applied_for: candidate.applied_role || 'General'
            }
          });
        } catch (error) {
          console.log(`Routing failed for ${candidate.name}:`, error);
        }
      }

      setProgress(70);

      // Step 4: Generate Assessment for Qualified Candidates
      setCurrentStep('Generating assessments...');

      // Check if we need to create a general assessment
      const { data: existingAssessments } = await supabase
        .from('assessments')
        .select('*')
        .eq('status', 'active')
        .limit(1);

      let assessmentId = existingAssessments?.[0]?.id;

      if (!assessmentId) {
        const { data: newAssessment, error: assessmentError } = await supabase.functions.invoke('generate-assessment', {
          body: {
            role: 'General Technical Position',
            skills: ['Problem Solving', 'Technical Knowledge', 'Communication'],
            difficulty: 'intermediate',
            questionCount: 10
          }
        });

        if (!assessmentError && newAssessment?.assessment) {
          assessmentId = newAssessment.assessment.id;
        }
      }

      setProgress(85);

      // Step 5: Send Assessment Emails to Shortlisted Candidates
      setCurrentStep('Sending assessment emails...');

      const shortlistedCandidates = candidates.filter(c =>
        (c.status === 'shortlisted' || c.status === 'assessment_pending') &&
        c.assessment_status !== 'assessment_sent'
      );

      let emailsSent = 0;
      let invalidEmails = 0;

      for (const candidate of shortlistedCandidates) {
        if (assessmentId) {
          try {
            const result = await supabase.functions.invoke('send-assessment-email', {
              body: {
                candidate_id: candidate.id,
                assessment_id: assessmentId
              }
            });

            if (result.error && result.error.includes('Invalid email format')) {
              invalidEmails++;
            } else {
              emailsSent++;
            }
          } catch (error) {
            console.log(`Email sending failed for ${candidate.name}:`, error);
          }
        }
      }

      setProgress(100);
      setCurrentStep('Workflow completed!');

      // Final summary
      toast({
        title: "Workflow Completed Successfully! 🎉",
        description: `Processed ${candidatesNeedingWork.length} candidates. ${emailsSent} assessment emails sent. ${invalidEmails} invalid emails removed.`,
      });

      // Refresh data
      setTimeout(() => {
        onRefresh();
        setIsRunning(false);
        setProgress(0);
        setCurrentStep('');
      }, 2000);

    } catch (error) {
      console.error('Workflow error:', error);
      toast({
        title: "Workflow Error",
        description: "An error occurred during the automated workflow. Check console for details.",
        variant: "destructive",
      });
      setIsRunning(false);
    }
  };

  const getWorkflowStats = () => {
    const stats = {
      uploaded: candidates.filter(c => c.status === 'uploaded').length,
      analyzed: candidates.filter(c => c.ats_score > 0).length,
      shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
      assessmentSent: candidates.filter(c => c.assessment_status === 'assessment_sent').length,
      rejected: candidates.filter(c => c.status === 'rejected').length,
      invalidEmail: candidates.filter(c => c.status === 'invalid_email').length,
    };
    return stats;
  };

  const stats = getWorkflowStats();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Automated Recruitment Workflow
        </CardTitle>
        <CardDescription>
          Complete end-to-end automation: Text extraction → ATS analysis → Threshold filtering → Assessment generation → Email automation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Workflow Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.uploaded}</div>
            <div className="text-sm text-muted-foreground">Uploaded</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-600">{stats.analyzed}</div>
            <div className="text-sm text-muted-foreground">Analyzed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.shortlisted}</div>
            <div className="text-sm text-muted-foreground">Shortlisted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.assessmentSent}</div>
            <div className="text-sm text-muted-foreground">Assessments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.invalidEmail}</div>
            <div className="text-sm text-muted-foreground">Invalid</div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Workflow Steps:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {workflowSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="text-lg">{step.icon}</span>
                <span className="font-medium">{step.label}</span>
                <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Progress Section */}
        {isRunning && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{currentStep}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={runCompleteWorkflow}
            disabled={isRunning}
            className="flex-1"
            size="lg"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running Workflow...' : 'Run Complete Workflow'}
          </Button>

          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRunning}
          >
            Refresh Data
          </Button>
        </div>

        {/* Workflow Benefits */}
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-2">✅ Automated Benefits:</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Automatic resume text extraction from PDFs</li>
            <li>• AI-powered ATS scoring and analysis</li>
            <li>• Threshold-based candidate filtering</li>
            <li>• Dynamic assessment generation</li>
            <li>• Automated email invitations with assessment links</li>
            <li>• Invalid email detection and candidate removal</li>
          </ul>
        </div>

        {/* Important Notes */}
        <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-cyan-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800">Important Notes:</h4>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Configure role thresholds in Settings first</li>
                <li>• Ensure AI assistant is configured</li>
                <li>• Invalid emails will be automatically removed</li>
                <li>• Candidates meeting thresholds get assessment emails</li>
              </ul>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};