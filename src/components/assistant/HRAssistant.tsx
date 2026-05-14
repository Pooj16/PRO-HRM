import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface Message {
    role: 'assistant' | 'user';
    content: string;
    timestamp: Date;
}

// ─── Smart Local AI Engine ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    shortlisted: 'Shortlisted',
    assessment_pending: 'Assessment link sent',
    assessment_qualified: 'Assessment Passed ✅',
    assessment_failed: 'Assessment Failed ❌',
    assessment_completed: 'Assessment Done',
    interview_scheduled: 'Interview Scheduled 📅',
    interviewed: 'Interviewed 🎤',
    hired: 'Joined the team! 🎉',
    rejected: 'Rejected 🚫',
    bgv_initiated: 'BGV In Progress 🔍',
};

type Candidate = {
    id: string;
    name: string;
    email?: string;
    applied_role?: string;
    status?: string;
    assessment_status?: string;
    ats_score?: number;
};

type Interview = {
    candidate_id?: string;
    scheduled_time?: string;
    status?: string;
};

function generateResponse(query: string, candidates: Candidate[], interviews: Interview[]): string {
    const q = query.toLowerCase();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // ── HELPER FUNCTIONS ──────────────────────────────────────────────────────

    const byRole = (role: string) =>
        candidates.filter(c => c.applied_role?.toLowerCase().includes(role));

    const getInterviewDate = (candidateId: string) => {
        const iv = interviews.find(i => i.candidate_id === candidateId);
        if (!iv?.scheduled_time) return null;
        return new Date(iv.scheduled_time);
    };

    const formatDate = (d: Date) =>
        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const scored = candidates.filter(c => c.ats_score && c.ats_score > 0)
        .sort((a, b) => (b.ats_score || 0) - (a.ats_score || 0));

    const qualified = candidates.filter(c =>
        c.status === 'assessment_qualified' || c.status === 'interview_scheduled'
    );

    const pending = candidates.filter(c =>
        c.status === 'assessment_pending' || c.status === 'new' || c.status === 'shortlisted'
    );

    const scheduled = candidates.filter(c => c.status === 'interview_scheduled');

    const thisWeekInterviews = interviews.filter(iv => {
        if (!iv.scheduled_time) return false;
        const d = new Date(iv.scheduled_time);
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= -1 && diffDays <= 7;
    });

    // ── PIPELINE SUMMARY ─────────────────────────────────────────────────────
    if (/summary|overview|pipeline|status|today|report/.test(q)) {
        const roles = [...new Set(candidates.map(c => c.applied_role).filter(Boolean))];
        const roleBreakdown = roles.map(role => {
            const rc = candidates.filter(c => c.applied_role === role);
            return `  • ${role}: ${rc.length} total — ${rc.filter(c => c.status === 'assessment_qualified').length} qualified, ${rc.filter(c => c.status === 'interview_scheduled').length} scheduled`;
        }).join('\n');

        return `👋 **Here is how the pipeline looks right now:** (as of ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})

We have **{candidates.length}** candidates in total. **${candidates.length}**
✨ **${qualified.length}** have cleared their assessments successfully. **${qualified.length}**
🗓️ **${scheduled.length}** are already on the calendar for interviews. **${scheduled.length}**
⏳ **${pending.length}** are still moving through their initial stages. **${pending.length}**
🎉 Hired: **${candidates.filter(c => c.status === 'hired').length}**
🚫 Rejected: **${candidates.filter(c => c.status === 'rejected').length}**

**By Applying for**
${roleBreakdown || '  (No roles assigned yet)'}

${thisWeekInterviews.length > 0
                ? `📆 **${thisWeekInterviews.length}** interview(s) scheduled this week.`
                : '📆 No interviews scheduled this week yet.'}`;
    }

    // ── TOP CANDIDATES ───────────────────────────────────────────────────────
    if (/top|best|highest score|strongest|ranked|recommend/.test(q)) {
        const roleFilter = q.match(/for\s+([a-z\s]+?)(?:\s*\?|$)/)?.[1]?.trim();
        let pool = roleFilter ? byRole(roleFilter) : scored;
        if (pool.length === 0) pool = scored;
        const top = pool.slice(0, 5);

        if (top.length === 0) return "I\'m not seeing any scores yet! Once candidates finish their assessments, I\'ll be able to rank them for you here. ✨";

        const lines = top.map((c, i) =>
            `${i + 1}. **${c.name}** — Applying for ${c.applied_role || '?'} | Their match score is ${c.ats_score || 'N/A'} | Current status is ${STATUS_LABELS[c.status || ''] || c.status}`
        ).join('\n');

        return `🏆 **Top Candidates${roleFilter ? ` for ${roleFilter}` : ''}:**\n\n${lines}`;
    }

    // ── INTERVIEW SCHEDULE ───────────────────────────────────────────────────
    if (/interview|schedule|this week|upcoming/.test(q)) {
        if (scheduled.length === 0) return "\"The calendar is clear! No interviews scheduled\" at the moment.";

        const lines = scheduled.map(c => {
            const d = getInterviewDate(c.id);
            return `  • **${c.name}** (${c.applied_role || 'Role N/A'}) — ${d ? formatDate(d) : 'Time TBD'}`;
        }).join('\n');

        return `📅 **Scheduled Interviews (${scheduled.length}):**\n\n${lines}`;
    }

    // ── QUALIFIED CANDIDATES ─────────────────────────────────────────────────
    if (/qualified|passed|eligible|ready to interview/.test(q)) {
        const readyToSchedule = qualified.filter(c => c.status === 'assessment_qualified');

        if (qualified.length === 0)
            return "It looks like \"no one has passed the assessments just yet\". Maybe a quick reminder to those who haven't finished would help?";

        const lines = qualified.map(c =>
            `  • **${c.name}** — ${c.applied_role || '?'} | ${STATUS_LABELS[c.status || ''] || c.status} | Score: ${c.ats_score || 'N/A'}`
        ).join('\n');

        return `✅ **${qualified.length} Qualified Candidate(s):**\n\n${lines}${readyToSchedule.length > 0
            ? `\n\n👉 **${readyToSchedule.length}** candidate(s) are ready to be interviewed but not yet scheduled.`
            : ''}`;
    }

    // ── FOLLOW-UP / STUCK ────────────────────────────────────────────────────
    if (/follow.?up|stuck|pending|waiting|not responded|no response/.test(q)) {
        const stuckCandidates = candidates.filter(c =>
            ['new', 'shortlisted', 'assessment_pending'].includes(c.status || '')
        );

        if (stuckCandidates.length === 0)
            return "✅ All candidates are progressing through the pipeline. No follow-ups needed right now!";

        const lines = stuckCandidates.map(c =>
            `  • **${c.name}** (${c.email || 'no email'}) — ${c.applied_role || '?'} | Stage: ${STATUS_LABELS[c.status || ''] || c.status}`
        ).join('\n');

        return `⚠️ **${stuckCandidates.length} Candidate(s) Need Follow-Up:**\n\n${lines}\n\n💡 Consider sending a reminder email or checking if they received their assessment links.`;
    }

    // ── SPECIFIC CANDIDATE LOOKUP ─────────────────────────────────────────────
    const nameMentioned = candidates.find(c =>
        c.name && q.includes(c.name.toLowerCase())
    );

    if (nameMentioned) {
        const c = nameMentioned;
        const iv = getInterviewDate(c.id);
        return `👤 **${c.name}**

• Applying for ${c.applied_role || 'Not specified'}
• Email: ${c.email || 'N/A'}
• Current status is ${STATUS_LABELS[c.status || ''] || c.status}
• Their match score is ${c.ats_score || 'Not scored'}
• Assessment: ${c.assessment_status || 'Not started'}
• Interview: ${iv ? formatDate(iv) : 'Not scheduled'}`;
    }

    // ── ROLE-SPECIFIC QUERY ───────────────────────────────────────────────────
    const roleWords = ['engineer', 'developer', 'designer', 'manager', 'analyst', 'intern', 'lead', 'architect'];
    const roleMatch = roleWords.find(r => q.includes(r));
    if (roleMatch) {
        const pool = byRole(roleMatch);
        if (pool.length === 0) return `🔍 No candidates found for "${roleMatch}" roles.`;
        const lines = pool.map(c =>
            `  • **${c.name}** — Score: ${c.ats_score || 'N/A'} | Current status is ${STATUS_LABELS[c.status || ''] || c.status}`
        ).join('\n');
        return `👥 **${pool.length} Candidate(s) for ${roleMatch} role:**\n\n${lines}`;
    }

    // ── FAILED / REJECTED ────────────────────────────────────────────────────
    if (/fail|failed|reject|rejected/.test(q)) {
        const pool = candidates.filter(c => c.status === 'rejected' || c.status === 'assessment_failed');
        if (pool.length === 0) return "✅ No candidates have been rejected or failed yet.";
        const lines = pool.map(c => `  • **${c.name}** — ${c.applied_role || '?'} | ${STATUS_LABELS[c.status || ''] || c.status}`).join('\n');
        return `📋 **${pool.length} Rejected/Failed Candidate(s):**\n\n${lines}`;
    }

    // ── HIRED ─────────────────────────────────────────────────────────────────
    if (/hired|offer|joined/.test(q)) {
        const pool = candidates.filter(c => c.status === 'hired');
        if (pool.length === 0) return "🤝 No candidates have been hired yet. Schedule interviews for your qualified candidates!";
        const lines = pool.map(c => `  • 🎉 **${c.name}** — ${c.applied_role || '?'}`).join('\n');
        return `🎉 **Hired Candidates (${pool.length}):**\n\n${lines}`;
    }

    // ── DEFAULT ───────────────────────────────────────────────────────────────
    return `🤔 I can answer questions about your live pipeline! Try:

• "Give me a pipeline summary"
• "Who are the top candidates for Software Engineer?"
• "Who needs follow-up?"
• "Who is scheduled for interviews?"
• "Show qualified candidates"
• "Tell me about [candidate name]"

I currently have data on **${candidates.length}** candidates across **${[...new Set(candidates.map(c => c.applied_role).filter(Boolean))].length}** roles.`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const HRAssistant = () => {
    const { candidates, interviews } = useRealtimeData();
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: `👋 Hi there! I'm Sparky, your HR assistant. I keep track of everything happening in your hiring pipeline so you don"t have to. Ask me anything!\n\n• "Pipeline summary"\n• "Top candidates for Software Engineer"\n• "Who needs follow-up?"\n• "Who has interviews scheduled?"`,
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Update greeting when data loads
    useEffect(() => {
        if (candidates.length > 0) {
            setMessages(prev => [{
                ...prev[0],
                content: `👋 Hi! I'm Sparky. I'm currently looking at **${candidates.length} candidates** across ${[...new Set(candidates.map((c: any) => c.applied_role).filter(Boolean))].length} different roles.\n\nWhat would you like to know about the pipeline today?\n\n• "Pipeline summary"\n• "Top candidates for Software Engineer"\n• "Who needs follow-up?"\n• "Who has interviews scheduled?"`
            }, ...prev.slice(1)]);
        }
    }, [candidates.length]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);
        setInput('');
        setIsTyping(true);

        // Simulate a short thinking delay for UX
        await new Promise(r => setTimeout(r, 600));

        try {
            const reply = generateResponse(userMsg, candidates as any, interviews as any);
            setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Something went wrong. Please try again.',
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const renderContent = (text: string) => {
        return text.split('\n').map((line, i, arr) => {
            const isBold = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            return (
                <span key={i}>
                    <span dangerouslySetInnerHTML={{ __html: isBold(line) }} />
                    {i < arr.length - 1 && <br />}
                </span>
            );
        });
    };

    const quickPrompts = [
        'Pipeline summary',
        'Top candidates',
        'Who needs follow-up?',
        'Qualified candidates',
        'Interview schedule',
    ];

    return (
        <Card className="h-[680px] flex flex-col border-slate-200 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-slate-100 rounded-bl-full -z-10 opacity-60" />

            <CardHeader className="border-b bg-white pb-5 pt-6 px-7 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xl font-semibold text-slate-900">
                        <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-sm ring-4 ring-indigo-50"><Sparkles className="h-4 w-4" /></div>
                        Sparky — Your HR Sidekick
                        
                    </div>
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse inline-block" />
                        Live • {candidates.length} candidates
                    </Badge>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 p-6 bg-[radial-gradient(#e0e7ff_1px,transparent_1px)] [background-size:20px_20px]" ref={scrollRef as any}>
                    <div className="flex flex-col gap-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 ${msg.role === 'user' ? 'self-end flex-row-reverse max-w-[80%]' : 'self-start max-w-[92%]'}`}
                            >
                                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm
                                    ${msg.role === 'user' ? 'bg-slate-800' : 'bg-gradient-to-br from-indigo-100 to-purple-100'}`}>
                                    {msg.role === 'user'
                                        ? <User className="h-4 w-4 text-white" />
                                        : <Bot className="h-4 w-4 text-slate-900" />}
                                </div>
                                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-[0_2px_10px_rgba(0,0,0,0.03)]
                                    ${msg.role === 'user'
                                        ? 'bg-slate-800 text-white rounded-tr-none shadow-md'
                                        : 'bg-white/80 backdrop-blur-md border border-white rounded-2xl rounded-tl-none text-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'}`}>
                                    {renderContent(msg.content)}
                                    <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex gap-3 self-start">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-slate-900" />
                                </div>
                                <div className="p-4 bg-white border border-slate-100/50 rounded-2xl rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    <span className="text-xs text-slate-400 ml-1">Let me check that for you...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Quick prompts */}
                <div className="px-4 py-2 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-none">
                    {quickPrompts.map(prompt => (
                        <button
                            key={prompt}
                            onClick={() => { setInput(prompt); }}
                            className="text-xs px-4 py-2 rounded-xl bg-white text-slate-600 border border-slate-200 hover:border-slate-800 hover:text-slate-900 hover:bg-slate-100/30 whitespace-nowrap transition-all duration-200 flex-shrink-0"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 border-t">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2 relative"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about candidates, pipeline, interviews..."
                            className="pr-14 h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-teal-500/20 focus-visible:border-slate-800 transition-all shadow-sm"
                            disabled={isTyping}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="absolute right-1.5 top-1.5 bottom-1.5 h-auto w-10 bg-slate-800 hover:bg-slate-800 rounded-lg shadow-sm transition-transform active:scale-95"
                            disabled={!input.trim() || isTyping}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                    <p className="text-[10px] text-slate-400 mt-1 text-center">
                        ✦ Powered by live pipeline data • No external API
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

export default HRAssistant;
