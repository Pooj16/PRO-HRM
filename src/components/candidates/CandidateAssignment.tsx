
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Users, BookOpen, CheckCircle } from 'lucide-react';

const CandidateAssignment = () => {
  const { candidates, assessments, forceRefresh } = useRealtimeData();
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();

  // Filter shortlisted candidates who don't have assessments assigned yet
  const eligibleCandidates = candidates.filter(candidate => 
    candidate.status === 'shortlisted' && 
    (!candidate.assessment_status || candidate.assessment_status === 'pending')
  );

  // Filter active aptitude assessments
  const activeAssessments = assessments.filter(assessment => 
    assessment.status === 'active' && assessment.type === 'Aptitude'
  );

  const handleCandidateSelection = (candidateId: string, checked: boolean) => {
    if (checked) {
      setSelectedCandidates([...selectedCandidates, candidateId]);
    } else {
      setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCandidates(eligibleCandidates.map(c => c.id));
    } else {
      setSelectedCandidates([]);
    }
  };

  const handleAssignAssessment = async () => {
    if (!selectedAssessment || selectedCandidates.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select both candidates and an assessment.",
        variant: "destructive"
      });
      return;
    }

    setIsAssigning(true);
    
    try {
      // Create assessment assignments for selected candidates
      const assignments = selectedCandidates.map(candidateId => ({
        candidate_id: candidateId,
        assessment_id: selectedAssessment,
        status: 'assigned'
      }));

      const { error: assignmentError } = await supabase
        .from('assessment_assignments')
        .insert(assignments);

      if (assignmentError) {
        throw assignmentError;
      }

      // Update candidate assessment status
      const { error: candidateError } = await supabase
        .from('candidates')
        .update({ assessment_status: 'assigned' })
        .in('id', selectedCandidates);

      if (candidateError) {
        throw candidateError;
      }

      toast({
        title: "Assessment Assigned Successfully",
        description: `${selectedCandidates.length} candidates assigned to assessment.`,
      });

      // Reset selections
      setSelectedCandidates([]);
      setSelectedAssessment('');
      
      // Refresh data
      forceRefresh();

    } catch (error) {
      console.error('Error assigning assessment:', error);
      toast({
        title: "Assignment Failed",
        description: "Failed to assign assessment to candidates.",
        variant: "destructive"
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const createNewAssessment = async () => {
    try {
      const { error } = await supabase.functions.invoke('create-general-assessment', {
        body: {
          role: 'General Position',
          requirements: 'General aptitude assessment for cognitive abilities and problem-solving skills'
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Assessment Created",
        description: "New aptitude assessment created successfully.",
      });

      forceRefresh();

    } catch (error) {
      console.error('Error creating assessment:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create new assessment.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Assign Assessments to Candidates
          </CardTitle>
          <CardDescription>
            Assign aptitude assessments to shortlisted candidates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assessment Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Select Assessment</h3>
              <Button onClick={createNewAssessment} variant="outline" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                Create New Aptitude Assessment
              </Button>
            </div>
            
            <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an assessment to assign" />
              </SelectTrigger>
              <SelectContent>
                {activeAssessments.map((assessment) => (
                  <SelectItem key={assessment.id} value={assessment.id}>
                    <div className="flex items-center gap-2">
                      <span>{assessment.title}</span>
                      <Badge variant="outline">{assessment.questions} questions</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeAssessments.length === 0 && (
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <BookOpen className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">No aptitude assessments available.</p>
                <p className="text-sm text-gray-500">Create one to start assigning candidates.</p>
              </div>
            )}
          </div>

          {/* Candidate Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Select Candidates ({eligibleCandidates.length} available)</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedCandidates.length === eligibleCandidates.length && eligibleCandidates.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm">
                  Select All
                </label>
              </div>
            </div>

            {eligibleCandidates.length === 0 ? (
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <Users className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">No candidates available for assessment assignment.</p>
                <p className="text-sm text-gray-500">Candidates need to be shortlisted first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eligibleCandidates.map((candidate) => (
                  <Card key={candidate.id} className="p-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={candidate.id}
                        checked={selectedCandidates.includes(candidate.id)}
                        onCheckedChange={(checked) => 
                          handleCandidateSelection(candidate.id, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <label htmlFor={candidate.id} className="cursor-pointer">
                          <p className="font-medium">{candidate.name}</p>
                          <p className="text-sm text-gray-600">{candidate.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                           <Badge variant="secondary">
                              ATS Score: {candidate.ats_score || 0}
                            </Badge>
                            <Badge variant="outline">{candidate.status}</Badge>
                          </div>
                        </label>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Summary */}
          {selectedCandidates.length > 0 && selectedAssessment && (
            <div className="bg-cyan-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-cyan-600" />
                <h4 className="font-medium text-blue-900">Assignment Summary</h4>
              </div>
              <p className="text-blue-800">
                {selectedCandidates.length} candidates will be assigned to the selected assessment.
              </p>
            </div>
          )}

          {/* Assignment Button */}
          <Button 
            onClick={handleAssignAssessment}
            disabled={!selectedAssessment || selectedCandidates.length === 0 || isAssigning}
            className="w-full"
            size="lg"
          >
            {isAssigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Assigning Assessment...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Assign Assessment to {selectedCandidates.length} Candidate{selectedCandidates.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidateAssignment;
