
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, CheckCircle, XCircle, Eye, MessageSquare, CalendarDays } from 'lucide-react';

const TeamLeadDashboard = ({ teamLeadEmail = 'john.smith@company.com' }) => {
  const [assignments, setAssignments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAssignments();
    loadNotifications();
  }, [teamLeadEmail]);

  const loadAssignments = async () => {
    try {
      // Get team lead ID first
      const { data: teamLead, error: teamLeadError } = await supabase
        .from('team_leads')
        .select('id')
        .eq('email', teamLeadEmail)
        .single();

      if (teamLeadError || !teamLead) {
        console.log('Team lead not found for email:', teamLeadEmail);
        return;
      }

      // Get assignments for this team lead
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('candidate_assignments')
        .select(`
          *,
          candidates:candidate_id (
            id,
            name,
            email,
            position,
            ai_score,
            match_percentage,
            skills,
            education,
            experience,
            status,
            applied_date
          )
        `)
        .eq('team_lead_id', teamLead.id)
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError);
      } else {
        setAssignments(assignmentsData || []);
      }
    } catch (error) {
      console.error('Error in loadAssignments:', error);
    }
  };

  const loadNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', teamLeadEmail)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading notifications:', error);
    } else {
      setNotifications(data || []);
    }
  };

  const handleReviewAction = async (assignmentId, action) => {
    setLoading(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('candidate_assignments')
        .update({
          status,
          notes: reviewNotes,
          review_completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) throw error;

      // Update candidate status
      const assignment = assignments.find(a => a.id === assignmentId);
      if (assignment) {
        await supabase
          .from('candidates')
          .update({
            status: action === 'approve' ? 'approved' : 'rejected',
            assessment_status: action === 'approve' ? 'ready_for_assessment' : 'rejected'
          })
          .eq('id', assignment.candidate_id);
      }

      toast({
        title: `Candidate ${action === 'approve' ? 'approved' : 'rejected'}`,
        description: `The candidate has been ${action === 'approve' ? 'approved for assessment' : 'rejected'}.`
      });

      setSelectedCandidate(null);
      setReviewNotes('');
      loadAssignments();
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

  const markNotificationAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    loadNotifications();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingAssignments = assignments.filter(a => a.status === 'assigned');
  const reviewedAssignments = assignments.filter(a => a.status !== 'assigned');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Lead Dashboard</h1>
          <p className="text-muted-foreground">Review assigned candidates and manage your team's pipeline</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAssignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.filter(a => a.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.filter(a => a.status === 'rejected').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Notifications</CardTitle>
            <MessageSquare className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter(n => !n.is_read).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Reviews ({pendingAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            Reviewed ({reviewedAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications ({notifications.filter(n => !n.is_read).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidates Awaiting Review</CardTitle>
              <CardDescription>
                Review candidate profiles and decide whether to approve them for assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending candidate reviews</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>ATS Score</TableHead>
                        <TableHead>Match %</TableHead>
                        <TableHead>Applied Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{assignment.candidates.name}</div>
                              <div className="text-sm text-muted-foreground">{assignment.candidates.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{assignment.candidates.applied_role}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {assignment.candidates.ats_score || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {assignment.candidates.match_percentage || 0}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(assignment.candidates.applied_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedCandidate(assignment)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Review
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Review Candidate: {assignment.candidates.name}</DialogTitle>
                                  <DialogDescription>
                                    Review the candidate's profile and make a decision
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                     <div>
                                       <h4 className="font-medium">Basic Information</h4>
                                       <p><strong>Name:</strong> {assignment.candidates.name}</p>
                                       <p><strong>Email:</strong> {assignment.candidates.email}</p>
                                       <p><strong>Position:</strong> {assignment.candidates.applied_role}</p>
                                       <p><strong>ATS Score:</strong> {assignment.candidates.ats_score || 0}</p>
                                     </div>
                                    <div>
                                      <h4 className="font-medium">Qualifications</h4>
                                      <p><strong>Education:</strong> {assignment.candidates.education || 'Not specified'}</p>
                                      <p><strong>Experience:</strong> {assignment.candidates.experience || 'Not specified'}</p>
                                    </div>
                                  </div>
                                  
                                  {assignment.candidates.skills && (
                                    <div>
                                      <h4 className="font-medium mb-2">Skills</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {assignment.candidates.skills.map((skill, index) => (
                                          <Badge key={index} variant="secondary">{skill}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <label htmlFor="notes" className="block text-sm font-medium mb-2">
                                      Review Notes
                                    </label>
                                    <Textarea
                                      id="notes"
                                      value={reviewNotes}
                                      onChange={(e) => setReviewNotes(e.target.value)}
                                      placeholder="Add your review notes here..."
                                      rows={3}
                                    />
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => handleReviewAction(assignment.id, 'reject')}
                                      disabled={loading}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </Button>
                                    <Button
                                      onClick={() => handleReviewAction(assignment.id, 'approve')}
                                      disabled={loading}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve for Assessment
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reviewed Candidates</CardTitle>
              <CardDescription>
                Previously reviewed candidates and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewedAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No reviewed candidates yet</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Review Date</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewedAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{assignment.candidates.name}</div>
                              <div className="text-sm text-muted-foreground">{assignment.candidates.email}</div>
                            </div>
                           </TableCell>
                          <TableCell>{assignment.candidates.applied_role}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(assignment.status)}>
                              {assignment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.review_completed_at ? 
                              new Date(assignment.review_completed_at).toLocaleDateString() : 
                              'Pending'
                            }
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {assignment.notes || 'No notes'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Recent notifications and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border ${
                        notification.is_read ? 'bg-gray-50' : 'bg-cyan-50 border-cyan-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{notification.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamLeadDashboard;
