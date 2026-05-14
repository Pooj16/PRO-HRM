import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Zap } from "lucide-react";

interface AutoProgressedCandidate {
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  assessment_score: number;
  new_status: string;
  auto_shortlisted: boolean;
}

interface AutoProgressionNotificationProps {
  candidates: AutoProgressedCandidate[];
  onDismiss: () => void;
  onScheduleInterview?: (candidateId: string) => void;
}

/**
 * Component displaying candidates automatically progressed to interview scheduling
 * Shows summary stats and list of auto-shortlisted candidates with quick actions
 */
export const AutoProgressionNotification: React.FC<
  AutoProgressionNotificationProps
> = ({ candidates, onDismiss, onScheduleInterview }) => {
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(
    new Set()
  );

  const autoShortlistedCount = candidates.filter(
    (c) => c.auto_shortlisted
  ).length;
  const averageScore =
    candidates.length > 0
      ? (
          candidates.reduce((sum, c) => sum + c.assessment_score, 0) /
          candidates.length
        ).toFixed(1)
      : 0;

  const toggleExpanded = (candidateId: string) => {
    const newExpanded = new Set(expandedCandidates);
    if (newExpanded.has(candidateId)) {
      newExpanded.delete(candidateId);
    } else {
      newExpanded.add(candidateId);
    }
    setExpandedCandidates(newExpanded);
  };

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              <CardTitle>Auto-Progression Complete</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-gray-500"
            >
              ✕
            </Button>
          </div>
          <CardDescription>
            Candidates automatically moved to interview scheduling based on assessment
            scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {autoShortlistedCount}
              </div>
              <div className="text-sm text-gray-600">Auto-Shortlisted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-600">
                {candidates.length}
              </div>
              <div className="text-sm text-gray-600">Total Qualified</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {averageScore}
              </div>
              <div className="text-sm text-gray-600">Avg Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidates List */}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-700">Qualified Candidates</h3>
        {candidates.map((candidate) => (
          <Card
            key={candidate.candidate_id}
            className="cursor-pointer hover:bg-gray-50"
            onClick={() => toggleExpanded(candidate.candidate_id)}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {candidate.auto_shortlisted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="font-medium">{candidate.candidate_name}</span>
                    <Badge
                      variant={
                        candidate.auto_shortlisted ? "default" : "secondary"
                      }
                      className="ml-auto"
                    >
                      {candidate.assessment_score.toFixed(1)}/100
                    </Badge>
                  </div>
                  {expandedCandidates.has(candidate.candidate_id) && (
                    <div className="mt-3 space-y-2 border-t pt-3 text-sm text-gray-600">
                      <div>
                        <strong>Email:</strong> {candidate.candidate_email}
                      </div>
                      <div>
                        <strong>Status:</strong>{" "}
                        <Badge variant="outline">{candidate.new_status}</Badge>
                      </div>
                      {candidate.auto_shortlisted &&
                        onScheduleInterview && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onScheduleInterview(candidate.candidate_id);
                            }}
                          >
                            Schedule Interview
                          </Button>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
