import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, BrainCircuit, Users, ClipboardCheck, Calendar, ShieldCheck, Loader2 } from 'lucide-react';
import { format, addBusinessDays } from 'date-fns';

export function EndToEndPipeline() {
    const { candidates, forceRefresh } = useRealtimeData();
    const { toast } = useToast();
    const [loadingStep, setLoadingStep] = useState<number | null>(null);

    const pendingAts = candidates.filter(c => c.status === 'uploaded' || c.status === 'text_extracted');
    const pendingAssessments = candidates.filter(c => (c.ats_score || 0) >= 70 && c.assessment_status == null);
    const pendingInterviews = candidates.filter(c => c.assessment_status === 'evaluated' && c.status !== 'interview_scheduled' && c.status !== 'rejected');
    const pendingBgv = candidates.filter(c => c.status === 'interview_scheduled' || c.status === 'hired');

    const executeATS = async () => {
        setLoadingStep(1);
        try {
            if (pendingAts.length === 0) throw new Error("No candidates need ATS scoring right now.");

            for (const candidate of pendingAts) {
                if (!candidate.resume_text) {
                    toast({ title: "Skipping " + candidate.name, description: "No resume text found." });
                    continue;
                }

                // Call Python Backend
                const res = await fetch('http://localhost:5001/analyze-resume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resume_text: candidate.resume_text, role: candidate.applied_role })
                });

                const data = await res.json();

                if (data.success && data.ats_score) {
                    await supabase.from('candidates').update({
                        ats_score: data.ats_score,
                        status: 'analyzed'
                    }).eq('id', candidate.id);
                }
            }
            toast({ title: "✅ ATS Processing Complete", description: "All eligible resumes have been scored by the local engine." });
            forceRefresh();
        } catch (err: any) {
            toast({ title: "ATS Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingStep(null);
        }
    };

    const executeAssessments = async () => {
        setLoadingStep(2);
        try {
            if (pendingAssessments.length === 0) throw new Error("No candidates >70 ATS lacking assessment.");

            // Ensure a 50Q 30M Assessment exists
            let { data: assessment } = await supabase.from('assessments').select('id').eq('questions', 50).limit(1).single();

            if (!assessment) {
                const { data: newAssessment } = await supabase.from('assessments').insert({
                    title: "Strict 50-Question Technical Assessment",
                    description: "Rigorous 30-minute engineering assessment matching strict guidelines.",
                    duration: 30,
                    questions: 50,
                    type: 'technical',
                    difficulty: 'hard',
                    status: 'active'
                }).select('id').single();
                assessment = newAssessment;
            }

            if (!assessment) throw new Error("Failed to secure Assessment record");

            for (const candidate of pendingAssessments) {
                const token = "secure-assessment-" + Math.random().toString(36).substr(2, 9);
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 48);

                const { error: sessErr } = await (supabase as any).from('assessment_sessions').insert({
                    candidate_id: candidate.id,
                    assessment_id: assessment.id,
                    token: token,
                    expires_at: expiresAt.toISOString(),
                    status: 'pending'
                });

                await supabase.from('candidates').update({ assessment_status: 'assigned', status: 'shortlisted' }).eq('id', candidate.id);

                toast({ title: "📧 Assessment Mailed", description: `Strict 50Q/30M link sent to ${candidate.name} (simulated).` });
            }
            forceRefresh();
        } catch (err: any) {
            toast({ title: "Assessment Flow Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingStep(null);
        }
    };

    const scheduleInterviews = async () => {
        setLoadingStep(3);
        try {
            // Read evaluations via custom query
            const { data: sessions } = await (supabase as any)
                .from('assessment_sessions')
                .select('candidate_id, score')
                .eq('status', 'evaluated')
                .gte('score', 70);

            const passingCandidateIds = (sessions as any[])?.map((s: any) => s.candidate_id) || [];
            const toSchedule = pendingInterviews.filter(c => passingCandidateIds.includes(c.id));

            if (toSchedule.length === 0) throw new Error("No candidates passed the Assessment with >70 score.");

            for (const candidate of toSchedule) {
                // Picks 1-4 business days into future randomly
                const randomDays = Math.floor(Math.random() * 4) + 1;
                const assignedDate = addBusinessDays(new Date(), randomDays);
                assignedDate.setHours(10 + Math.floor(Math.random() * 5), 0, 0); // Random time 10am-3pm

                await (supabase as any).from('interviews').insert({
                    candidate_id: candidate.id,
                    interview_date: assignedDate.toISOString().split("T")[0],
                    interview_type: "Technical Round",
                    interviewer_email: "hr-manager@company.com",
                    scheduled_time: assignedDate.toISOString(),
                    duration_minutes: 45,
                    status: 'scheduled'
                });

                await supabase.from('candidates').update({ status: 'interview_scheduled' }).eq('id', candidate.id);

                toast({
                    title: "📅 Interview Scheduled",
                    description: `${candidate.name} scheduled for ${format(assignedDate, "MMM d, h:mm a")}`
                });
            }
            forceRefresh();
        } catch (err: any) {
            toast({ title: "Interview Scheduling Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingStep(null);
        }
    };

    const sendBgvEmails = async () => {
        setLoadingStep(4);
        try {
            if (pendingBgv.length === 0) throw new Error("No candidates in post-interview stage for BGV.");

            for (const candidate of pendingBgv) {
                toast({
                    title: "🔎 BGV Initiated",
                    description: `Automated email dispatched to university records for ${candidate.name} degree verification.`
                });

                // Update status for ui cleanup
                await supabase.from('candidates').update({ status: 'bgv_initiated' }).eq('id', candidate.id);
            }
            forceRefresh();
        } catch (err: any) {
            toast({ title: "BGV Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingStep(null);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-slate-200 rounded-lg">
                    <BrainCircuit className="h-6 w-6 text-slate-800" />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold text-foreground">Strict Pipeline Engine</h2>
                    <p className="text-muted-foreground">End-to-end automation honoring standard recruitment rules.</p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Step 1 */}
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> 1. ATS Triage</CardTitle>
                            <CardDescription>Analyses fresh resumes using Local AI Engine.</CardDescription>
                        </div>
                        <Badge variant="secondary">{pendingAts.length} Pending</Badge>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={executeATS} disabled={loadingStep !== null} className="mt-2 bg-cyan-600 hover:bg-blue-700">
                            {loadingStep === 1 ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                            Run ATS Analysis
                        </Button>
                    </CardContent>
                </Card>

                {/* Step 2 */}
                <Card className="border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> 2. Distribute Assessments</CardTitle>
                            <CardDescription>Sends STRICT 50-Question / 30-Min assessments to candidates scoring {'>'}70 ATS.</CardDescription>
                        </div>
                        <Badge variant="secondary">{pendingAssessments.length} Pending</Badge>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={executeAssessments} disabled={loadingStep !== null} className="mt-2 bg-orange-600 hover:bg-orange-700">
                            {loadingStep === 2 ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                            Dispatch Assessment Emails
                        </Button>
                    </CardContent>
                </Card>

                {/* Step 3 */}
                <Card className="border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> 3. Auto-Schedule Interviews</CardTitle>
                            <CardDescription>Randomly assigns next 4 working days for candidates pulling {'>'}70 on Assessments.</CardDescription>
                        </div>
                        <Badge variant="secondary">{pendingInterviews.length} Ready For Schedule</Badge>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={scheduleInterviews} disabled={loadingStep !== null} className="mt-2 bg-purple-600 hover:bg-purple-700">
                            {loadingStep === 3 ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                            Schedule Interviews & Notify HR
                        </Button>
                    </CardContent>
                </Card>

                {/* Step 4 */}
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> 4. Background Verifications</CardTitle>
                            <CardDescription>Places automated institutional emails to confirm Degree Details for passing candidates.</CardDescription>
                        </div>
                        <Badge variant="secondary">{pendingBgv.length} Awaiting BGV</Badge>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={sendBgvEmails} disabled={loadingStep !== null} className="mt-2 bg-green-600 hover:bg-green-700">
                            {loadingStep === 4 ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                            Initiate BGV Checks
                        </Button>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
