
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Candidate } from '@/hooks/useRealtimeData';
import { MapPin, Mail, Briefcase, GraduationCap, DollarSign, Calendar, Star, Phone, FileText, Loader } from 'lucide-react';
import { getResumePublicUrl, openResume } from '@/lib/resumeUtils';
import { formatDistanceToNow } from 'date-fns';
import { ScoreBadge } from '@/components/assessment/ScoreBadge';
import { ScoreBreakdown } from '@/components/assessment/ScoreBreakdown';
import { AIExplanationSection } from '@/components/assessment/AIExplanationSection';
import { AssessmentActions } from '@/components/assessment/AssessmentActions';
import { supabase } from '@/integrations/supabase/client';

interface CandidateDetailDialogProps {
  candidate: Candidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CandidateDetailDialog = ({ candidate, open, onOpenChange }: CandidateDetailDialogProps) => {
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load assessment data when dialog opens
  useEffect(() => {
    if (open && candidate.id) {
      loadAssessmentData();
    }
  }, [open, candidate.id]);

  const loadAssessmentData = async () => {
    if (!candidate?.id) return;

    setLoading(true);
    try {
      // Direct Local Supabase Fetch
      const { data, error: sessionErr } = await (supabase as any)
        .from('assessment_sessions')
        .select(`
          id, status, score,
          evaluation_results ( overall_score, total_possible, breakdown, ai_explanation )
        `)
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const sessionData: any = data;

      if (sessionErr) {
        setAssessmentData(null);
        return;
      }

      if (sessionData) {
        const evalRes = sessionData.evaluation_results?.[0] || sessionData.evaluation_results;

        const overallScore = evalRes?.overall_score ?? sessionData.score ?? 0;

        // Transform the API response to match component props
        setAssessmentData({
          overallScore: Number(overallScore),
          perSkill: {}, // Could extract from breakdown later
          atsScore: candidate.ats_score || 0,
          weightedScore: calculateWeightedScore(
            Number(overallScore),
            candidate.ats_score || 0
          ),
          explanation: evalRes?.ai_explanation?.summary || "",
          confidence: evalRes?.ai_explanation?.confidence || 0,
          status: sessionData.status || "pending",
          assessmentId: sessionData.id,
        });
      } else {
        setAssessmentData(null);
      }
    } catch (error) {
      console.error("Failed to load assessment data:", error);
      setAssessmentData(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeightedScore = (assessmentScore: number, atsScore: number) => {
    return (assessmentScore * 0.6) + (atsScore * 0.4);
  };
  const getStatusColor = (status: string) => {
    const colors = {
      uploaded: 'bg-orange-100 text-orange-800',
      resume_uploaded: 'bg-blue-100 text-blue-800',
      text_extracted: 'bg-blue-100 text-blue-800',
      analyzed: 'bg-green-100 text-green-800',
      reviewing: 'bg-blue-100 text-blue-800',
      shortlisted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      interviewed: 'bg-purple-100 text-purple-800',
      hired: 'bg-emerald-100 text-emerald-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{candidate.name}</DialogTitle>
          <DialogDescription>
            Comprehensive candidate profile and assessment results
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Basic Info */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{candidate.email}</span>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate.phone}</span>
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate.location}</span>
                  </div>
                )}
                {candidate.applied_role && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate.applied_role}</span>
                  </div>
                )}
                {candidate.education && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate.education}</span>
                  </div>
                )}
                {candidate.salary_expectation && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">${candidate.salary_expectation.toLocaleString()}</span>
                  </div>
                )}
                {candidate.applied_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Applied {formatDistanceToNow(new Date(candidate.applied_date), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Application Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(candidate.status || 'uploaded')}>
                      {candidate.status || 'uploaded'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Assessment Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(candidate.assessment_status || 'pending')}>
                      {candidate.assessment_status || 'pending'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resume Actions */}
            {candidate.resume_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resume</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openResume(candidate.resume_url, candidate.name)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Resume
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Detailed Info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Assessment Score Section */}
            {assessmentData && !loading ? (
              <>
                <ScoreBreakdown
                  overallScore={assessmentData.overallScore}
                  perSkill={assessmentData.perSkill}
                  weightedScore={assessmentData.weightedScore}
                  atsScore={assessmentData.atsScore}
                  showDetails={true}
                />

                <AIExplanationSection
                  explanation={assessmentData.explanation}
                  confidence={assessmentData.confidence}
                  status={assessmentData.status}
                  showConfidence={true}
                />

                <AssessmentActions
                  candidateId={candidate.id}
                  candidateName={candidate.name}
                  assessmentId={assessmentData.assessmentId}
                  assessmentStatus={assessmentData.status}
                  onActionComplete={() => {
                    // Reload assessment data after action
                    loadAssessmentData();
                  }}
                />
              </>
            ) : loading ? (
              <Card>
                <CardContent className="pt-6 flex items-center justify-center">
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading assessment data...</span>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* AI Scores - ATS Only */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Assessment Scores</CardTitle>
                    <CardDescription>Automated evaluation results from resume analysis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">ATS Score</span>
                          <span className={`text-lg font-bold ${getScoreColor(candidate.ats_score || 0)}`}>
                            {candidate.ats_score || 0}
                          </span>
                        </div>
                        <Progress value={candidate.ats_score || 0} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Match Percentage</span>
                          <span className={`text-lg font-bold ${getScoreColor(candidate.match_percentage || 0)}`}>
                            {candidate.match_percentage || 0}%
                          </span>
                        </div>
                        <Progress value={candidate.match_percentage || 0} className="h-2" />
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Assessment not yet submitted or still being evaluated
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Experience */}
            {candidate.experience && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Experience Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-sm">
                    {candidate.experience}
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Skills & Technologies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resume Text Preview */}
            {candidate.resume_text && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resume Content Preview</CardTitle>
                  <CardDescription>Extracted text from resume (first 500 characters)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed max-h-60 overflow-y-auto">
                    {candidate.resume_text.substring(0, 500)}
                    {candidate.resume_text.length > 500 && '...'}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button>
            Schedule Interview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateDetailDialog;
