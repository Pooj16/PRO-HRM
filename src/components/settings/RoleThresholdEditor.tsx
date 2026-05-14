
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, Edit, Target } from 'lucide-react';

const RoleThresholdEditor = () => {
  const { roleThresholds } = useRealtimeData();
  const [teamLeads, setTeamLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    role_name: '',
    min_ats_score: 60,
    max_ats_score: 100,
    min_assessment_score: 70,
    auto_shortlist: true,
    team_lead_id: ''
  });

  React.useEffect(() => {
    loadTeamLeads();
  }, []);

  const loadTeamLeads = async () => {
    const { data, error } = await supabase
      .from('team_leads')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading team leads:', error);
    } else {
      setTeamLeads(data || []);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editingThreshold) {
        const { error } = await supabase
          .from('role_thresholds')
          .update(formData)
          .eq('id', editingThreshold.id);

        if (error) throw error;
        toast({ title: "Role threshold updated successfully" });
      } else {
        const { error } = await supabase
          .from('role_thresholds')
          .insert({
            ...formData,
            min_score: 0
          });

        if (error) throw error;
        toast({ title: "Role threshold created successfully" });
      }

      setDialogOpen(false);
      setEditingThreshold(null);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (threshold) => {
    setEditingThreshold(threshold);
    setFormData({
      role_name: threshold.role_name,
      min_ats_score: threshold.min_ats_score,
      max_ats_score: threshold.max_ats_score,
      min_assessment_score: threshold.min_assessment_score,
      auto_shortlist: threshold.auto_shortlist,
      team_lead_id: threshold.team_lead_id || ''
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      role_name: '',
      min_ats_score: 60,
      max_ats_score: 100,
      min_assessment_score: 70,
      auto_shortlist: true,
      team_lead_id: ''
    });
  };

  const getTeamLeadName = (teamLeadId) => {
    const lead = teamLeads.find(tl => tl.id === teamLeadId);
    return lead ? lead.name : 'Unassigned';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Role-Based ATS Thresholds
              </CardTitle>
              <CardDescription>
                Configure ATS score ranges and team lead assignments for each role
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingThreshold(null);
                  resetForm();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role Threshold
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingThreshold ? 'Edit Role Threshold' : 'Add New Role Threshold'}
                  </DialogTitle>
                  <DialogDescription>
                    Set ATS score requirements and team lead assignment for this role
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="role_name">Role Name</Label>
                    <Input
                      id="role_name"
                      value={formData.role_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, role_name: e.target.value }))}
                      placeholder="e.g., Frontend Developer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min_ats">Minimum ATS Score</Label>
                      <Input
                        id="min_ats"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.min_ats_score}
                        onChange={(e) => setFormData(prev => ({ ...prev, min_ats_score: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_ats">Maximum ATS Score</Label>
                      <Input
                        id="max_ats"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.max_ats_score}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_ats_score: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="min_assessment">Minimum Assessment Score</Label>
                    <Input
                      id="min_assessment"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.min_assessment_score}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_assessment_score: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="team_lead">Assigned Team Lead</Label>
                    <Select
                      value={formData.team_lead_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, team_lead_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team lead" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamLeads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.name} - {lead.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto_shortlist"
                      checked={formData.auto_shortlist}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_shortlist: checked }))}
                    />
                    <Label htmlFor="auto_shortlist">Enable Auto-Shortlisting</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>ATS Range</TableHead>
                  <TableHead>Min Assessment</TableHead>
                  <TableHead>Team Lead</TableHead>
                  <TableHead>Auto-Shortlist</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleThresholds.map((threshold) => (
                  <TableRow key={threshold.id}>
                    <TableCell className="font-medium">{threshold.role_name}</TableCell>
                    <TableCell>
                      {threshold.min_ats_score} - {threshold.max_ats_score}
                    </TableCell>
                    <TableCell>{threshold.min_assessment_score}</TableCell>
                    <TableCell>{getTeamLeadName(threshold.team_lead_id)}</TableCell>
                    <TableCell>
                      <Badge className={threshold.auto_shortlist ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {threshold.auto_shortlist ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(threshold)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleThresholdEditor;
