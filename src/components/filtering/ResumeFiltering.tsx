
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Filter, Search, Save, Play, RefreshCw, AlertCircle, Plus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RoleRequirement {
  role: string;
  description: string;
  minExperience: number;
  requiredSkills: string[];
  preferredSkills: string[];
  educationLevel: string;
  certifications: string[];
  minSalary?: number;
  maxSalary?: number;
}

const ResumeFiltering = () => {
  const { candidates, loading } = useRealtimeData();
  const [filteredCandidates, setFilteredCandidates] = useState(candidates);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roleRequirements, setRoleRequirements] = useState<RoleRequirement[]>([]);
  const [currentRoleReq, setCurrentRoleReq] = useState<RoleRequirement>({
    role: '',
    description: '',
    minExperience: 0,
    requiredSkills: [],
    preferredSkills: [],
    educationLevel: '',
    certifications: [],
    minSalary: 0,
    maxSalary: 0
  });
  const [newSkill, setNewSkill] = useState('');
  const [newCertification, setNewCertification] = useState('');
  const [isProcessingATS, setIsProcessingATS] = useState(false);
  const [candidatesWithoutText, setCandidatesWithoutText] = useState(0);
  const { toast } = useToast();

  // Get unique roles from candidates
  const availableRoles = [...new Set(candidates.map(c => c.applied_role).filter(Boolean))];

  useEffect(() => {
    applyFilters();
    updateCandidatesWithoutText();
  }, [candidates, selectedRole, roleRequirements]);

  const updateCandidatesWithoutText = () => {
    const count = candidates.filter(c => 
      c.resume_url && (!c.resume_text || c.resume_text.length < 50)
    ).length;
    setCandidatesWithoutText(count);
  };

  const extractResumeTexts = async () => {
    const candidatesNeedingExtraction = candidates.filter(c => 
      c.resume_url && (!c.resume_text || c.resume_text.length < 50)
    );

    if (candidatesNeedingExtraction.length === 0) {
      toast({
        title: "No extraction needed",
        description: "All candidates with resumes already have extracted text"
      });
      return;
    }

    setIsProcessingATS(true);
    
    try {
      console.log(`Starting text extraction for ${candidatesNeedingExtraction.length} candidates...`);
      
      let successCount = 0;
      for (const candidate of candidatesNeedingExtraction) {
        try {
          console.log(`Extracting text for candidate: ${candidate.name}`);
          
          const { data, error } = await supabase.functions.invoke('extract-resume-text', {
            body: {
              resumeUrl: candidate.resume_url,
              candidateId: candidate.id
            }
          });

          if (error) {
            console.error(`Text extraction failed for ${candidate.name}:`, error);
          } else {
            console.log(`Text extraction successful for ${candidate.name}:`, data);
            successCount++;
          }

          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error processing candidate ${candidate.name}:`, error);
        }
      }

      toast({
        title: "Text Extraction Complete",
        description: `Successfully extracted text from ${successCount} out of ${candidatesNeedingExtraction.length} resumes`
      });

    } catch (error) {
      console.error('Error during text extraction:', error);
      toast({
        title: "Extraction Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessingATS(false);
    }
  };

  const processATSScoring = async () => {
    if (!selectedRole) {
      toast({
        title: "Select a role first",
        description: "Please select a role to process ATS scoring",
        variant: "destructive"
      });
      return;
    }

    const roleReq = roleRequirements.find(r => r.role === selectedRole);
    if (!roleReq) {
      toast({
        title: "Define role requirements",
        description: "Please define requirements for the selected role first",
        variant: "destructive"
      });
      return;
    }

    const candidatesForRole = candidates.filter(c => 
      c.applied_role === selectedRole && 
      c.resume_text && 
      c.resume_text.length > 50 &&
      (!c.ats_score || c.ats_score === 0)
    );

    if (candidatesForRole.length === 0) {
      toast({
        title: "No candidates to process",
        description: "No candidates found for this role with extracted resume text",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingATS(true);
    
    try {
      console.log(`Processing ATS scoring for ${candidatesForRole.length} ${selectedRole} candidates...`);

      const jobRequirements = `
Role: ${roleReq.role}
Description: ${roleReq.description}
Minimum Experience: ${roleReq.minExperience} years
Required Skills: ${roleReq.requiredSkills.join(', ')}
Preferred Skills: ${roleReq.preferredSkills.join(', ')}
Education Level: ${roleReq.educationLevel}
Required Certifications: ${roleReq.certifications.join(', ')}
Salary Range: ${roleReq.minSalary ? `$${roleReq.minSalary} - $${roleReq.maxSalary}` : 'Not specified'}
      `;

      let processedCount = 0;
      for (const candidate of candidatesForRole) {
        try {
          console.log(`Analyzing candidate: ${candidate.name}`);
          
          const aiFunctionName = 'ai-assistant';
          const { data, error } = await supabase.functions.invoke(aiFunctionName, {
            body: { 
              candidateId: candidate.id,
              resumeText: candidate.resume_text,
              jobRequirements: jobRequirements,
              action: 'analyze'
            }
          });

          if (error) {
            console.error(`Analysis failed for candidate ${candidate.name}:`, error);
          } else {
            console.log(`Analysis successful for candidate ${candidate.name}`);
            processedCount++;
          }

          // Small delay to avoid API rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`Error analyzing candidate ${candidate.name}:`, error);
        }
      }

      toast({
        title: "ATS Analysis Complete",
        description: `Successfully analyzed ${processedCount} out of ${candidatesForRole.length} candidates for ${selectedRole} role`
      });

    } catch (error) {
      console.error('Error during ATS analysis:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessingATS(false);
    }
  };

  const applyFilters = () => {
    let filtered = candidates;

    if (selectedRole) {
      filtered = filtered.filter(c => c.applied_role === selectedRole);
    }

    setFilteredCandidates(filtered);
  };

  const addSkillToRole = (type: 'required' | 'preferred') => {
    if (newSkill.trim()) {
      setCurrentRoleReq(prev => ({
        ...prev,
        [type === 'required' ? 'requiredSkills' : 'preferredSkills']: [
          ...(type === 'required' ? prev.requiredSkills : prev.preferredSkills),
          newSkill.trim()
        ]
      }));
      setNewSkill('');
    }
  };

  const removeSkillFromRole = (skill: string, type: 'required' | 'preferred') => {
    setCurrentRoleReq(prev => ({
      ...prev,
      [type === 'required' ? 'requiredSkills' : 'preferredSkills']: 
        (type === 'required' ? prev.requiredSkills : prev.preferredSkills).filter(s => s !== skill)
    }));
  };

  const addCertificationToRole = () => {
    if (newCertification.trim()) {
      setCurrentRoleReq(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification('');
    }
  };

  const removeCertificationFromRole = (cert: string) => {
    setCurrentRoleReq(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== cert)
    }));
  };

  const saveRoleRequirements = () => {
    if (!currentRoleReq.role.trim()) {
      toast({
        title: "Role name required",
        description: "Please enter a role name",
        variant: "destructive"
      });
      return;
    }

    setRoleRequirements(prev => {
      const existing = prev.findIndex(r => r.role === currentRoleReq.role);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = currentRoleReq;
        return updated;
      } else {
        return [...prev, currentRoleReq];
      }
    });

    toast({
      title: "Requirements saved",
      description: `Requirements for ${currentRoleReq.role} have been saved`
    });
  };

  const loadRoleRequirements = (role: string) => {
    const existing = roleRequirements.find(r => r.role === role);
    if (existing) {
      setCurrentRoleReq(existing);
    } else {
      setCurrentRoleReq({
        role,
        description: '',
        minExperience: 0,
        requiredSkills: [],
        preferredSkills: [],
        educationLevel: '',
        certifications: [],
        minSalary: 0,
        maxSalary: 0
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Role-Based ATS Filtering</h1>
        <div className="flex gap-2">
          {candidatesWithoutText > 0 && (
            <Button 
              onClick={extractResumeTexts} 
              disabled={isProcessingATS}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Extract Resume Text ({candidatesWithoutText})
            </Button>
          )}
          <Button 
            onClick={processATSScoring} 
            disabled={isProcessingATS || !selectedRole}
            className="bg-cyan-600 hover:bg-blue-700"
          >
            <Play className="h-4 w-4 mr-2" />
            {isProcessingATS ? 'Processing...' : 'Start ATS Analysis'}
          </Button>
        </div>
      </div>

      {/* Resume Text Extraction Status */}
      {candidatesWithoutText > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <strong>{candidatesWithoutText} candidates</strong> have resume URLs but no extracted text. 
            Click "Extract Resume Text" to process them first.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Requirements Setup */}
        <Card>
          <CardHeader>
            <CardTitle>Role Requirements Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Selection */}
            <div>
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={(value) => {
                setSelectedRole(value);
                loadRoleRequirements(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role to configure" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole && (
              <>
                {/* Role Description */}
                <div>
                  <Label>Role Description</Label>
                  <Textarea
                    value={currentRoleReq.description}
                    onChange={(e) => setCurrentRoleReq(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the role requirements, responsibilities, and ideal candidate profile..."
                    rows={4}
                  />
                </div>

                {/* Minimum Experience */}
                <div>
                  <Label>Minimum Experience: {currentRoleReq.minExperience} years</Label>
                  <Slider
                    value={[currentRoleReq.minExperience]}
                    onValueChange={(value) => setCurrentRoleReq(prev => ({ ...prev, minExperience: value[0] }))}
                    max={15}
                    step={1}
                    className="mt-2"
                  />
                </div>

                {/* Required Skills */}
                <div>
                  <Label>Required Skills</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add required skill..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addSkillToRole('required');
                        }
                      }}
                    />
                    <Button onClick={() => addSkillToRole('required')} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentRoleReq.requiredSkills.map(skill => (
                      <Badge key={skill} variant="default" className="cursor-pointer" 
                             onClick={() => removeSkillFromRole(skill, 'required')}>
                        {skill} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Preferred Skills */}
                <div>
                  <Label>Preferred Skills</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add preferred skill..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addSkillToRole('preferred');
                        }
                      }}
                    />
                    <Button onClick={() => addSkillToRole('preferred')} size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentRoleReq.preferredSkills.map(skill => (
                      <Badge key={skill} variant="secondary" className="cursor-pointer" 
                             onClick={() => removeSkillFromRole(skill, 'preferred')}>
                        {skill} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Education Level */}
                <div>
                  <Label>Education Level</Label>
                  <Select value={currentRoleReq.educationLevel} onValueChange={(value) => 
                    setCurrentRoleReq(prev => ({ ...prev, educationLevel: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select minimum education" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high_school">High School</SelectItem>
                      <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                      <SelectItem value="masters">Master's Degree</SelectItem>
                      <SelectItem value="phd">PhD</SelectItem>
                      <SelectItem value="diploma">Diploma/Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Certifications */}
                <div>
                  <Label>Required Certifications</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newCertification}
                      onChange={(e) => setNewCertification(e.target.value)}
                      placeholder="Add certification..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addCertificationToRole();
                        }
                      }}
                    />
                    <Button onClick={addCertificationToRole} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentRoleReq.certifications.map(cert => (
                      <Badge key={cert} variant="outline" className="cursor-pointer" 
                             onClick={() => removeCertificationFromRole(cert)}>
                        {cert} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Salary Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Salary</Label>
                    <Input
                      type="number"
                      value={currentRoleReq.minSalary}
                      onChange={(e) => setCurrentRoleReq(prev => ({ ...prev, minSalary: parseInt(e.target.value) || 0 }))}
                      placeholder="Minimum salary"
                    />
                  </div>
                  <div>
                    <Label>Max Salary</Label>
                    <Input
                      type="number"
                      value={currentRoleReq.maxSalary}
                      onChange={(e) => setCurrentRoleReq(prev => ({ ...prev, maxSalary: parseInt(e.target.value) || 0 }))}
                      placeholder="Maximum salary"
                    />
                  </div>
                </div>

                <Button onClick={saveRoleRequirements} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Role Requirements
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Filtered Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedRole ? `${selectedRole} Candidates` : 'All Candidates'} ({filteredCandidates.length})
              </span>
              <Search className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredCandidates.map(candidate => (
                <div key={candidate.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{candidate.name}</h3>
                    <div className="flex gap-2">
                      <Badge variant={candidate.ats_score >= 80 ? "default" : candidate.ats_score >= 60 ? "secondary" : "destructive"}>
                        ATS: {candidate.ats_score || 0}%
                      </Badge>
                      <Badge variant="outline">{candidate.status}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{candidate.email}</p>
                  <p className="text-sm">{candidate.applied_role} • {candidate.experience} • {candidate.location}</p>
                  
                  {/* Resume Text Status */}
                  <div className="flex items-center gap-2 text-xs">
                    {candidate.resume_url ? (
                      <Badge variant="outline" className="text-green-600">
                        Resume Available
                      </Badge>
                    ) : (
                      <Badge variant="destructive">No Resume</Badge>
                    )}
                    {candidate.resume_text && candidate.resume_text.length > 50 ? (
                      <Badge variant="outline" className="text-cyan-600">
                        Text Extracted ({candidate.resume_text.length} chars)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-600">
                        Text Needed
                      </Badge>
                    )}
                  </div>
                  
                  {candidate.skills && (
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 5).map(skill => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                      {candidate.skills.length > 5 && (
                        <Badge variant="outline" className="text-xs">+{candidate.skills.length - 5} more</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredCandidates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No candidates found for the selected role</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResumeFiltering;
