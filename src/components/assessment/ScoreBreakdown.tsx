import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface SkillScore {
  [key: string]: number;
}

interface ScoreBreakdownProps {
  overallScore: number | null;
  perSkill?: SkillScore;
  weightedScore?: number;
  atsScore?: number;
  showDetails?: boolean;
}

/**
 * ScoreBreakdown Component
 * 
 * Displays assessment score breakdown with:
 * - Overall score
 * - Per-skill breakdown (as horizontal bars)
 * - Weighted score (if provided)
 * - ATS score comparison
 */
export function ScoreBreakdown({
  overallScore,
  perSkill,
  weightedScore,
  atsScore,
  showDetails = true
}: ScoreBreakdownProps) {
  if (overallScore === null || overallScore === undefined) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center text-sm">
            Assessment not yet submitted or evaluated
          </p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700';
    if (score >= 70) return 'text-yellow-700';
    if (score >= 60) return 'text-orange-700';
    return 'text-red-700';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessment Breakdown</CardTitle>
        <CardDescription>Detailed score analysis and skill assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <h3 className="font-semibold text-base">Overall Assessment Score</h3>
            <span className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore.toFixed(1)}
              <span className="text-lg text-muted-foreground ml-1">/100</span>
            </span>
          </div>
          <Progress value={overallScore} className="h-3" />
        </div>

        {/* Weighted Score */}
        {weightedScore !== undefined && atsScore !== undefined && (
          <div className="pt-4 border-t space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Final Weighted Score</span>
                <span className={`font-bold ${getScoreColor(weightedScore)}`}>
                  {weightedScore.toFixed(1)}/100
                </span>
              </div>
              <Progress value={weightedScore} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                40% ATS ({atsScore.toFixed(1)}) + 60% Assessment ({overallScore.toFixed(1)})
              </p>
            </div>
          </div>
        )}

        {/* Per-Skill Breakdown */}
        {perSkill && Object.keys(perSkill).length > 0 && (
          <div className="pt-4 border-t space-y-4">
            <h3 className="font-semibold text-base">Skill Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(perSkill).map(([skill, score]) => (
                <div key={skill}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{skill}</span>
                      <Badge variant="outline" className="text-xs">
                        {score >= 80 ? 'Strong' : score >= 60 ? 'Adequate' : 'Needs Work'}
                      </Badge>
                    </div>
                    <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
                      {score.toFixed(1)}/100
                    </span>
                  </div>
                  <Progress 
                    value={score} 
                    className={`h-2 ${getProgressColor(score)}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        {showDetails && (
          <div className="pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Score Interpretation</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>80+ : Strong</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>70-79 : Good</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>60-69 : Acceptable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>&lt;60 : Needs Work</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
