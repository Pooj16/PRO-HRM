import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Save, RefreshCw } from 'lucide-react';

const CompanyRequirementsSettings = () => {
  const [requirements, setRequirements] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const { toast } = useToast();
  const { candidates, forceRefresh } = useRealtimeData();

  const handleSaveRequirements = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('hr_settings')
        .upsert({
          setting_key: 'company_requirements',
          setting_value: requirements
        });

      if (error) throw error;

      toast({
        title: "Requirements Saved",
        description: "Company requirements have been updated successfully."
      });
    } catch (error) {
      console.error('Error saving requirements:', error);
      toast({
        title: "Error",
        description: "Failed to save company requirements.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReanalyzeWithRequirements = async () => {
    if (!requirements.trim()) {
      toast({
        title: "No Requirements",
        description: "Please enter company requirements before re-analyzing.",
        variant: "destructive"
      });
      return;
    }

    setIsReanalyzing(true);
    try {
      // Get candidates with resume text that need re-analysis
      const candidatesToReanalyze = candidates.filter(c => 
        c.resume_text && c.resume_text.length > 50 && !c.resume_text.includes('%PDF')
      );

      if (candidatesToReanalyze.length === 0) {
        toast({
          title: "No Candidates",
          description: "No candidates available for re-analysis.",
        });
        return;
      }

      // Re-analyze each candidate with new requirements
      for (const candidate of candidatesToReanalyze) {
        const aiFunctionName = 'ai-assistant';
        const { error } = await supabase.functions.invoke(aiFunctionName, {
          body: {
            candidateId: candidate.id,
            resumeText: candidate.resume_text,
            jobRequirements: requirements,
            action: 'analyze'
          }
        });

        if (error) {
          console.error('Re-analysis failed for candidate:', candidate.name, error);
        }
      }

      toast({
        title: "Re-analysis Started",
        description: `Re-analyzing ${candidatesToReanalyze.length} candidates with new requirements.`,
      });

      // Refresh data after a delay
      setTimeout(() => {
        forceRefresh();
      }, 5000);

    } catch (error) {
      console.error('Error during re-analysis:', error);
      toast({
        title: "Re-analysis Failed",
        description: "Failed to start re-analysis. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Requirements</CardTitle>
        <CardDescription>
          Set specific job requirements for better ATS analysis and candidate matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="requirements">Job Requirements</Label>
          <Textarea
            id="requirements"
            placeholder="Enter specific job requirements, skills, experience levels, qualifications, etc.&#10;&#10;Example:&#10;- 3+ years of React development experience&#10;- Strong knowledge of JavaScript and TypeScript&#10;- Experience with REST APIs and GraphQL&#10;- Bachelor's degree in Computer Science or related field&#10;- Excellent communication skills"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="min-h-[200px]"
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSaveRequirements}
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            <Save className={`h-4 w-4 ${isUpdating ? 'animate-pulse' : ''}`} />
            {isUpdating ? 'Saving...' : 'Save Requirements'}
          </Button>

          <Button
            onClick={handleReanalyzeWithRequirements}
            disabled={isReanalyzing || !requirements.trim()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isReanalyzing ? 'animate-spin' : ''}`} />
            {isReanalyzing ? 'Re-analyzing...' : 'Re-analyze All Candidates'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyRequirementsSettings;