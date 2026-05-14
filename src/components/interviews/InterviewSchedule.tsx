
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Calendar, Clock, Video, Plus, Edit, Trash2, Loader2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AssessmentQualifiedCandidates from './AssessmentQualifiedCandidates';

const InterviewSchedule = () => {
  const { interviews, candidates, hrUsers, forceRefresh, autoScheduleAllQualified } = useRealtimeData();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [isAutomating, setIsAutomating] = useState(false);
  const { toast } = useToast();

  const hrManager = hrUsers.find(u => u.role === 'hr_manager') || hrUsers[0];

  const [availability, setAvailability] = useState({
    dates: ((hrManager as any)?.availability_dates || []).map((d: string) => new Date(d)),
    startTime: (hrManager as any)?.availability_start_time?.substring(0, 5) || '10:00',
    endTime: (hrManager as any)?.availability_end_time?.substring(0, 5) || '17:00'
  });

  // Sync state with database when hrManager updates via real-time
  React.useEffect(() => {
    if (hrManager) {
      setAvailability({
        dates: ((hrManager as any)?.availability_dates || []).map((d: string) => new Date(d)),
        startTime: (hrManager as any)?.availability_start_time?.substring(0, 5) || '10:00',
        endTime: (hrManager as any)?.availability_end_time?.substring(0, 5) || '17:00'
      });
    }
  }, [hrManager]);

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    return candidate?.name || 'Unknown Candidate';
  };

  const handleUpdateAvailability = async () => {
    if (!hrManager) return;
    setIsSaving(true);
    try {
      const dateStrings = availability.dates.map(d => format(d, 'yyyy-MM-dd'));
      const { error } = await supabase
        .from('hr_users')
        .update({
          availability_dates: dateStrings,
          availability_start_time: availability.startTime,
          availability_end_time: availability.endTime
        } as any)
        .eq('id', hrManager.id);

      if (error) throw error;
      toast({
        title: "Availability Updated",
        description: `Your interview slots have been set for ${dateStrings.length} specific dates.`
      });

      // Prompt for auto-scheduling
      const qualifiedCount = candidates.filter(c => {
        if (c.status === 'rejected') return false;
        const isQualifiedStatus = ['assessment_qualified', 'shortlisted', 'analyzed', 'assessment_completed'].includes(c.status || '');
        const isAssessmentDone = ['completed', 'evaluated', 'submitted', 'in_progress', 'assessment_completed'].includes(c.assessment_status || '');
        return isQualifiedStatus || isAssessmentDone;
      }).length;

      if (qualifiedCount > 0 && window.confirm(`You have ${qualifiedCount} qualified candidates waiting. Would you like to automatically schedule them into your new available slots?`)) {
        setIsAutomating(true);
        const scheduledCount = await autoScheduleAllQualified();
        setIsAutomating(false);

        toast({
          title: "Automation Complete",
          description: `Successfully scheduled ${scheduledCount} candidates and sent email invites.`,
        });
      }

      forceRefresh();
    } catch (error: any) {
      console.error('Availability update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update availability",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
      setIsAutomating(false);
    }
  };

  const interviewsOnSelectedDate = interviews.filter(interview => {
    if (!selectedDate) return false;
    const interviewDate = new Date(interview.scheduled_time);
    return interviewDate.toDateString() === selectedDate.toDateString();
  });

  const scheduledDates = interviews.map(i => new Date(i.scheduled_time));

  console.log('--- InterviewSchedule Debug ---');
  console.log('Total Interviews:', interviews.length);
  console.log('Selected Date:', selectedDate?.toDateString());
  console.log('Interviews on Selected Date:', interviewsOnSelectedDate.length);
  console.log('All Interviews Data:', interviews);
  console.log('-------------------------------');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Interview Stage</h1>
          <p className="text-muted-foreground text-sm">
            Set your preferred time slots and we'll handle the scheduling for you.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Availability Settings */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-sm border-border/60 hover-lift transition-all duration-200" className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 font-semibold">
                <Clock className="h-5 w-5" />
                When are you free?
              </CardTitle>
              <CardDescription>
                Any candidates who pass their assessments will be automatically fit into these times.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 flex justify-between">
                  <span>Pick your available dates</span>
                  <Badge variant="outline" className="text-[10px] text-slate-900 border-slate-200">
                    {availability.dates.length} selected
                  </Badge>
                </Label>
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <CalendarUI
                    mode="multiple"
                    selected={availability.dates}
                    onSelect={(dates) => setAvailability({ ...availability, dates: dates || [] })}
                    className="p-2"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground bg-white/50 p-1 rounded italic">
                  * Click specific dates on the mini-calendar above to mark your availability.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start_time" className="text-xs font-semibold text-slate-900">From</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={availability.startTime}
                    onChange={(e) => setAvailability({ ...availability, startTime: e.target.value })}
                    className="h-8 border-slate-200 focus-visible:ring-teal-500 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_time" className="text-xs font-semibold text-slate-900">To</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={availability.endTime}
                    onChange={(e) => setAvailability({ ...availability, endTime: e.target.value })}
                    className="h-8 border-slate-200 focus-visible:ring-teal-500 text-xs"
                  />
                </div>
              </div>

              <Button
                onClick={handleUpdateAvailability}
                disabled={availability.dates.length === 0 || isSaving}
                className="w-full bg-slate-900 hover:bg-slate-800 h-9"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
                Save Available Windows
              </Button>

              {availability.dates.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  <p className="text-[10px] text-amber-800 font-medium">Please pick dates on the calendar to enable auto-scheduling.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60 hover-lift transition-all duration-200" className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Today's Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Available Today</span>
                  <Badge variant="outline" className={availability.dates.some(d => d.toDateString() === new Date().toDateString()) ? "bg-green-50 text-green-700 border-green-200" : "text-slate-400"}>
                    {availability.dates.some(d => d.toDateString() === new Date().toDateString()) ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled Today</span>
                  <Badge variant="secondary" className="bg-slate-200 text-indigo-800">
                    {interviews.filter(i => new Date(i.scheduled_time).toDateString() === new Date().toDateString()).length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Upcoming This Week</span>
                  <Badge variant="secondary">
                    {interviews.filter(i => {
                      const d = new Date(i.scheduled_time);
                      const now = new Date();
                      const weekEnd = new Date();
                      weekEnd.setDate(now.getDate() + 7);
                      return d >= now && d <= weekEnd;
                    }).length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Calendar and Slots */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-sm border-border/60 hover-lift transition-all duration-200" className="overflow-hidden border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-4 border-r bg-slate-50/50">
                <CalendarIcon className="h-4 w-4 mb-2 text-slate-900" />
                <h3 className="font-semibold mb-4">Select Date</h3>
                <div className="bg-white rounded-lg border shadow-sm p-2">
                  <CalendarUI
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border-none"
                    modifiers={{
                      scheduled: scheduledDates,
                      available: availability.dates
                    }}
                    modifiersStyles={{
                      scheduled: { fontWeight: 'bold', textDecoration: 'underline', color: '#4f46e5' },
                      available: { backgroundColor: '#f0f9ff', color: '#0369a1', borderRadius: '50%' }
                    }}
                  />
                </div>
              </div>
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold border-b border-slate-800 pb-1">
                    Slots for {selectedDate ? format(selectedDate, 'MMMM dd, yyyy') : 'Selected Date'}
                  </h3>
                  {selectedDate && availability.dates.some(d => d.toDateString() === selectedDate.toDateString()) && (
                    <Badge className="bg-green-100 text-green-800 border-green-200">Available Window</Badge>
                  )}
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {interviewsOnSelectedDate.length > 0 ? (
                    interviewsOnSelectedDate.map((interview) => (
                      <div key={interview.id} className="p-4 rounded-xl border-l-4 border-l-indigo-500 border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-slate-900">{getCandidateName(interview.candidate_id)}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(interview.scheduled_time), 'hh:mm a')}</span>
                              <span className="mx-1">•</span>
                              <Badge className="text-[10px] h-4 px-1" variant="outline">{interview.interview_type}</Badge>
                            </div>
                          </div>
                          {interview.meeting_link && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-900" asChild>
                              <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer">
                                <Video className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Badge className={
                            interview.status === 'scheduled' ? 'bg-cyan-50 text-blue-700 border-cyan-200' :
                              interview.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-slate-50 text-slate-700'
                          }>
                            {interview.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
                        <Video className="h-6 w-6" />
                      </div>
                      <p className="text-slate-500 font-medium">No interviews scheduled</p>
                      <p className="text-slate-400 text-xs mt-1">
                        Any automatically scheduled slots for this day will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-12">
        <AssessmentQualifiedCandidates />
      </div>
    </div>
  );
};

export default InterviewSchedule;
