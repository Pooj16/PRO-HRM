
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Filter, Users, Target, TrendingUp, Brain, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FilterCriteria {
  minScore: number;
  maxScore: number;
  requiredSkills: string[];
  experienceYears: number;
  educationLevel: string;
  salaryRange: { min: number; max: number };
  locations: string[];
  autoShortlist: boolean;
}

const EnhancedResumeFiltering = () => {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [criteria, setCriteria] = useState<FilterCriteria>({
    minScore: 60,
    maxScore: 100,
    requiredSkills: [],
    experienceYears: 0,
    educationLevel: '',
    salaryRange: { min: 30000, max: 150000 },
    locations: [],
    autoShortlist: false
  });
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadCandidates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [candidates, criteria]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          resumes (
            ats_analysis,
            match_score
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error('Error loading candidates:', error);
      toast({
        title: "Error",
        description: "Failed to load candidates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const filtered = candidates.filter(candidate => {
      // Score filter
      const score = candidate.ats_score || 0;
      if (score < criteria.minScore || score > criteria.maxScore) return false;

      // Skills filter
      if (criteria.requiredSkills.length > 0) {
        const candidateSkills = candidate.skills || [];
        const hasAllSkills = criteria.requiredSkills.every(skill =>
          candidateSkills.some(cs => cs.toLowerCase().includes(skill.toLowerCase()))
        );
        if (!hasAllSkills) return false;
      }

      // Experience filter
      const resumeAnalysis = candidate.resumes?.[0]?.ats_analysis;
      if (resumeAnalysis?.workExperience?.totalYears) {
        if (resumeAnalysis.workExperience.totalYears < criteria.experienceYears) return false;
      }

      // Education filter
      if (criteria.educationLevel) {
        const education = resumeAnalysis?.education?.degree || '';
        if (!education.toLowerCase().includes(criteria.educationLevel.toLowerCase())) return false;
      }

      // Salary filter
      if (candidate.salary_expectation) {
        if (candidate.salary_expectation < criteria.salaryRange.min || 
            candidate.salary_expectation > criteria.salaryRange.max) return false;
      }

      // Location filter
      if (criteria.locations.length > 0 && candidate.location) {
        const hasLocation = criteria.locations.some(loc =>
          candidate.location.toLowerCase().includes(loc.toLowerCase())
        );
        if (!hasLocation) return false;
      }

      return true;
    });

    setFilteredCandidates(filtered);
  };

  const addSkill = () => {
    if (skillInput.trim() && !criteria.requiredSkills.includes(skillInput.trim())) {
      setCriteria(prev => ({
        ...prev,
        requiredSkills: [...prev.requiredSkills, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setCriteria(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(s => s !== skill)
    }));
  };

  const addLocation = () => {
    if (locationInput.trim() && !criteria.locations.includes(locationInput.trim())) {
      setCriteria(prev => ({
        ...prev,
        locations: [...prev.locations, locationInput.trim()]
      }));
      setLocationInput('');
    }
  };

  const removeLocation = (location: string) => {
    setCriteria(prev => ({
      ...prev,
      locations: prev.locations.filter(l => l !== location)
    }));
  };

  const bulkAction = async (action: string) => {
    setLoading(true);
    try {
      const candidateIds = filteredCandidates.map(c => c.id);
      
      let updateData = {};
      switch (action) {
        case 'shortlist':
          updateData = { status: 'shortlisted' };
          break;
        case 'reject':
          updateData = { status: 'rejected' };
          break;
        case 'review':
          updateData = { status: 'under_review' };
          break;
      }

      const { error } = await supabase
        .from('candidates')
        .update(updateData)
        .in('id', candidateIds);

      if (error) throw error;

      toast({
        title: "Bulk Action Completed",
        description: `${filteredCandidates.length} candidates updated`
      });

      loadCandidates();
    } catch (error) {
      console.error('Error in bulk action:', error);
      toast({
        title: "Error",
        description: "Failed to perform bulk action",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setCriteria({
      minScore: 60,
      maxScore: 100,
      requiredSkills: [],
      experienceYears: 0,
      educationLevel: '',
      salaryRange: { min: 30000, max: 150000 },
      locations: [],
      autoShortlist: false
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Enhanced Resume Filtering</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadCandidates} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={resetFilters} variant="outline">
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Candidates</p>
                <p className="text-2xl font-bold">{candidates.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Filtered Results</p>
                <p className="text-2xl font-bold text-green-600">{filteredCandidates.length}</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Scores (80+)</p>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredCandidates.filter(c => (c.ats_score || 0) >= 80).length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Analyzed</p>
                <p className="text-2xl font-bold text-orange-600">
                  {candidates.filter(c => c.ats_score && c.ats_score > 0).length}
                </p>
              </div>
              <Brain className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Score Range */}
            <div className="space-y-3">
              <Label>AI Score Range: {criteria.minScore} - {criteria.maxScore}</Label>
              <div className="px-3">
                <Slider
                  value={[criteria.minScore, criteria.maxScore]}
                  onValueChange={([min, max]) => setCriteria(prev => ({ ...prev, minScore: min, maxScore: max }))}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            {/* Experience Years */}
            <div className="space-y-3">
              <Label>Minimum Experience: {criteria.experienceYears} years</Label>
              <div className="px-3">
                <Slider
                  value={[criteria.experienceYears]}
                  onValueChange={([value]) => setCriteria(prev => ({ ...prev, experienceYears: value }))}
                  max={20}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Skills Filter */}
          <div className="space-y-3">
            <Label>Required Skills</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Add required skill"
                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
              />
              <Button onClick={addSkill} variant="outline">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {criteria.requiredSkills.map(skill => (
                <Badge key={skill} variant="secondary" className="cursor-pointer" onClick={() => removeSkill(skill)}>
                  {skill} ×
                </Badge>
              ))}
            </div>
          </div>

          {/* Education Level */}
          <div className="space-y-3">
            <Label>Education Level</Label>
            <Select value={criteria.educationLevel} onValueChange={(value) => setCriteria(prev => ({ ...prev, educationLevel: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                <SelectItem value="master">Master's Degree</SelectItem>
                <SelectItem value="phd">PhD</SelectItem>
                <SelectItem value="diploma">Diploma</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Salary Range */}
          <div className="space-y-3">
            <Label>Salary Range: ${criteria.salaryRange.min.toLocaleString()} - ${criteria.salaryRange.max.toLocaleString()}</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                value={criteria.salaryRange.min}
                onChange={(e) => setCriteria(prev => ({ 
                  ...prev, 
                  salaryRange: { ...prev.salaryRange, min: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Min salary"
              />
              <Input
                type="number"
                value={criteria.salaryRange.max}
                onChange={(e) => setCriteria(prev => ({ 
                  ...prev, 
                  salaryRange: { ...prev.salaryRange, max: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Max salary"
              />
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-3">
            <Label>Preferred Locations</Label>
            <div className="flex gap-2">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Add location"
                onKeyPress={(e) => e.key === 'Enter' && addLocation()}
              />
              <Button onClick={addLocation} variant="outline">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {criteria.locations.map(location => (
                <Badge key={location} variant="secondary" className="cursor-pointer" onClick={() => removeLocation(location)}>
                  {location} ×
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions ({filteredCandidates.length} candidates)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button 
              onClick={() => bulkAction('shortlist')} 
              disabled={loading || filteredCandidates.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              Shortlist All
            </Button>
            <Button 
              onClick={() => bulkAction('reject')} 
              disabled={loading || filteredCandidates.length === 0}
              variant="destructive"
            >
              Reject All
            </Button>
            <Button 
              onClick={() => bulkAction('review')} 
              disabled={loading || filteredCandidates.length === 0}
              variant="outline"
            >
              Mark for Review
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Filtered Candidates Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredCandidates.slice(0, 10).map(candidate => (
              <div key={candidate.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{candidate.name}</p>
                  <p className="text-sm text-gray-600">{candidate.email}</p>
                  <div className="flex gap-2 mt-1">
                    {candidate.skills?.slice(0, 3).map(skill => (
                      <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={candidate.ats_score >= 80 ? "default" : candidate.ats_score >= 60 ? "secondary" : "destructive"}>
                    Score: {candidate.ats_score || 0}
                  </Badge>
                  <p className="text-sm text-gray-600 mt-1">{candidate.status}</p>
                </div>
              </div>
            ))}
            {filteredCandidates.length > 10 && (
              <p className="text-center text-gray-600">
                And {filteredCandidates.length - 10} more candidates...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedResumeFiltering;
