import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScoreBadge } from '@/components/assessment/ScoreBadge';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface QualifiedCandidate {
  id: string;
  name: string;
  email: string;
  applied_role: string;
  assessment_score: number;
  role_threshold: number;
  score_margin: number;
  completed_at?: string;
  status: string;
  assessment_status?: string;
}

const AssessmentQualifiedCandidates = () => {
  const {
    candidates,
    roleThresholds,
    updateCandidateStatus,
    scheduleInterview,
    autoScheduleAllQualified,
    assessmentSessions,
    evaluationResults,
    assessmentAssignments
  } = useRealtimeData();
  const { toast } = useToast();

  const [qualifiedCandidates, setQualifiedCandidates] = useState<QualifiedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [sortBy, setSortBy] = useState('score-desc');

  // ... existing useEffect ...

  const handleScheduleAll = async () => {
    if (filteredCandidates.length === 0) return;

    setIsSchedulingAll(true);
    toast({
      title: "🤖 Automation Started",
      description: `Sending interview invites to ${filteredCandidates.length} candidates...`,
    });

    try {
      const count = await autoScheduleAllQualified();
      toast({
        title: "✅ Success",
        description: `Assigned and notified ${count} candidates.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to complete batch scheduling.",
        variant: "destructive"
      });
    } finally {
      setIsSchedulingAll(false);
    }
  };

  // Filter qualified candidates using data from useRealtimeData
  useEffect(() => {
    if (!candidates.length) {
      setLoading(false);
      return;
    }

    const qualified: QualifiedCandidate[] = [];

    candidates.forEach(candidate => {
      // Skip if rejected
      if (candidate.status === 'rejected') return;

      // 2. Identify sessions for this candidate
      const candidateSessions = (assessmentSessions as any[]).filter(s => s.candidate_id === candidate.id);

      // 3. Check if any session meets the criteria
      candidateSessions.forEach(session => {
        // Status check - allow if session is finished or candidate is marked qualified/shortlisted
        const isSessionFinished = ['completed', 'evaluated', 'submitted'].includes(session.status);
        const isCandidateQualified = candidate.status === 'assessment_qualified' ||
          candidate.status === 'shortlisted' ||
          candidate.status === 'analyzed' ||
          candidate.status === 'assessment_completed' ||
          candidate.status === 'interview_scheduled'; // Allow viewing even if already scheduled elsewhere

        if (!isSessionFinished && !isCandidateQualified) return;

        // 4. Get the score from various sources
        const evaluation = (evaluationResults as any[]).find(er => er.session_id === session.id);
        const assignment = (assessmentAssignments as any[]).find(a => a.candidate_id === candidate.id && a.assessment_id === session.assessment_id);

        const assessmentScore = evaluation?.evaluation_score ??
          evaluation?.overall_score ??
          assignment?.score ??
          session.score ??
          (candidate as any).assessment_score ??
          (candidate as any).ai_score ??
          (assessmentSessions as any[]).find(s => s.id === session.id)?.score ?? 0;

        // 5. Check threshold for their role
        const threshold = roleThresholds.find(rt => rt.role_name === candidate.applied_role);
        // Fallback threshold if specific role not found (e.g., 70)
        const minRequired = threshold?.min_assessment_score ?? 70;

        if (assessmentScore >= minRequired) {
          // Add to qualified (if not already added for this candidate)
          if (!qualified.find(qc => qc.id === candidate.id)) {
            qualified.push({
              id: candidate.id,
              name: candidate.name,
              email: candidate.email,
              applied_role: candidate.applied_role,
              assessment_score: assessmentScore,
              role_threshold: minRequired,
              score_margin: assessmentScore - minRequired,
              completed_at: session.completed_at || session.submitted_at || candidate.updated_at,
              status: candidate.status || '',
              assessment_status: session.status
            });
          }
        }
      });
    });

    console.log(`[AssessmentQualifiedCandidates] Found ${qualified.length} qualified candidates:`, qualified.map(q => `${q.name} (${q.assessment_score})`));
    setQualifiedCandidates(qualified);
    setLoading(false);
  }, [candidates, assessmentSessions, evaluationResults, roleThresholds, assessmentAssignments]);

  // Filter candidates by search and role
  const filteredCandidates = qualifiedCandidates
    .filter(c => {
      // Show ALL qualified candidates, regardless of scheduling status
      // (as requested by user to keep them in this section)
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.applied_role.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = filterRole === 'all' || c.applied_role === filterRole;

      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score-desc':
          return b.assessment_score - a.assessment_score;
        case 'score-asc':
          return a.assessment_score - b.assessment_score;
        case 'margin-desc':
          return b.score_margin - a.score_margin;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          return (
            new Date(b.completed_at || '').getTime() -
            new Date(a.completed_at || '').getTime()
          );
        default:
          return 0;
      }
    });

  // Get unique roles for filter
  const uniqueRoles = Array.from(
    new Set(qualifiedCandidates.map(c => c.applied_role))
  ).sort();

  const handleScheduleInterview = async (candidateId: string, candidateName: string) => {
    try {
      const candidate = qualifiedCandidates.find(c => c.id === candidateId);
      if (!candidate) return;

      toast({
        title: '⏳ Finding best slot...',
        description: `Calculating next available interview for ${candidateName}`,
      });

      await scheduleInterview({
        candidate_id: candidateId,
        interviewer_email: "", // Populated dynamically from HR user's profile
        interview_type: "Technical Round",
        duration_minutes: 45,
        notes: "Automated scheduling based on HR availability."
      });

      toast({
        title: '📅 Interview Scheduled!',
        description: `${candidateName} has been automatically slotted and notified.`,
      });

      setQualifiedCandidates(prev => prev.filter(c => c.id !== candidateId));
    } catch (error) {
      console.error('Failed to auto-schedule interview:', error);
      toast({
        title: 'Scheduling Failed',
        description: error instanceof Error ? error.message : 'Please check your HR availability settings.',
        variant: 'destructive'
      });
    }
  };

  const handleRejectCandidate = async (candidateId: string, candidateName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to reject ${candidateName}? They will be removed from the interview pool.`
      )
    ) {
      return;
    }

    try {
      await updateCandidateStatus(candidateId, 'rejected');
      toast({
        title: 'Candidate Rejected',
        description: `${candidateName} has been rejected and removed from the interview pool`
      });
    } catch (error) {
      console.error('Failed to reject candidate:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject candidate',
        variant: 'destructive'
      });
    }
  };

  const handleReassess = async (candidateId: string, candidateName: string) => {
    try {
      // Reset assessment status to allow re-taking
      const { error } = await supabase
        .from('candidates')
        .update({
          assessment_status: 'pending'
        })
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: 'Assessment Reset',
        description: `${candidateName} can now re-take the assessment`
      });
    } catch (error) {
      console.error('Failed to reset assessment:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset assessment',
        variant: 'destructive'
      });
    }
  };

  const getInterviewStatusBadge = (status: string | undefined) => {
    if (!status || status === 'not_scheduled') {
      return (
        <Badge variant="outline" className="text-orange-600">
          <AlertCircle className="w-3 h-3 mr-1" />
          Not Scheduled
        </Badge>
      );
    }

    if (status === 'scheduled') {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          <Calendar className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>
      );
    }

    if (status === 'completed') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    }

    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Assessment Cleared Assessments</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading qualified candidates...</span>
        </CardContent>
      </Card>
    );
  }

  const passRate = candidates.length > 0
    ? ((qualifiedCandidates.length / candidates.length) * 100).toFixed(1)
    : 0;

  const readyToScheduleCount = qualifiedCandidates.filter(c => c.status !== 'interview_scheduled').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cleared Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{readyToScheduleCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for interview scheduling
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{passRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {qualifiedCandidates.length} passed of {candidates.length} total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {qualifiedCandidates.length > 0
                ? Math.round(
                  qualifiedCandidates.reduce((sum, c) => sum + c.assessment_score, 0) /
                  qualifiedCandidates.length
                )
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              out of 100 points
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Candidates Table Card */}
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <div className="flex justify-between items-center text-left">
            <div>
              <CardTitle className="text-lg text-slate-900">Ready for their next round</CardTitle>
              <CardDescription>
                These folks have cleared their technical assessments and are waiting for an interview invite.
                Assessment score must meet or exceed the role-specific threshold.
              </CardDescription>
            </div>
            <Button
              onClick={handleScheduleAll}
              disabled={readyToScheduleCount === 0 || isSchedulingAll}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isSchedulingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
              Schedule All Qualified ({readyToScheduleCount})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score-desc">Score (High to Low)</SelectItem>
                <SelectItem value="score-asc">Score (Low to High)</SelectItem>
                <SelectItem value="margin-desc">Margin (Highest First)</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Candidates Table */}
          {filteredCandidates.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Candidate</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="text-center font-semibold">Assessment Score</TableHead>
                    <TableHead className="text-center font-semibold">Threshold</TableHead>
                    <TableHead className="text-center font-semibold">Margin</TableHead>
                    <TableHead className="font-semibold">Completed</TableHead>
                    <TableHead className="font-semibold">Interview Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map(candidate => (
                    <TableRow key={candidate.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{candidate.name}</p>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{candidate.applied_role}</TableCell>
                      <TableCell className="text-center">
                        <ScoreBadge score={candidate.assessment_score} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-sm">
                          {candidate.role_threshold}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                          <span className="text-sm font-medium text-green-700">
                            +{candidate.score_margin}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {candidate.completed_at
                          ? formatDistanceToNow(new Date(candidate.completed_at), {
                            addSuffix: true
                          })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          {candidate.status === 'interview_scheduled' ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                              Scheduled
                            </Badge>
                          ) : (
                            getInterviewStatusBadge(candidate.assessment_status)
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {candidate.status === 'interview_scheduled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  toast({ title: 'Sending BGV Link...', description: `Generating secure BGV link for ${candidate.name}.` });
                                  const { error } = await supabase.functions.invoke('send-bgv-link', {
                                    body: { candidate_id: candidate.id }
                                  });
                                  if (error) throw error;
                                  toast({ title: 'Success', description: 'BGV link sent to candidate.' });
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                }
                              }}
                              className="text-xs border-green-200 text-green-700 hover:bg-green-50"
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Trigger BGV
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={candidate.status === 'interview_scheduled' ? "outline" : "default"}
                            onClick={() =>
                              handleScheduleInterview(candidate.id, candidate.name)
                            }
                            className={`text-xs ${candidate.status === 'interview_scheduled' ? 'border-slate-200 text-slate-900' : 'bg-slate-900 hover:bg-slate-800'}`}
                            disabled={candidate.status === 'interview_scheduled'}
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            {candidate.status === 'interview_scheduled' ? 'Scheduled' : 'Schedule'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleReassess(candidate.id, candidate.name)
                            }
                            className="text-xs"
                          >
                            Reassess
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleRejectCandidate(candidate.id, candidate.name)
                            }
                            className="text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || filterRole !== 'all'
                  ? 'No candidates match your filters.'
                  : 'No candidates have qualified for interview scheduling yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Footer */}
      {qualifiedCandidates.length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Highest Score</p>
                <div className="flex items-center">
                  <ScoreBadge score={Math.max(...qualifiedCandidates.map(c => c.assessment_score))} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Lowest Score (Qualified)</p>
                <div className="flex items-center">
                  <ScoreBadge score={Math.min(...qualifiedCandidates.map(c => c.assessment_score))} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Average Margin Above Threshold</p>
                <p className="text-lg font-semibold text-green-700">
                  +{Math.round(
                    qualifiedCandidates.reduce((sum, c) => sum + c.score_margin, 0) /
                    qualifiedCandidates.length
                  )} points
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AssessmentQualifiedCandidates;
