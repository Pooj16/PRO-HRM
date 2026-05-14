
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddCandidateDialog = ({ open, onOpenChange }: AddCandidateDialogProps) => {
  const { addCandidate } = useRealtimeData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    applied_role: '',
    experience: '',
    location: '',
    education: '',
    salary_expectation: '',
    resume_url: '',
    skills: [] as string[]
  });
  const [newSkill, setNewSkill] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for duplicate email before inserting
      const { data: existing } = await supabase
        .from('candidates')
        .select('id, name')
        .eq('email', formData.email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        toast({
          title: "Duplicate Email",
          description: `A candidate (${existing.name}) with email ${formData.email} already exists.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const candidateData = {
        ...formData,
        email: formData.email.toLowerCase().trim(),
        salary_expectation: formData.salary_expectation ? parseInt(formData.salary_expectation) : undefined,
        status: 'uploaded'
      };

      const candidate = await addCandidate(candidateData);

      // If resume URL is provided, automatically trigger text extraction via Edge Function
      if (formData.resume_url.trim()) {
        try {
          console.log(`📄 Triggering edge function extraction for new candidate: ${candidate.id}`);
          const { data: extractData, error: extractionError } = await supabase.functions.invoke('trigger-text-extraction', {
            body: { candidateId: candidate.id }
          });

          if (extractionError || extractData?.success === false) {
            throw new Error(extractionError?.message || extractData?.error || 'Extraction failed');
          }

          toast({
            title: "Candidate Added",
            description: `${formData.name} has been added and resume text extracted successfully.`,
          });
        } catch (error) {
          console.error('Resume text extraction trigger failed:', error);
          toast({
            title: "Candidate Added",
            description: `${formData.name} was added, but text extraction could not be initiated.`,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Candidate Added",
          description: `${formData.name} has been successfully added to the system.`,
        });
      }

      // Reset form
      setFormData({
        name: '',
        email: '',
        applied_role: '',
        experience: '',
        location: '',
        education: '',
        salary_expectation: '',
        resume_url: '',
        skills: []
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error adding candidate:', error);
      toast({
        title: "Error",
        description: "Failed to add candidate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Candidate</DialogTitle>
          <DialogDescription>
            Enter candidate details. Resume text will be automatically extracted if URL is provided.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="applied_role">Position Applied For</Label>
              <Input
                id="applied_role"
                value={formData.applied_role}
                onChange={(e) => setFormData(prev => ({ ...prev, applied_role: e.target.value }))}
                placeholder="e.g., Software Developer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., New York, NY"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="experience">Experience Level</Label>
              <Select value={formData.experience} onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                  <SelectItem value="mid">Mid Level (3-5 years)</SelectItem>
                  <SelectItem value="senior">Senior Level (6-10 years)</SelectItem>
                  <SelectItem value="lead">Lead/Manager (10+ years)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary">Expected Salary</Label>
              <Input
                id="salary"
                type="number"
                value={formData.salary_expectation}
                onChange={(e) => setFormData(prev => ({ ...prev, salary_expectation: e.target.value }))}
                placeholder="e.g., 75000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="education">Education</Label>
            <Input
              id="education"
              value={formData.education}
              onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
              placeholder="e.g., Bachelor's in Computer Science"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resume_url">Resume URL (Optional)</Label>
            <Input
              id="resume_url"
              value={formData.resume_url}
              onChange={(e) => setFormData(prev => ({ ...prev, resume_url: e.target.value }))}
              placeholder="e.g., https://drive.google.com/file/d/..."
            />
            <p className="text-xs text-muted-foreground">
              Provide a direct downloadable link to the resume. Text will be automatically extracted.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              />
              <Button type="button" onClick={addSkill} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.skills.map((skill, index) => (
                <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-cyan-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Candidate'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCandidateDialog;
