import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Search, Eye, Calendar, CheckCircle, XCircle, X, UserPlus, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { openResume } from '@/lib/resumeUtils';
import CandidateDetailDialog from './CandidateDetailDialog';
import ResumeViewer from './ResumeViewer';
import { ManualTextExtraction } from './ManualTextExtraction';
import { ScoreBadge } from '@/components/assessment/ScoreBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CandidatesList = () => {
  const {
    candidates,
    updateCandidateStatus,
    roleThresholds,
    forceRefresh,
    assessmentAssignments,
    assessmentSessions,
    evaluationResults
  } = useRealtimeData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [resumeViewer, setResumeViewer] = useState<{ open: boolean, url: string, name: string }>({
    open: false, url: '', name: ''
  });
  const { toast } = useToast();

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 CandidatesList DEBUG:');
    console.log('   Total candidates:', candidates?.length);
    console.log('   Search term:', searchTerm);
    console.log('   Status filter:', statusFilter);
  }, [candidates, searchTerm, statusFilter]);

  const filteredCandidates = candidates.filter(candidate => {
    const safeName = candidate.name || '';
    const safeEmail = candidate.email || '';

    const matchesSearch = safeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      safeEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (candidate.applied_role && candidate.applied_role.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Removed local fetching - using useRealtimeData for everything now

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      uploaded: { color: 'bg-orange-100 text-orange-800', label: 'Pending Review' },
      text_extracted: { color: 'bg-blue-100 text-blue-800', label: 'Text Extracted' },
      analyzed: { color: 'bg-purple-100 text-purple-800', label: 'AI Analyzed' },
      reviewing: { color: 'bg-blue-100 text-blue-800', label: 'Under Review' },
      shortlisted: { color: 'bg-green-100 text-green-800', label: 'Shortlisted' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      interviewed: { color: 'bg-purple-100 text-purple-800', label: 'Interviewed' },
      hired: { color: 'bg-emerald-100 text-emerald-800', label: 'Hired' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getAssessmentStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-gray-100 text-gray-800', label: 'Not Assigned' },
      assigned: { color: 'bg-yellow-100 text-yellow-800', label: 'Assigned' },
      in_progress: { color: 'bg-blue-100 text-blue-800', label: 'In Progress' },
      completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Failed' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getResumeStatusBadge = (candidate) => {
    if (!candidate.resume_url) {
      return <Badge variant="destructive" className="text-xs">No Resume</Badge>;
    }

    return <Badge variant="outline" className="text-green-600 text-xs">Resume Available</Badge>;
  };

  const handleStatusUpdate = async (candidateId: string, newStatus: string) => {
    try {
      await updateCandidateStatus(candidateId, newStatus);
      toast({
        title: "Status Updated",
        description: `Candidate status updated to ${newStatus}`
      });
    } catch (error) {
      console.error('Failed to update candidate status:', error);
      toast({
        title: "Error",
        description: "Failed to update candidate status",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (window.confirm(`Are you sure you want to delete ${candidateName}? This action cannot be undone.`)) {
      try {
        const { error } = await supabase
          .from('candidates')
          .update({ is_deleted: true } as any)
          .eq('id', candidateId);

        if (error) throw error;

        toast({
          title: "Candidate Deleted",
          description: `${candidateName} has been removed from the system`
        });
      } catch (error) {
        console.error('Failed to delete candidate:', error);
        toast({
          title: "Error",
          description: "Failed to delete candidate",
          variant: "destructive"
        });
      }
    }
  };

  const handleAssignToTeamLead = async (candidateId: string, candidateName: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    // Find matching role threshold
    const threshold = roleThresholds.find(rt => rt.role_name === candidate.applied_role);

    if (!threshold || !threshold.team_lead_id) {
      toast({
        title: "No Team Lead",
        description: `No team lead assigned for position: ${candidate.applied_role}`,
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('candidate_assignments')
        .insert({
          candidate_id: candidateId,
          team_lead_id: threshold.team_lead_id,
          status: 'assigned',
          notes: `Assigned based on ATS score: ${candidate.ats_score}`
        });

      if (error) throw error;

      // Update candidate status
      await updateCandidateStatus(candidateId, 'assigned_to_team_lead');

      toast({
        title: "Assigned to Team Lead",
        description: `${candidateName} has been assigned to team lead`
      });
    } catch (error) {
      console.error('Failed to assign to team lead:', error);
      toast({
        title: "Error",
        description: "Failed to assign to team lead",
        variant: "destructive"
      });
    }
  };

  const handleViewResume = (resumePath: string, candidateName: string) => {
    openResume(resumePath, candidateName);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Your Candidate Pipeline</CardTitle>
          <CardDescription>
            Everyone who's applied, all in one place. Click a row to dig in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters and Actions */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or role…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="text_extracted">Text Extracted</SelectItem>
                <SelectItem value="analyzed">AI Analyzed</SelectItem>
                <SelectItem value="reviewing">Under Review</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="interviewed">Interviewed</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
              </SelectContent>
            </Select>
            <ManualTextExtraction
              candidates={candidates}
              onRefresh={forceRefresh}
            />
          </div>

          {/* Candidates Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>ATS Score</TableHead>
                  <TableHead>Test Score</TableHead>
                  <TableHead>Final Score</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <TableRow key={candidate.id} className="hover:bg-slate-50/50 transition-colors duration-100">
                    <TableCell>
                      <div>
                        <div className="font-medium">{candidate.name}</div>
                        <div className="text-sm text-muted-foreground">{candidate.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{candidate.applied_role || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{candidate.location}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getResumeStatusBadge(candidate)}
                        {candidate.resume_url && (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleViewResume(candidate.resume_url, candidate.name)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Resume
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(candidate.status || 'uploaded')}</TableCell>
                    <TableCell>{getAssessmentStatusBadge(candidate.assessment_status || 'pending')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold">
                          {candidate.ats_score || 0}
                        </div>
                        {candidate.match_percentage && (
                          <div className="text-sm text-muted-foreground">
                            ({candidate.match_percentage}% match)
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const assignment = assessmentAssignments.find(a => a.candidate_id === candidate.id);
                        const session = assessmentSessions.find(s => s.candidate_id === candidate.id);
                        const evaluation = evaluationResults.find(e => e.session_id === session?.id);

                        const score = assignment?.score ?? evaluation?.overall_score ?? session?.score;

                        if (score !== null && score !== undefined) {
                          return <ScoreBadge score={score} showLabel={false} />;
                        }
                        return <span className="text-sm text-muted-foreground">—</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const ats = candidate.ats_score || 0;
                        const assignment = assessmentAssignments.find(a => a.candidate_id === candidate.id);
                        const session = assessmentSessions.find(s => s.candidate_id === candidate.id);
                        const evaluation = evaluationResults.find(e => e.session_id === session?.id);

                        const assess = assignment?.score ?? evaluation?.overall_score ?? session?.score;

                        if (assess !== null && assess !== undefined) {
                          const final = Math.round(ats * 0.6 + assess * 0.4);
                          return (
                            <div className="flex items-center gap-1">
                              <div className={`text-lg font-bold ${final >= 70 ? 'text-green-600' : final >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>{final}</div>
                              <span className="text-xs text-muted-foreground">/ 100</span>
                            </div>
                          );
                        }
                        return <span className="text-sm text-muted-foreground">ATS only: {ats}</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {candidate.applied_date &&
                        formatDistanceToNow(new Date(candidate.applied_date), { addSuffix: true })
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCandidate(candidate)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignToTeamLead(candidate.id, candidate.name)}
                          disabled={candidate.status === 'assigned_to_team_lead'}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(candidate.id, 'shortlisted')}
                          disabled={candidate.status === 'shortlisted'}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(candidate.id, 'rejected')}
                          disabled={candidate.status === 'rejected'}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredCandidates.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">Nothing matches that search — try a different name or role.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidate Detail Dialog */}
      {selectedCandidate && (
        <CandidateDetailDialog
          candidate={selectedCandidate}
          open={!!selectedCandidate}
          onOpenChange={() => setSelectedCandidate(null)}
        />
      )}

      {/* Resume Viewer Dialog */}
      <ResumeViewer
        resumeUrl={resumeViewer.url}
        candidateName={resumeViewer.name}
        open={resumeViewer.open}
        onOpenChange={(open) => setResumeViewer(prev => ({ ...prev, open }))}
      />
    </div>
  );
};

export default CandidatesList;
