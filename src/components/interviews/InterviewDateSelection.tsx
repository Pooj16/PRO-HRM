
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Calendar as CalendarIcon, Clock, Users, Plus, Send } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const InterviewDateSelection = () => {
  const { candidates, scheduleInterview } = useRealtimeData();
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>(['10:00', '14:00', '16:00']);
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const { toast } = useToast();

  // Get candidates ready for interview scheduling
  const interviewReadyCandidates = candidates.filter(c => 
    c.assessment_status === 'completed' && 
    c.status === 'shortlisted'
  );

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId) 
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDates(prev => {
      const isSelected = prev.some(d => d.toDateString() === date.toDateString());
      if (isSelected) {
        return prev.filter(d => d.toDateString() !== date.toDateString());
      } else if (prev.length < 3) {
        return [...prev, date];
      }
      return prev;
    });
  };

  const addTimeSlot = () => {
    const newTime = document.getElementById('newTimeSlot') as HTMLInputElement;
    if (newTime && newTime.value && !timeSlots.includes(newTime.value)) {
      setTimeSlots(prev => [...prev, newTime.value]);
      newTime.value = '';
    }
  };

  const sendInterviewOptions = async () => {
    if (selectedCandidates.length === 0 || selectedDates.length === 0 || !interviewerEmail) {
      toast({
        title: "Missing Information",
        description: "Please select candidates, dates, and interviewer email",
        variant: "destructive"
      });
      return;
    }

    try {
      // In a real application, this would send options to candidates
      // For now, we'll create placeholder interview schedules
      for (const candidateId of selectedCandidates) {
        const scheduledTime = new Date(selectedDates[0]);
        scheduledTime.setHours(parseInt(timeSlots[0].split(':')[0]));
        scheduledTime.setMinutes(parseInt(timeSlots[0].split(':')[1]));

        await scheduleInterview({
          candidate_id: candidateId,
          interviewer_email: interviewerEmail,
          scheduled_time: scheduledTime.toISOString(),
          interview_type: 'Technical',
          duration_minutes: 60,
          notes: `Options provided: ${selectedDates.map(d => format(d, 'MMM dd')).join(', ')} at ${timeSlots.join(', ')}`
        });
      }

      toast({
        title: "Interview Options Sent",
        description: `Sent to ${selectedCandidates.length} candidates`
      });

      setSelectedCandidates([]);
      setSelectedDates([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send interview options",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Interview Date Selection
          </CardTitle>
          <CardDescription>
            Select candidates and provide multiple date/time options for interviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Candidate Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Candidates</h3>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interviewReadyCandidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedCandidates.includes(candidate.id)}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{candidate.name}</div>
                            <div className="text-sm text-muted-foreground">{candidate.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.applied_role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{candidate.ats_score}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {selectedCandidates.length > 0 && (
                <div className="bg-cyan-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    {selectedCandidates.length} candidate(s) selected
                  </p>
                </div>
              )}
            </div>

            {/* Date and Time Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Interview Options</h3>
              
              {/* Date Selection */}
              <div>
                <Label className="text-sm font-medium">Select Dates (up to 3)</Label>
                <div className="mt-2">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates || [])}
                    disabled={(date) => date < new Date() || selectedDates.length >= 3}
                    className="rounded-md border"
                  />
                </div>
                {selectedDates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedDates.map((date, index) => (
                      <Badge key={index} variant="outline">
                        {format(date, 'MMM dd, yyyy')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Slots */}
              <div>
                <Label className="text-sm font-medium">Time Slots</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="newTimeSlot"
                    type="time"
                    placeholder="Add time slot"
                    className="flex-1"
                  />
                  <Button onClick={addTimeSlot} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {timeSlots.map((time, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {time}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Interviewer */}
              <div>
                <Label htmlFor="interviewer">Interviewer Email</Label>
                <Input
                  id="interviewer"
                  type="email"
                  value={interviewerEmail}
                  onChange={(e) => setInterviewerEmail(e.target.value)}
                  placeholder="interviewer@company.com"
                />
              </div>
            </div>
          </div>

          {/* Send Options */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Ready to Send Options</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedCandidates.length} candidates will receive {selectedDates.length} date options with {timeSlots.length} time slots each
                </p>
              </div>
              <Button 
                onClick={sendInterviewOptions}
                disabled={selectedCandidates.length === 0 || selectedDates.length === 0 || !interviewerEmail}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Options
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {interviewReadyCandidates.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Candidates Ready</h3>
            <p className="text-muted-foreground">
              Candidates need to complete assessments before interview scheduling
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InterviewDateSelection;
