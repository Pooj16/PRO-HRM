import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, CheckCircle } from 'lucide-react';

export const CareersForm = ({ siteSlug = 'careers' }: { siteSlug?: string }) => {
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
  });
  const [resume, setResume] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.functions.invoke('career-application', { body: { action: 'list_jobs', siteSlug } })
      .then(({ data, error }) => {
        if (error) console.error('Could not load open positions:', error);
        else setJobs(data?.jobs ?? []);
      });
  }, [siteSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (!formData.name.trim() || !formData.email.trim() || !formData.position) {
        throw new Error('Please fill in all required fields');
      }

      if (!resume) {
        throw new Error('Please upload your resume (PDF, DOC, or DOCX)');
      }

      let resume_url: string | null = null;

      // Upload resume if provided
      if (resume) {
        try {
          // Check file size (max 10MB)
          if (resume.size > 10 * 1024 * 1024) {
            throw new Error('Resume file must be less than 10MB');
          }

          const { data: uploadRequest, error: uploadRequestError } = await supabase.functions.invoke('career-application', {
            body: { action: 'create_upload', siteSlug, fileName: resume.name, contentType: resume.type, fileSize: resume.size }
          });
          if (uploadRequestError || !uploadRequest?.path || !uploadRequest?.token) {
            throw new Error(uploadRequest?.error || uploadRequestError?.message || 'Could not prepare secure resume upload');
          }
          const filePath = uploadRequest.path;

          // 🔍 COMPREHENSIVE LOGGING FOR DEBUGGING
          console.log('═════════════════════════════════════════');
          console.log('📤 RESUME UPLOAD STARTING');
          console.log('═════════════════════════════════════════');
          console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
          console.log('Bucket name:', 'resumes');
          console.log('File name:', resume.name);
          console.log('File size:', resume.size, 'bytes');
          console.log('File path:', filePath);
          console.log('Content-Type:', resume.type);
          console.log('Supabase client:', supabase ? '✓ initialized' : '✗ not initialized');
          console.log('═════════════════════════════════════════');

          const { data, error: uploadError } = await supabase.storage
            .from('resumes')
            .uploadToSignedUrl(filePath, uploadRequest.token, resume, { contentType: resume.type });

          console.log('📨 UPLOAD RESPONSE:');
          console.log('Data:', data);
          console.log('Error:', uploadError);

          if (uploadError) {
            console.error('❌ UPLOAD FAILED');
            console.error('Error message:', uploadError.message);
            console.error('Full error:', JSON.stringify(uploadError, null, 2));
            throw new Error(`Resume upload failed: ${uploadError.message}`);
          } else {
            // Store ONLY the file path, not the full URL
            // The URL will be generated dynamically on the frontend from the path
            resume_url = filePath;
            console.log('✅ UPLOAD SUCCESSFUL');
            console.log('File path stored:', resume_url);
            console.log('═════════════════════════════════════════');
          }
        } catch (uploadErr: any) {
          console.error('❌ RESUME UPLOAD EXCEPTION');
          console.error('Error message:', uploadErr.message);
          console.error('Error stack:', uploadErr.stack);
          console.error('Full error:', JSON.stringify(uploadErr, null, 2));
          throw uploadErr;
        }
      }

      const { data: application, error: submitError } = await supabase.functions.invoke('career-application', {
        body: { action: 'submit', siteSlug, ...formData, jobId: formData.position, position: jobs.find((job) => job.id === formData.position)?.title || formData.position, resumePath: resume_url }
      });
      if (submitError || !application?.candidateId) throw new Error(application?.error || submitError?.message || 'Could not submit application');

      console.log('✅ Candidate inserted successfully');

      // Auto-trigger text extraction in the background if a resume was uploaded
      if (resume_url) {
        console.log('📄 Triggering text extraction loop...');

        supabase.functions.invoke('extract-resume-text', {
          body: { resumeUrl: resume_url, candidateId: application.candidateId, processingToken: application.processingToken }
        }).then(({ error }) => {
            if (error) console.error('Background extraction error:', error);
            else console.log('Background extraction completed for', application.candidateId);
          });
      }

      // Success!
      setSubmitted(true);
      toast({
        title: "✅ Application Submitted!",
        description: "Thank you! We'll review your application and get back to you soon.",
      });

      // Auto-reset after 3 seconds
      setTimeout(() => {
        setFormData({ name: '', email: '', phone: '', position: '' });
        setResume(null);
        setSubmitted(false);
        const fileInput = document.getElementById('resume') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }, 3000);

    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: "❌ Submission Failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
        <p className="text-gray-600 mb-4">
          Your application has been submitted successfully. We'll review it and contact you soon.
        </p>
        <p className="text-sm text-gray-500">
          Redirecting to careers page...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
          Full Name *
        </label>
        <input
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Doe"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
          Email *
        </label>
        <input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 mb-2">
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+1 (555) 123-4567"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {/* Role */}
      <div>
        <label htmlFor="role" className="block text-sm font-semibold text-gray-900 mb-2">
          Position You're Applying For *
        </label>
        <select
          id="role"
          required
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="">-- Select an Open Position --</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
      </div>

      {/* Resume */}
      <div>
        <label htmlFor="resume" className="block text-sm font-semibold text-gray-900 mb-2">
          Resume (PDF, DOC, DOCX) *
        </label>
        <div className="relative">
          <input
            id="resume"
            type="file"
            required
            accept=".pdf,.doc,.docx"
            onChange={(e) => setResume(e.target.files?.[0] || null)}
            className="hidden"
          />
          <label
            htmlFor="resume"
            className="flex items-center justify-center w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-cyan-50 transition"
          >
            <div>
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                {resume ? (
                  <span className="text-green-600">✓ {resume.name}</span>
                ) : (
                  <>
                    Click to upload or drag & drop
                    <br />
                    <span className="text-xs text-gray-500">Max file size: 10MB</span>
                  </>
                )}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full py-3 text-lg font-semibold"
      >
        {loading ? 'Submitting...' : 'Submit Application'}
      </Button>

      {/* Footer text */}
      <p className="text-xs text-gray-500 text-center">
        By submitting this form, you agree to be contacted about your application.
        We'll never spam you or share your information.
      </p>
    </form>
  );
};
