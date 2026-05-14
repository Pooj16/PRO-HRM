import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Users, Search, Filter, Eye, MoreHorizontal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CandidateDetailDialog from './CandidateDetailDialog';
import { Candidate } from '@/hooks/useRealtimeData';

interface RoleGroupedCandidatesProps {
  candidates: Candidate[];
  onRefresh: () => void;
}

interface RoleGroup {
  role: string;
  candidates: Candidate[];
  avgScore: number;
  statusCounts: Record<string, number>;
}

export function RoleGroupedCandidates({ candidates, onRefresh }: RoleGroupedCandidatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Group candidates by role
  const roleGroups = useMemo(() => {
    let filtered = candidates;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const safeName = c.name || '';
        const safeEmail = c.email || '';
        const safeRole = c.applied_role || '';
        return safeName.toLowerCase().includes(query) ||
          safeEmail.toLowerCase().includes(query) ||
          safeRole.toLowerCase().includes(query);
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Apply score filter
    if (scoreFilter !== 'all') {
      filtered = filtered.filter(c => {
        const score = c.ats_score || 0;
        switch (scoreFilter) {
          case 'high': return score >= 70;
          case 'medium': return score >= 40 && score < 70;
          case 'low': return score < 40;
          default: return true;
        }
      });
    }

    // Group by role
    const groups: Record<string, RoleGroup> = {};

    filtered.forEach(candidate => {
      const role = candidate.applied_role || 'Unspecified';

      if (!groups[role]) {
        groups[role] = {
          role,
          candidates: [],
          avgScore: 0,
          statusCounts: {}
        };
      }

      groups[role].candidates.push(candidate);

      // Count statuses
      const status = candidate.status || 'unknown';
      groups[role].statusCounts[status] = (groups[role].statusCounts[status] || 0) + 1;
    });

    // Calculate average scores
    Object.values(groups).forEach(group => {
      const scores = group.candidates
        .map(c => c.ats_score)
        .filter((s): s is number => s !== null);
      group.avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    });

    return Object.values(groups).sort((a, b) => b.candidates.length - a.candidates.length);
  }, [candidates, searchQuery, statusFilter, scoreFilter]);

  const toggleRole = (role: string) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRoles(new Set(roleGroups.map(g => g.role)));
  };

  const collapseAll = () => {
    setExpandedRoles(new Set());
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'shortlisted': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'analyzed': return 'bg-cyan-500/10 text-cyan-600 border-blue-500/20';
      case 'text_extracted': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'processing': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'assessment_pending': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'assessment_completed': return 'bg-teal-500/10 text-teal-600 border-teal-500/20';
      case 'assessment_failed': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'interview_scheduled': return 'bg-slate-1000/10 text-slate-900 border-slate-800/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(candidates.map(c => c.status).filter(Boolean));
    return Array.from(statuses) as string[];
  }, [candidates]);

  const totalCandidates = roleGroups.reduce((sum, g) => sum + g.candidates.length, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Candidates</p>
                <p className="text-2xl font-bold">{totalCandidates}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Filter className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Roles</p>
                <p className="text-2xl font-bold">{roleGroups.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assessment Pending</p>
                <p className="text-2xl font-bold">
                  {candidates.filter(c => c.status === 'assessment_pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Users className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interview Ready</p>
                <p className="text-2xl font-bold">
                  {candidates.filter(c => c.status === 'interview_scheduled' || c.status === 'assessment_completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <label className="text-sm font-medium mb-2 block">ATS Score</label>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Scores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="high">High (70+)</SelectItem>
                  <SelectItem value="medium">Medium (40-69)</SelectItem>
                  <SelectItem value="low">Low (&lt;40)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Groups */}
      <div className="space-y-4">
        {roleGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No candidates found matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          roleGroups.map((group) => (
            <Collapsible
              key={group.role}
              open={expandedRoles.has(group.role)}
              onOpenChange={() => toggleRole(group.role)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {expandedRoles.has(group.role) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{group.role}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {group.candidates.length} candidate{group.candidates.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* Status badges */}
                        <div className="hidden md:flex gap-2">
                          {Object.entries(group.statusCounts).slice(0, 3).map(([status, count]) => (
                            <Badge key={status} variant="outline" className={getStatusColor(status)}>
                              {status.replace(/_/g, ' ')}: {count}
                            </Badge>
                          ))}
                        </div>
                        {/* Average score */}
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Avg Score</p>
                          <p className={`text-xl font-bold ${getScoreColor(group.avgScore)}`}>
                            {group.avgScore}%
                          </p>
                        </div>
                        {/* Score distribution bar */}
                        <div className="w-24 hidden lg:block">
                          <Progress value={group.avgScore} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>ATS Score</TableHead>
                          <TableHead>Experience</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.candidates.map((candidate) => (
                          <TableRow key={candidate.id}>
                            <TableCell className="font-medium">{candidate.name}</TableCell>
                            <TableCell className="text-muted-foreground">{candidate.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(candidate.status)}>
                                {(candidate.status || 'pending').replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`font-semibold ${getScoreColor(candidate.ats_score)}`}>
                                {candidate.ats_score ?? '-'}%
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {candidate.experience || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {candidate.applied_date
                                ? new Date(candidate.applied_date).toLocaleDateString()
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedCandidate(candidate)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>

      {/* Candidate Detail Dialog */}
      {selectedCandidate && (
        <CandidateDetailDialog
          candidate={selectedCandidate}
          open={!!selectedCandidate}
          onOpenChange={(open) => !open && setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
