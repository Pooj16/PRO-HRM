import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Candidate } from '@/hooks/useRealtimeData';
import { useWorkflow } from '@/hooks/useWorkflow';
import { 
  PIPELINE_STATUS,
  USER_ROLE,
  getAllowedNextStatuses,
  STATUS_TO_PIPELINE,
  getATSRecommendation,
} from '@/lib/workflowRules';
import { 
  FileText, 
  Brain, 
  UserCheck, 
  CalendarDays, 
  Gift, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

// Pipeline status flow definition
export const PIPELINE_STATUSES = [
  { key: 'applied', label: 'Applied', icon: FileText, color: 'bg-slate-500' },
  { key: 'ai_screened', label: 'AI Screened', icon: Brain, color: 'bg-cyan-500' },
  { key: 'lead_review', label: 'Lead Review', icon: UserCheck, color: 'bg-purple-500' },
  { key: 'interview', label: 'Interview', icon: CalendarDays, color: 'bg-amber-500' },
  { key: 'offer', label: 'Offer', icon: Gift, color: 'bg-emerald-500' },
  { key: 'hired', label: 'Hired', icon: CheckCircle, color: 'bg-green-600' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, color: 'bg-red-500' },
] as const;

// Map existing statuses to pipeline statuses
export const mapToPipelineStatus = (status: string | null): string => {
  return STATUS_TO_PIPELINE[status || 'applied'] || 'applied';
};

// Get allowed next statuses based on current status and role
export const getNextStatuses = (currentStatus: string, isHR: boolean = true): string[] => {
  const role = isHR ? USER_ROLE.HR : USER_ROLE.TEAM_LEAD;
  return getAllowedNextStatuses(currentStatus, role);
};

interface CandidatePipelineProps {
  candidates: Candidate[];
  onRefresh: () => void;
}

const CandidatePipeline: React.FC<CandidatePipelineProps> = ({ candidates, onRefresh }) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNotes, setStatusNotes] = useState('');
  const { toast } = useToast();
  
  // Use workflow hook for proper status management
  const { changePipelineStatus, isProcessing } = useWorkflow();

  // Group candidates by pipeline status
  const groupedCandidates = candidates.reduce((acc, candidate) => {
    const pipelineStatus = mapToPipelineStatus(candidate.status);
    if (!acc[pipelineStatus]) {
      acc[pipelineStatus] = [];
    }
    acc[pipelineStatus].push(candidate);
    return acc;
  }, {} as Record<string, Candidate[]>);

  // Filter candidates based on selected status
  const filteredCandidates = selectedStatus === 'all' 
    ? candidates 
    : candidates.filter(c => mapToPipelineStatus(c.status) === selectedStatus);

  const handleStatusUpdate = async () => {
    if (!selectedCandidate || !newStatus) return;

    // Use workflow hook for proper validation and audit logging
    const result = await changePipelineStatus(
      selectedCandidate.id,
      selectedCandidate.status || 'applied',
      newStatus as any,
      USER_ROLE.HR,
      statusNotes || undefined
    );

    if (result.success) {
      setSelectedCandidate(null);
      setNewStatus('');
      setStatusNotes('');
      onRefresh();
    }
  };

  // Get ATS recommendation for display
  const getRecommendationBadge = (score: number | null | undefined) => {
    if (!score) return null;
    const rec = getATSRecommendation(score);
    const colors = {
      suggest_shortlist: 'bg-green-100 text-green-700 border-green-200',
      suggest_review: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      suggest_reject: 'bg-red-100 text-red-700 border-red-200',
    };
    return (
      <Badge variant="outline" className={`text-xs ${colors[rec.recommendation]}`}>
        {rec.recommendation === 'suggest_shortlist' ? '✓ Suggest Shortlist' : 
         rec.recommendation === 'suggest_review' ? '⚠ Needs Review' : 
         '⚡ Low Match'}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const pipelineStatus = mapToPipelineStatus(status);
    const statusInfo = PIPELINE_STATUSES.find(s => s.key === pipelineStatus);
    return statusInfo ? (
      <Badge className={`${statusInfo.color} text-white`}>
        {statusInfo.label}
      </Badge>
    ) : (
      <Badge variant="secondary">{status}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Recruitment Pipeline
          </CardTitle>
          <CardDescription>
            Track candidates through: Applied → AI Screened → Lead Review → Interview → Offer → Hired/Rejected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pipeline Stage Cards */}
          <div className="flex flex-wrap gap-2 mb-6">
            {PIPELINE_STATUSES.filter(s => s.key !== 'rejected').map((status, index) => {
              const count = groupedCandidates[status.key]?.length || 0;
              const Icon = status.icon;
              return (
                <React.Fragment key={status.key}>
                  <button
                    onClick={() => setSelectedStatus(status.key)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                      selectedStatus === status.key 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`p-2 rounded-md ${status.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{status.label}</p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                  </button>
                  {index < PIPELINE_STATUSES.length - 2 && status.key !== 'hired' && (
                    <ChevronRight className="h-6 w-6 text-muted-foreground self-center hidden md:block" />
                  )}
                </React.Fragment>
              );
            })}
            {/* Rejected separate */}
            <button
              onClick={() => setSelectedStatus('rejected')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ml-4 ${
                selectedStatus === 'rejected' 
                  ? 'border-destructive bg-destructive/10' 
                  : 'border-border hover:border-destructive/50'
              }`}
            >
              <div className="p-2 rounded-md bg-red-500">
                <XCircle className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Rejected</p>
                <p className="text-2xl font-bold">{groupedCandidates['rejected']?.length || 0}</p>
              </div>
            </button>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-4 mb-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {PIPELINE_STATUSES.map(status => (
                  <SelectItem key={status.key} value={status.key}>
                    {status.label} ({groupedCandidates[status.key]?.length || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setSelectedStatus('all')}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Show All
            </Button>
          </div>

          {/* Candidates Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>ATS Score</TableHead>
                  <TableHead>Pipeline Stage</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No candidates in this stage
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate) => {
                    const pipelineStatus = mapToPipelineStatus(candidate.status);
                    const nextStatuses = getNextStatuses(pipelineStatus, true);
                    
                    return (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{candidate.name}</div>
                            <div className="text-sm text-muted-foreground">{candidate.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.applied_role}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{candidate.ats_score || 0}%</span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(candidate.status || 'applied')}
                        </TableCell>
                        <TableCell>
                          {candidate.applied_date 
                            ? new Date(candidate.applied_date).toLocaleDateString()
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {nextStatuses.length > 0 && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedCandidate(candidate)}
                                >
                                  Update Status
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Update Pipeline Status</DialogTitle>
                                  <DialogDescription>
                                    Move {candidate.name} to the next stage in the pipeline
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm font-medium mb-2">Current Stage</p>
                                    {getStatusBadge(candidate.status || 'applied')}
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Move to</label>
                                    <Select value={newStatus} onValueChange={setNewStatus}>
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select next stage" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {nextStatuses.map(status => {
                                          const statusInfo = PIPELINE_STATUSES.find(s => s.key === status);
                                          return (
                                            <SelectItem key={status} value={status}>
                                              {statusInfo?.label || status}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Notes (optional)</label>
                                    <Textarea
                                      value={statusNotes}
                                      onChange={(e) => setStatusNotes(e.target.value)}
                                      placeholder="Add notes about this status change..."
                                      className="mt-1"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      onClick={() => {
                                        setSelectedCandidate(null);
                                        setNewStatus('');
                                        setStatusNotes('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleStatusUpdate}
                                      disabled={!newStatus || isProcessing}
                                    >
                                      {isProcessing ? 'Updating...' : 'Update Status'}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidatePipeline;
