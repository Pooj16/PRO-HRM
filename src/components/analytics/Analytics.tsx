import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { Candidate, Assessment, Interview } from '@/hooks/useRealtimeData';
import { CheckCircle2, Clock, Users, Target, Activity } from 'lucide-react';

interface AnalyticsProps {
  candidates: Candidate[];
  assessments: Assessment[];
  interviews: Interview[];
}

const Analytics = ({ candidates, assessments, interviews }: AnalyticsProps) => {
  const pipelineData = [
    { stage: 'Total Applied', count: candidates.length, color: '#3b82f6' },
    { stage: 'Assessment Stage', count: candidates.filter(c => ['assessment_pending', 'assessment_completed', 'assessment_qualified', 'interview_scheduled', 'hired'].includes(c.status || '')).length, color: '#8b5cf6' },
    { stage: 'Qualified', count: candidates.filter(c => ['assessment_qualified', 'interview_scheduled', 'hired'].includes(c.status || '')).length, color: '#10b981' },
    { stage: 'Interviewed', count: candidates.filter(c => ['interviewed', 'hired'].includes(c.status || '')).length, color: '#f59e0b' },
    { stage: 'Hired', count: candidates.filter(c => c.status === 'hired').length, color: '#ec4899' },
  ];

  const timelineData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const displayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      date: displayStr,
      Applications: candidates.filter(c => c.created_at?.startsWith(dateStr)).length,
      Interviews: interviews.filter(iv => iv.created_at?.startsWith(dateStr)).length
    };
  });

  const averageAIScore = candidates.length > 0
    ? candidates.reduce((sum, c) => sum + (c.ats_score || 0), 0) / candidates.length
    : 0;

  const getRecentActivity = () => {
    const activities = [];

    const latestInterview = [...interviews].sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )[0];

    if (latestInterview) {
      const c = candidates.find(can => can.id === latestInterview.candidate_id);
      if (c) {
        activities.push({
          type: 'interview',
          title: 'Interview scheduled',
          desc: `${c.name} has an interview lined up`,
          time: new Date(latestInterview.created_at || Date.now()).toLocaleDateString(),
          icon: Clock,
          color: 'text-stone-600',
          bg: 'bg-violet-100'
        });
      }
    }

    const latestQualified = candidates.filter(c => c.status === 'assessment_qualified')
      .sort((a, b) => (b.ats_score || 0) - (a.ats_score || 0))[0];

    if (latestQualified) {
      activities.push({
        type: 'qualified',
        title: 'Top qualifier',
        desc: `${latestQualified.name} scored ${latestQualified.ats_score}%`,
        time: 'Recent',
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-100'
      });
    }

    const latestNew = candidates.filter(c => ['new', 'shortlisted'].includes(c.status || '')).slice(-1)[0];
    if (latestNew) {
      activities.push({
        type: 'new',
        title: 'New applicant',
        desc: `${latestNew.name} applied for ${latestNew.applied_role || 'a position'}`,
        time: 'Recent',
        icon: Users,
        color: 'text-cyan-600',
        bg: 'bg-blue-100'
      });
    }

    return activities;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="group border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</p>
                <div className="text-3xl font-bold text-slate-900 mt-1">{candidates.length}</div>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl group-hover:scale-110 transition-transform duration-200">
                <Users className="h-5 w-5 text-teal-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group border-emerald-100 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Match</p>
                <div className="text-3xl font-bold text-emerald-950 mt-1">
                  {averageAIScore.toFixed(1)}<span className="text-base text-emerald-600/50">%</span>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl group-hover:scale-110 transition-transform duration-200">
                <Activity className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <Progress value={averageAIScore} className="h-1.5 mt-3 [&>div]:bg-emerald-500 bg-emerald-100" />
          </CardContent>
        </Card>

        <Card className="group border-violet-100 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Interviews</p>
                <div className="text-3xl font-bold text-violet-950 mt-1">{interviews.length}</div>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl group-hover:scale-110 transition-transform duration-200">
                <Clock className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group border-blue-100 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Hired</p>
                <div className="text-3xl font-bold text-blue-950 mt-1">{candidates.filter(c => c.status === 'hired').length}</div>
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl group-hover:scale-110 transition-transform duration-200">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel */}
        <Card className="lg:col-span-2 shadow-sm border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">Hiring funnel</CardTitle>
            <CardDescription className="text-xs">How candidates move through your pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.75} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0 / 0.08)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="shadow-sm border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">Activity this week</CardTitle>
            <CardDescription className="text-xs">Applications vs interviews, past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorIv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0 / 0.08)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="Applications" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorApp)" />
                  <Area type="monotone" dataKey="Interviews" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorIv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">What's been happening</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {getRecentActivity().length > 0 ? getRecentActivity().map((activity, i) => {
            const Icon = activity.icon;
            return (
              <Card key={i} className="border-slate-100 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
                <CardContent className="p-4 flex gap-3 items-start">
                  <div className={`p-2 rounded-xl mt-0.5 ${activity.bg} ${activity.color} flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-800">{activity.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{activity.desc}</p>
                    <span className="text-[10px] font-medium text-slate-400 mt-1.5 block">{activity.time}</span>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <div className="col-span-full text-center p-10 border border-dashed rounded-2xl text-slate-400 text-sm">
              All quiet — activity shows up here as candidates move through the pipeline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
