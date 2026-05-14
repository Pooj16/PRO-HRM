
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Eye, Plus, Settings, Users, FileText, Zap, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AssessmentQuestionViewer from './AssessmentQuestionViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UNIQUE_QUESTIONS_POOL } from '@/data/assessmentQuestions';

const AssessmentsList = () => {
  const {
    assessments,
    assessmentAssignments,
    assessmentSessions,
    evaluationResults,
    candidates,
    forceRefresh
  } = useRealtimeData();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedAssessmentTitle, setSelectedAssessmentTitle] = useState<string>('');
  const [creatingGeneral, setCreatingGeneral] = useState(false);
  const { toast } = useToast();

  // Removed auto-creation - was causing infinite loop due to title mismatch
  // Users can manually create assessments using the button

  const handleCreateGeneralAssessment = async () => {
    if (creatingGeneral) return;

    setCreatingGeneral(true);
    try {
      // Create assessment directly in Supabase
      const { data: assessment, error } = await supabase
        .from('assessments')
        .insert({
          title: 'General Technical & Aptitude Assessment',
          description: 'A 30-question timed evaluation testing Programming and Hard-level Aptitude.',
          duration: 20,
          questions: 30,
          type: 'technical',
          difficulty: 'hard',
          status: 'active',
          candidates_assigned: 0,
          completion_rate: 0,
          created_by: null,
        })
        .select()
        .single();

      if (error) throw error;

      const assessmentQuestions = UNIQUE_QUESTIONS_POOL.map((template, i) => ({
        assessment_id: assessment.id,
        question_text: `Q${i + 1}: ${template.q}`,
        question_type: 'mcq',
        options: JSON.stringify(template.o),
        correct_answer: template.ans,
        points: template.points
      }));

      await supabase.from('assessment_questions').insert(assessmentQuestions);

      toast({
        title: "✅ Assessment Created",
        description: "General Technical Assessment with 30 unique questions is now active"
      });

      await forceRefresh();

    } catch (error) {
      console.error('Error creating assessment:', error);
      toast({
        title: "Error",
        description: "Failed to create assessment: " + (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setCreatingGeneral(false);
    }
  };

  const handleAssignToAll = async (assessmentId: string) => {
    const shortlistedCandidates = candidates.filter(c =>
      (c.status === 'shortlisted' || c.status === 'assessment_pending' || c.status === 'analyzed' || (c.ats_score && c.ats_score >= 70)) &&
      !assessmentAssignments.some(aa => aa.candidate_id === c.id && aa.assessment_id === assessmentId)
    );

    if (shortlistedCandidates.length === 0) {
      toast({
        title: "No candidates to assign",
        description: "All eligible candidates are already assigned to this assessment.",
      });
      return;
    }

    try {
      toast({
        title: "Assigning...",
        description: `Assigning to ${shortlistedCandidates.length} candidates.`,
      });

      for (const candidate of shortlistedCandidates) {
        // Trigger Email via Edge Function - This handles session creation and assignment updates
        await supabase.functions.invoke('send-assessment-email', {
          body: {
            candidate_id: candidate.id,
            assessment_id: assessmentId
          }
        });
      }

      toast({
        title: "Success",
        description: `Assigned assessment to ${shortlistedCandidates.length} candidates.`,
      });
      forceRefresh();
    } catch (err: any) {
      console.error('Error in handleAssignToAll:', err);
      toast({
        title: "Assignment error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteAssessment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment? All associated sessions and results will be lost.')) return;

    try {
      const { error } = await supabase.from('assessments').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Assessment deleted",
        description: "The assessment has been successfully removed.",
      });
      forceRefresh();
    } catch (err: any) {
      toast({
        title: "Delete error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      inactive: { color: 'bg-red-100 text-red-800', label: 'Inactive' },
      // Session statuses
      pending: { color: 'bg-amber-100 text-amber-800', label: 'Pending' },
      in_progress: { color: 'bg-blue-100 text-blue-800', label: 'In Progress' },
      submitted: { color: 'bg-purple-100 text-purple-800', label: 'Submitted' },
      completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      evaluated: { color: 'bg-slate-200 text-indigo-800', label: 'Evaluated' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getDifficultyBadge = (difficulty: string) => {
    const difficultyConfig: Record<string, { color: string; label: string }> = {
      easy: { color: 'bg-green-100 text-green-800', label: 'Easy' },
      intermediate: { color: 'bg-yellow-100 text-yellow-800', label: 'Intermediate' },
      hard: { color: 'bg-red-100 text-red-800', label: 'Hard' }
    };

    const config = difficultyConfig[difficulty] || { color: 'bg-gray-100 text-gray-800', label: difficulty };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleViewQuestions = (assessmentId: string, title: string) => {
    setSelectedAssessmentId(assessmentId);
    setSelectedAssessmentTitle(title);
  };

  if (selectedAssessmentId) {
    return (
      <AssessmentQuestionViewer
        assessmentId={selectedAssessmentId}
        assessmentTitle={selectedAssessmentTitle}
        onClose={() => {
          setSelectedAssessmentId(null);
          setSelectedAssessmentTitle('');
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg text-slate-900">Managing Your Assessments</CardTitle>
              <CardDescription>
                Design the evaluations that help you find your next great teammate.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateGeneralAssessment}
                disabled={creatingGeneral}
                variant="outline"
              >
                {creatingGeneral ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Create General Assessment
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Assessment
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Assessments Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Statistics</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => {
                  const assignments = assessmentAssignments.filter(aa => aa.assessment_id === assessment.id);
                  const sessions = (assessmentSessions as any[]).filter(s => s.assessment_id === assessment.id && s.status === 'completed');
                  const completionRate = assignments.length > 0
                    ? Math.round((sessions.length / assignments.length) * 100)
                    : 0;

                  return (
                    <TableRow key={assessment.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                      <TableCell>
                        <div>
                          <div className="font-medium">{assessment.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {assessment.description?.substring(0, 50)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{assessment.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {assessment.questions || 0}
                        </div>
                      </TableCell>
                      <TableCell>{assessment.duration} min</TableCell>
                      <TableCell>
                        {assessment.difficulty && getDifficultyBadge(assessment.difficulty)}
                      </TableCell>
                      <TableCell>{getStatusBadge(assessment.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {assignments.length} assigned
                          </div>
                          <div className="font-medium text-cyan-600">
                            {completionRate}% completion
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assessment.created_at &&
                          formatDistanceToNow(new Date(assessment.created_at), { addSuffix: true })
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            title="View Questions"
                            onClick={() => handleViewQuestions(assessment.id, assessment.title)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Assign to All Shortlisted"
                            onClick={() => handleAssignToAll(assessment.id)}
                            className="text-primary hover:text-primary"
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Delete Assessment"
                            onClick={() => handleDeleteAssessment(assessment.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {assessments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">It's a clean slate — ready to design your first assessment?</p>
              <Button
                className="mt-4"
                onClick={handleCreateGeneralAssessment}
                disabled={creatingGeneral}
              >
                {creatingGeneral ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Your First Assessment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Finished Evaluations</CardTitle>
          <CardDescription>
            View final evaluated scores independently graded by the system after test submission or timeout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Assessment Status</TableHead>
                  <TableHead>Final Score</TableHead>
                  <TableHead>Completed Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* We map from assessmentSessions to ensure we have the candidate_id for joins */}
                {/* Group results by candidate email to prevent duplicates */}
                {(() => {
                  const sessions = (assessmentSessions as any[]);
                  if (sessions.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                          Nothing here yet — results appear once candidates finish their tests.
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Group sessions by candidate email
                  const groups: Record<string, {
                    candidate: any;
                    bestSession: any;
                    bestEvaluation: any;
                    bestAssignment: any;
                  }> = {};

                  sessions.forEach(session => {
                    const candidate = (candidates as any[]).find(c => c.id === session.candidate_id);
                    if (!candidate) return;

                    const email = candidate.email?.toLowerCase();
                    if (!email) return;

                    const evaluation = (evaluationResults as any[]).find(er => er.session_id === session.id);
                    const assignment = assessmentAssignments.find(aa =>
                      aa.candidate_id === session.candidate_id &&
                      aa.assessment_id === session.assessment_id
                    );

                    // If we haven't seen this email, or this session is "better" (completed > other)
                    if (!groups[email] || (session.status === 'completed' && groups[email].bestSession.status !== 'completed')) {
                      groups[email] = {
                        candidate,
                        bestSession: session,
                        bestEvaluation: evaluation,
                        bestAssignment: assignment
                      };
                    }
                  });

                  return Object.values(groups).map(({ candidate, bestSession, bestEvaluation, bestAssignment }) => {
                    // Ensure we pick the absolute best score source
                    const assessmentScore =
                      bestEvaluation?.overall_score ??
                      bestSession?.score ??
                      candidate?.assessment_score ??
                      bestAssignment?.score;

                    const isFinished = ['completed', 'evaluated', 'submitted'].includes(bestSession.status);

                    return (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          {candidate?.name || 'Unknown Candidate'}
                          <span className="block text-xs text-muted-foreground">{candidate?.email}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(bestSession.status)}</TableCell>
                        <TableCell>
                          {isFinished ? (
                            assessmentScore !== null && assessmentScore !== undefined ? (
                              <Badge variant={assessmentScore >= 70 ? 'default' : 'destructive'}>
                                {Math.round(assessmentScore)}%
                              </Badge>
                            ) : (
                              <span className="text-amber-600 text-sm font-medium">Grading...</span>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm italic">
                              {bestSession.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {bestSession.submitted_at
                            ? formatDistanceToNow(new Date(bestSession.submitted_at), { addSuffix: true })
                            : (bestSession.completed_at ? formatDistanceToNow(new Date(bestSession.completed_at), { addSuffix: true }) : '---')}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssessmentsList;
