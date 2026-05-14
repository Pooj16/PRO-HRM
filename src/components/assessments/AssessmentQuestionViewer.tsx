
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, Users, BarChart3, Clock, CheckCircle, ArrowLeft } from 'lucide-react';

interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string | null;
  points: number | null;
  created_at: string;
}

interface AssessmentStats {
  totalQuestions: number;
  averageScore: number;
  completionRate: number;
  totalAttempts: number;
}

interface AssessmentQuestionViewerProps {
  assessmentId: string;
  assessmentTitle: string;
  onClose?: () => void;
}

const AssessmentQuestionViewer = ({ assessmentId, assessmentTitle, onClose }: AssessmentQuestionViewerProps) => {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [stats, setStats] = useState<AssessmentStats>({
    totalQuestions: 0,
    averageScore: 0,
    completionRate: 0,
    totalAttempts: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestionsAndStats();
  }, [assessmentId]);

  const fetchQuestionsAndStats = async () => {
    try {
      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: true });

      if (questionsError) throw questionsError;

      // Transform the data to match our interface
      // Options can be: JSON object {A: "...", B: "..."}, JSON string of object, or array
      const transformedQuestions: AssessmentQuestion[] = questionsData?.map(q => {
        let parsedOptions: string[] | null = null;
        let optionKeys: Record<string, string> = {};

        if (q.options) {
          let raw = q.options;
          // If it's a string, try to parse it
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { /* keep as string */ }
          }

          if (typeof raw === 'object' && !Array.isArray(raw) && raw !== null) {
            // Options stored as {A: "...", B: "...", C: "...", D: "..."}
            parsedOptions = Object.entries(raw).map(([key, val]) => `${key}: ${val}`);
            Object.entries(raw).forEach(([key, val]) => { optionKeys[`${key}: ${val}`] = key; });
          } else if (Array.isArray(raw)) {
            parsedOptions = raw.map(option => String(option));
          } else {
            parsedOptions = [String(raw)];
          }
        }

        return {
          ...q,
          options: parsedOptions,
          _optionKeys: optionKeys, // Helper for correct answer matching
        };
      }) || [];

      setQuestions(transformedQuestions);

      // Fetch assessment assignments for stats
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assessment_assignments')
        .select('*')
        .eq('assessment_id', assessmentId);

      if (assignmentsError) throw assignmentsError;

      const totalAttempts = assignmentsData?.length || 0;
      const completedAttempts = assignmentsData?.filter(a => a.status === 'completed') || [];
      const completionRate = totalAttempts > 0 ? (completedAttempts.length / totalAttempts) * 100 : 0;
      const averageScore = completedAttempts.length > 0
        ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length
        : 0;

      setStats({
        totalQuestions: transformedQuestions.length,
        averageScore: Math.round(averageScore),
        completionRate: Math.round(completionRate),
        totalAttempts
      });

    } catch (error: any) {
      console.error('Error fetching questions and stats:', error);
      toast({
        title: "Error fetching assessment data",
        description: error.message || "Failed to load assessment data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {onClose && (
        <Button variant="outline" onClick={onClose} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assessments
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {assessmentTitle} - Overview
          </CardTitle>
          <CardDescription>
            Assessment statistics and question management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-600">{stats.totalQuestions}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.averageScore}%</div>
              <div className="text-sm text-muted-foreground">Avg Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.completionRate}%</div>
              <div className="text-sm text-muted-foreground">Completion</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.totalAttempts}</div>
              <div className="text-sm text-muted-foreground">Attempts</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  Question {index + 1}
                  <Badge variant="outline" className="ml-2">
                    {question.points || 1} {question.points === 1 ? 'point' : 'points'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed">{question.question_text}</p>

                  {(question.question_type === 'multiple_choice' || question.question_type === 'mcq') && question.options && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Options:</div>
                      {question.options.map((option, optionIndex) => {
                        // Match correct answer: option key (e.g. "B") or full option text
                        const optionKey = (question as any)._optionKeys?.[option];
                        const isCorrect = question.correct_answer
                          ? (option === question.correct_answer || optionKey === question.correct_answer)
                          : false;
                        return (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded border ${isCorrect
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              {isCorrect && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                              <span className="text-sm">{option}</span>
                            </div>
                          </div>
                        );
                      })}
                      {question.correct_answer && (
                        <div className="text-xs text-green-700 mt-1 font-medium">
                          ✅ Correct Answer: {question.correct_answer}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Type: {question.question_type} | Created: {new Date(question.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Detailed statistics about candidate performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Completion Rate</span>
                  <span className="text-sm text-muted-foreground">{stats.completionRate}%</span>
                </div>
                <Progress value={stats.completionRate} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Average Score</span>
                  <span className="text-sm text-muted-foreground">{stats.averageScore}%</span>
                </div>
                <Progress value={stats.averageScore} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-4 bg-cyan-50 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-600">{stats.totalAttempts}</div>
                  <div className="text-sm text-blue-800">Total Attempts</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{Math.round(stats.totalAttempts * stats.completionRate / 100)}</div>
                  <div className="text-sm text-green-800">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssessmentQuestionViewer;
