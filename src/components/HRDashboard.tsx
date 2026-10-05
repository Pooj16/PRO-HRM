import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import {
  Users,
  FileText,
  Upload,
  UserCheck,
  RefreshCw,
  ShieldCheck,
  X,
  LayoutDashboard,
  FolderKanban,
  Filter,
  ClipboardList,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import CandidatesList from './candidates/CandidatesList';
import HRAssistant from './assistant/HRAssistant';
import AssessmentsList from './assessments/AssessmentsList';
import InterviewSchedule from './interviews/InterviewSchedule';
import Analytics from './analytics/Analytics';
import EnhancedATSFiltering from './filtering/EnhancedATSFiltering';
import HRSettings from './settings/HRSettings';
import { RoleGroupedCandidates } from './candidates/RoleGroupedCandidates';
import { cn } from '@/lib/utils';
import JobsManagement from './jobs/JobsManagement';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'role-groups', label: 'Role Groups', icon: FolderKanban },
  { id: 'ats-filtering', label: 'Enhanced ATS', icon: Filter },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'assessments', label: 'Assessments', icon: ClipboardList },
  { id: 'interviews', label: 'Interviews', icon: Calendar },
  { id: 'background-verification', label: 'Background', icon: ShieldCheck },
  { id: 'hr-assistant', label: 'AI Assistant', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const HRDashboard = () => {
  const {
    candidates,
    assessments,
    interviews,
    verificationContacts,
    loading,
    forceRefresh
  } = useRealtimeData();

  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await forceRefresh();
      toast({
        title: "All synced ✓",
        description: "Dashboard is up to date.",
      });
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      toast({
        title: "Sync failed",
        description: "Couldn't refresh — give it another try.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Getting things ready…</p>
        </div>
      </div>
    );
  }

  const totalCandidates = candidates.length;
  const uploadedCandidates = candidates.filter(c => c.status === 'uploaded').length;
  const textExtracted = candidates.filter(c => c.status === 'text_extracted').length;
  const shortlisted = candidates.filter(c => c.status === 'shortlisted' || c.status === 'assessment_pending').length;
  const backgroundVerification = candidates.filter(c =>
    ['background_verification', 'interview_scheduled', 'interviewed', 'bgv_initiated'].includes(c.status || '') ||
    (c.bgv_status && c.bgv_status !== 'Not Started')
  ).length;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Analytics candidates={candidates} assessments={assessments} interviews={interviews} />;
      case 'role-groups':
        return <RoleGroupedCandidates candidates={candidates} onRefresh={forceRefresh} />;
      case 'ats-filtering':
        return <EnhancedATSFiltering />;
      case 'candidates':
        return <CandidatesList />;
      case 'jobs':
        return <JobsManagement />;
      case 'assessments':
        return <AssessmentsList />;
      case 'interviews':
        return <InterviewSchedule />;
      case 'background-verification': {
        const bgvInProgress = candidates.filter(c => ['Link Sent', 'Submitted', 'Verification Sent'].includes(c.bgv_status || '')).length;
        const bgvVerified = candidates.filter(c => c.bgv_status === 'Verified').length;

        const bgvCandidates = candidates.filter(c =>
          ['background_verification', 'interview_scheduled', 'interviewed', 'hired', 'bgv_initiated'].includes(c.status || '') ||
          (c.bgv_status && c.bgv_status !== 'Not Started')
        );

        const handleSendLink = async (candidateId: string) => {
          try {
            toast({ title: 'Getting that ready...', description: 'Generating a secure link for them now.' });
            const { data, error } = await supabase.functions.invoke('send-bgv-link', {
              body: { candidate_id: candidateId }
            });
            if (error) throw error;
            toast({ title: 'All set!', description: 'The link has been sent to their inbox.' });
            forceRefresh();
          } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
          }
        };

        const handleSendVerification = async (candidateId: string) => {
          try {
            toast({ title: 'Sending…', description: 'Dispatching verification emails now.' });
            const { data, error } = await supabase.functions.invoke('send-bgv-verification', {
              body: { candidate_id: candidateId }
            });
            if (error) throw error;
            toast({ title: 'Emails sent ✓', description: 'Verification emails dispatched.' });
            forceRefresh();
          } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
          }
        };

        return (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-slate-100 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-slate-900" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Safety First: BGV Center</h2>
                <p className="text-sm text-muted-foreground">Keep an eye on verification progress so you can hire with total confidence.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 bg-slate-900 text-white hover-lift shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">{bgvInProgress}</div>
                      <p className="text-indigo-100 text-sm mt-0.5">In Progress</p>
                    </div>
                    <ShieldCheck className="h-8 w-8 opacity-70" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-teal-600 text-white hover-lift shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">{bgvVerified}</div>
                      <p className="text-emerald-100 text-sm mt-0.5">Verified</p>
                    </div>
                    <UserCheck className="h-8 w-8 opacity-70" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-rose-500 text-white hover-lift shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">0</div>
                      <p className="text-rose-100 text-sm mt-0.5">Failed</p>
                    </div>
                    <X className="h-8 w-8 opacity-70" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-semibold text-slate-800">Who is in the queue?</h3>
                  </div>
                  {bgvCandidates.length === 0 ? (
                    <div className="text-center py-12">
                      <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">
                        Nothing here yet — candidates appear once they've been interviewed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bgvCandidates.map(c => {
                        const status = c.bgv_status || 'Not Started';
                        return (
                          <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 border border-border/60 rounded-xl hover:bg-slate-50/50 transition-colors duration-150">
                            <div>
                              <div className="font-semibold text-foreground">{c.name}</div>
                              <div className="text-sm text-muted-foreground">{c.applied_role} · {c.email}</div>
                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={
                                  status === 'Not Started' ? 'border-gray-200 text-gray-500 text-xs' :
                                    status === 'Link Sent' ? 'border-cyan-200 text-cyan-600 bg-cyan-50 text-xs' :
                                      status === 'Submitted' ? 'border-orange-200 text-orange-600 bg-orange-50 text-xs' :
                                        status === 'Verification Sent' ? 'border-stone-200 text-stone-600 bg-stone-50 text-xs' :
                                          'border-emerald-200 text-emerald-600 bg-emerald-50 text-xs'
                                }>
                                  BGV: {status}
                                </Badge>

                                {status === 'Verification Sent' && (() => {
                                  const contact = verificationContacts.find(vc => vc.candidate_id === c.id);
                                  if (!contact) return null;

                                  const renderStatusBadge = (label: string, s: string) => {
                                    if (!s) return null;
                                    let color = 'text-slate-500 bg-slate-100 border-slate-200';
                                    if (s === 'Verified') color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                                    if (s === 'Flagged') color = 'text-red-700 bg-red-50 border-red-200';
                                    return (
                                      <Badge variant="outline" className={`text-[10px] ${color}`}>
                                        {label}: {s}
                                      </Badge>
                                    );
                                  };

                                  return (
                                    <div className="flex gap-1 ml-1">
                                      {contact.manager_email && renderStatusBadge('Manager', contact.manager_status)}
                                      {contact.university_email && renderStatusBadge('Uni', contact.university_status)}
                                      {contact.hr_email && renderStatusBadge('HR', contact.hr_status)}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {(status === 'Not Started' || status === 'Link Sent') && (
                                <Button size="sm" onClick={() => handleSendLink(c.id)} className="text-xs">
                                  {status === 'Link Sent' ? 'Resend Link' : 'Send Upload Link'}
                                </Button>
                              )}
                              {status === 'Submitted' && (
                                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs" onClick={() => handleSendVerification(c.id)}>
                                  Send Verification
                                </Button>
                              )}
                              {(status === 'Verification Sent' || status === 'Verified') && (
                                <Button size="sm" variant="outline" disabled className="text-xs">
                                  {status === 'Verified' ? 'Complete ✓' : 'Awaiting replies'}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }
      case 'hr-assistant':
        return <HRAssistant />;
      case 'settings':
        return <HRSettings />;
      default:
        return null;
    }
  };

  const statItems = [
    { icon: Users, color: 'text-slate-600', bg: 'bg-transparent', value: totalCandidates, label: 'All Candidates' },
    { icon: Upload, color: 'text-slate-600', bg: 'bg-transparent', value: uploadedCandidates, label: 'In Review' },
    { icon: FileText, color: 'text-slate-600', bg: 'bg-transparent', value: textExtracted, label: 'Resume Ready' },
    { icon: UserCheck, color: 'text-slate-600', bg: 'bg-transparent', value: shortlisted, label: 'Shortlisted' },
    { icon: ShieldCheck, color: 'text-slate-600', bg: 'bg-transparent', value: backgroundVerification, label: 'BGV' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-white shadow-sm transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-1.5">
              <img src="/hirespark-logo.png" alt="HireSpark Logo" className="h-11 w-auto object-contain drop-shadow-sm -ml-1" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">HireSpark</h1>
            </div>
          )}
          {sidebarCollapsed && (
            <img src="/hirespark-logo.png" alt="HireSpark Logo" className="h-9 w-9 object-contain drop-shadow-sm mx-auto" />
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-slate-100"
          >
            {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 relative outline-none",
                  isActive
                    ? "text-slate-900 font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", isActive ? "text-slate-900" : "text-slate-400")} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white/90 backdrop-blur-sm px-6">
          <h2 className="text-sm font-semibold text-foreground tracking-tight capitalize">
            {navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
          </h2>
          <Button
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg text-xs h-8"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            Sync
          </Button>
        </header>

        {/* Stats Bar */}
        <div className="border-b border-border bg-white px-6 py-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {statItems.map(({ icon: Icon, color, bg, value, label }) => (
              <div
                key={label}
                className="group flex flex-col items-start gap-1 p-2 transition-all duration-150 cursor-default"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <p className="text-[12px] font-medium text-slate-500">{label}</p>
                </div>
                <p className="text-2xl font-semibold text-slate-900 tracking-tight">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {totalCandidates === 0 && activeTab === 'candidates' ? (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
              <CardContent className="pt-14 pb-14 text-center">
                <div className="relative inline-flex">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Looks like it's still quiet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Head to the Careers page to get things rolling — applicants land here automatically.
                </p>
                <Button onClick={() => window.location.href = '/careers'} className="gap-2 text-sm">
                  <Upload className="h-4 w-4" />
                  Open Careers Page →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="animate-fade-in-up">
              {renderContent()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HRDashboard;
