
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';

const TeamLeadManagement = () => {
  const { roleThresholds } = useRealtimeData();
  const [teamLeads, setTeamLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    role_specializations: []
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
      const payload = {
        ...formData,
        role_specializations: formData.role_specializations.filter(s => s.trim())
      };

      if (editingLead) {
        const { error } = await supabase
          .from('team_leads')
          .update(payload)
          .eq('id', editingLead.id);

        if (error) throw error;
        toast({ title: "Team lead updated successfully" });
      } else {
        const { error } = await supabase
          .from('team_leads')
          .insert(payload);

        if (error) throw error;
        toast({ title: "Team lead added successfully" });
      }

      setDialogOpen(false);
      setEditingLead(null);
      setFormData({ name: '', email: '', department: '', role_specializations: [] });
      loadTeamLeads();
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

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email,
      department: lead.department || '',
      role_specializations: lead.role_specializations || []
    });
    setDialogOpen(true);
  };

  const handleDelete = async (leadId) => {
    if (!confirm('Are you sure you want to delete this team lead?')) return;

    try {
      const { error } = await supabase
        .from('team_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      toast({ title: "Team lead deleted successfully" });
      loadTeamLeads();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addSpecialization = () => {
    setFormData(prev => ({
      ...prev,
      role_specializations: [...prev.role_specializations, '']
    }));
  };

  const updateSpecialization = (index, value) => {
    setFormData(prev => ({
      ...prev,
      role_specializations: prev.role_specializations.map((spec, i) => 
        i === index ? value : spec
      )
    }));
  };

  const removeSpecialization = (index) => {
    setFormData(prev => ({
      ...prev,
      role_specializations: prev.role_specializations.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Lead Management
              </CardTitle>
              <CardDescription>
                Manage team leads and their role specializations
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingLead(null);
                  setFormData({ name: '', email: '', department: '', role_specializations: [''] });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingLead ? 'Edit Team Lead' : 'Add New Team Lead'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure team lead details and role specializations
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter department"
                    />
                  </div>
                  <div>
                    <Label>Role Specializations</Label>
                    <div className="space-y-2">
                      {formData.role_specializations.map((spec, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={spec}
                            onChange={(e) => updateSpecialization(index, e.target.value)}
                            placeholder="Enter role specialization"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSpecialization(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSpecialization}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Specialization
                      </Button>
                    </div>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Specializations</TableHead>
                  <TableHead>Assigned Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamLeads.map((lead) => {
                  const assignedRoles = roleThresholds.filter(rt => rt.team_lead_id === lead.id);
                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.department}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {lead.role_specializations?.map((spec, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignedRoles.map((role, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {role.role_name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(lead)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(lead.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamLeadManagement;
