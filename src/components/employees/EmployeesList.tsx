
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Search, Users, Mail, Building2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const EmployeesList = () => {
  const { candidates, roleThresholds } = useRealtimeData();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [minAtsScore, setMinAtsScore] = useState(60);
  const [maxAtsScore, setMaxAtsScore] = useState(100);
  const [minAssessmentScore, setMinAssessmentScore] = useState(70);
  const [autoShortlist, setAutoShortlist] = useState(true);
  const { toast } = useToast();

  // Get employees (hired candidates)
  const employees = candidates.filter(c => c.status === 'hired');
  
  // Get unique roles from thresholds
  const roles = roleThresholds.map(rt => rt.role_name);

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || employee.applied_role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getTeamLead = (applied_role: string) => {
    const threshold = roleThresholds.find(rt => rt.role_name === applied_role);
    return threshold?.team_lead_id ? 'Assigned' : 'No Team Lead';
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a role name",
        variant: "destructive"
      });
      return;
    }

    // Check if role already exists
    if (roleThresholds.some(rt => rt.role_name.toLowerCase() === newRoleName.toLowerCase())) {
      toast({
        title: "Error",
        description: "This role already exists",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('role_thresholds')
        .insert({
          role_name: newRoleName.trim(),
          min_score: 0,
          min_ats_score: minAtsScore,
          max_ats_score: maxAtsScore,
          min_assessment_score: minAssessmentScore,
          auto_shortlist: autoShortlist,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Role Added",
        description: `${newRoleName} role has been added successfully`
      });

      // Reset form
      setNewRoleName('');
      setMinAtsScore(60);
      setMaxAtsScore(100);
      setMinAssessmentScore(70);
      setAutoShortlist(true);
      setIsAddRoleDialogOpen(false);
    } catch (error) {
      console.error('Failed to add role:', error);
      toast({
        title: "Error",
        description: "Failed to add role",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6" />
                Employees Directory
              </CardTitle>
              <CardDescription>
                View all hired employees organized by roles and team leads
              </CardDescription>
            </div>
            <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Role</DialogTitle>
                  <DialogDescription>
                    Create a new role with ATS scoring thresholds
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input
                      id="roleName"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g. Senior Developer, Marketing Manager"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minAts">Min ATS Score</Label>
                      <Input
                        id="minAts"
                        type="number"
                        min="0"
                        max="100"
                        value={minAtsScore}
                        onChange={(e) => setMinAtsScore(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxAts">Max ATS Score</Label>
                      <Input
                        id="maxAts"
                        type="number"
                        min="0"
                        max="100"
                        value={maxAtsScore}
                        onChange={(e) => setMaxAtsScore(parseInt(e.target.value) || 100)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="minAssessment">Min Assessment Score</Label>
                    <Input
                      id="minAssessment"
                      type="number"
                      min="0"
                      max="100"
                      value={minAssessmentScore}
                      onChange={(e) => setMinAssessmentScore(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autoShortlist"
                      checked={autoShortlist}
                      onChange={(e) => setAutoShortlist(e.target.checked)}
                    />
                    <Label htmlFor="autoShortlist">Auto-shortlist qualified candidates</Label>
                  </div>
                  <Button onClick={handleAddRole} className="w-full">
                    Add Role
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {roles.map(role => {
              const roleEmployees = employees.filter(e => e.applied_role === role);
              const threshold = roleThresholds.find(rt => rt.role_name === role);
              
              return (
                <Card key={role}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>{role}</span>
                      <Badge variant="secondary">{roleEmployees.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 mb-1">
                        <Building2 className="h-3 w-3" />
                        Team Lead: {threshold?.team_lead_id ? 'Assigned' : 'Not Assigned'}
                      </div>
                      <div>ATS Range: {threshold?.min_ats_score}-{threshold?.max_ats_score}%</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Employees Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team Lead Status</TableHead>
                  <TableHead>ATS Score</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-muted-foreground">{employee.location}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.applied_role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTeamLead(employee.applied_role) === 'Assigned' ? 'default' : 'secondary'}>
                        {getTeamLead(employee.applied_role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{employee.ats_score || 0}%</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {employee.skills?.slice(0, 3).map(skill => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {employee.skills && employee.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{employee.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm">{employee.email}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {employees.length === 0 
                  ? "No employees hired yet" 
                  : "No employees found matching your criteria"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeesList;
