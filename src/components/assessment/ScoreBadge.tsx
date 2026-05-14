import React from 'react';
import { Badge } from '@/components/ui/badge';

interface ScoreBadgeProps {
  score: number | null | undefined;
  maxScore?: number;
  showLabel?: boolean;
}

/**
 * ScoreBadge Component
 * 
 * Displays assessment scores with color-coding:
 * - Green (≥ 75): Pass
 * - Yellow (60-74): Review
 * - Red (< 60): Fail
 * - Gray: No assessment
 */
export function ScoreBadge({ score, maxScore = 100, showLabel = false }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <Badge variant="outline" className="text-gray-600">—</Badge>;
  }

  const getColor = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getLabel = (score: number) => {
    if (score >= 75) return 'Pass';
    if (score >= 60) return 'Review';
    return 'Fail';
  };

  return (
    <Badge className={`${getColor(score)} border`}>
      <span className="font-semibold">{score.toFixed(1)}</span>
      {maxScore && <span className="text-xs ml-1 opacity-75">/{maxScore}</span>}
      {showLabel && <span className="text-xs ml-2">({getLabel(score)})</span>}
    </Badge>
  );
}
