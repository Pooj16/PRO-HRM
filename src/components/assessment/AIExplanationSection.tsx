import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface AIExplanationProps {
  explanation: string | null | undefined;
  confidence?: number;
  status?: 'reviewed' | 'auto-evaluated' | 'pending';
  showConfidence?: boolean;
}

/**
 * AIExplanationSection Component
 * 
 * Displays AI-generated assessment explanation with:
 * - Analysis text
 * - Confidence score
 * - Review status
 * - Visual indicators
 */
export function AIExplanationSection({
  explanation,
  confidence,
  status = 'auto-evaluated',
  showConfidence = true
}: AIExplanationProps) {
  if (!explanation) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">Assessment evaluation in progress or not yet completed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'reviewed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-cyan-600" />;
    }
  };

  const getStatusBadge = () => {
    const configs = {
      reviewed: { label: 'Human Reviewed', className: 'bg-green-100 text-green-800' },
      'auto-evaluated': { label: 'Auto-Evaluated', className: 'bg-blue-100 text-blue-800' },
      pending: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800' }
    };

    const config = configs[status] || configs['auto-evaluated'];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 85) return 'text-green-700';
    if (conf >= 70) return 'text-yellow-700';
    return 'text-orange-700';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              AI Assessment Analysis
            </CardTitle>
            <CardDescription>
              Automated evaluation and expert insights
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Explanation Text */}
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
            {explanation}
          </p>
        </div>

        {/* Confidence Score */}
        {showConfidence && confidence !== undefined && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Evaluation Confidence</span>
              <span className={`text-lg font-bold ${getConfidenceColor(confidence)}`}>
                {confidence.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  confidence >= 85
                    ? 'bg-green-500'
                    : confidence >= 70
                    ? 'bg-yellow-500'
                    : 'bg-orange-500'
                }`}
                style={{ width: `${confidence}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground">
              {confidence >= 85
                ? 'High confidence in assessment results'
                : confidence >= 70
                ? 'Moderate confidence - some ambiguity in responses'
                : 'Lower confidence - recommend manual review'}
            </p>
          </div>
        )}

        {/* Review Status Note */}
        {status === 'pending' && (
          <div className="pt-4 border-t bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> This assessment is pending manual review by the HR team. Final decision coming soon.
            </p>
          </div>
        )}

        {status === 'reviewed' && (
          <div className="pt-4 border-t bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-green-800">
              <strong>Verified:</strong> This assessment has been reviewed and approved by the HR team.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
