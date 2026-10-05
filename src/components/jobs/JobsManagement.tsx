import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Job = { id: string; title: string; department: string | null; location: string | null; employment_type: string | null; description: string | null; openings: number; status: 'draft' | 'published' | 'closed' };
const emptyJob = { title: '', department: '', location: '', employment_type: 'Full-time', description: '', openings: 1, status: 'draft' as Job['status'] };

export default function JobsManagement() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState(emptyJob);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadJobs = useCallback(async () => {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Could not load jobs', description: error.message, variant: 'destructive' });
    else setJobs((data ?? []) as Job[]);
  }, [toast]);
  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const saveJob = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const slug = form.title.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const payload = { ...form, slug, department: form.department || null, location: form.location || null, description: form.description || null };
    const { error } = editingJobId
      ? await supabase.from('jobs').update(payload).eq('id', editingJobId)
      : await supabase.from('jobs').insert(payload);
    setSaving(false);
    if (error) toast({ title: 'Could not save job', description: error.message, variant: 'destructive' });
    else {
      setForm(emptyJob);
      setEditingJobId(null);
      await loadJobs();
      toast({ title: editingJobId ? 'Job updated' : 'Job created' });
    }
  };

  const editJob = (job: Job) => {
    setEditingJobId(job.id);
    setForm({
      title: job.title,
      department: job.department ?? '',
      location: job.location ?? '',
      employment_type: job.employment_type ?? '',
      description: job.description ?? '',
      openings: job.openings,
      status: job.status,
    });
  };

  const updateStatus = async (job: Job, status: Job['status']) => {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', job.id);
    if (error) toast({ title: 'Could not update job', description: error.message, variant: 'destructive' });
    else await loadJobs();
  };

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Jobs</h2><p className="text-muted-foreground">Create and publish openings on your Careers page.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2">{editingJobId ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}{editingJobId ? 'Edit job' : 'Add a job'}</CardTitle></CardHeader>
      <CardContent><form onSubmit={saveJob} className="grid gap-4 md:grid-cols-2">
        <Input required minLength={2} maxLength={160} placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Input placeholder="Employment type" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} />
        <Input type="number" min={1} required aria-label="Number of openings" value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Job['status'] })}>
          <option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option>
        </select>
        <Textarea className="md:col-span-2" placeholder="Job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="md:col-span-2 flex gap-2">
          <Button disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : editingJobId ? 'Save changes' : 'Create job'}</Button>
          {editingJobId && <Button type="button" variant="outline" onClick={() => { setEditingJobId(null); setForm(emptyJob); }}>Cancel</Button>}
        </div>
      </form></CardContent>
    </Card>
    <div className="grid gap-3">{jobs.map((job) => <Card key={job.id}><CardContent className="flex flex-wrap items-center gap-4 p-4">
      <Briefcase className="h-5 w-5 text-muted-foreground" /><div className="min-w-48 flex-1"><div className="font-semibold">{job.title}</div><div className="text-sm text-muted-foreground">{[job.department, job.location, job.employment_type].filter(Boolean).join(' · ') || 'Details not set'} · {job.openings} opening(s)</div></div>
      <span className="text-sm capitalize text-muted-foreground">{job.status}</span>
      <Button variant="outline" size="sm" onClick={() => editJob(job)}>Edit</Button>
      <select aria-label={`Change status for ${job.title}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={job.status} onChange={(e) => void updateStatus(job, e.target.value as Job['status'])}>
        <option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option>
      </select>
    </CardContent></Card>)}</div>
  </div>;
}
