import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';

const CandidateBGVUpload = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isFresher, setIsFresher] = useState(false);

  const [formData, setFormData] = useState({
    education_details: '',
    last_employer_details: '',
    hr_email: '',
    manager_email: '',
    university_email: '',
    reference_email: ''
  });

  const [files, setFiles] = useState({
    degree: null as File | null,
    experience: null as File | null
  });

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        if (!token) throw new Error("Invalid token");

        // Service role or anon needs access. For this assignment we assume we can query by token
        // Use an RPC or edge function if RLS blocks this. For now let's try direct query
        const { data, error } = await supabase
          .from('candidates')
          .select('id, name, bgv_status, token_expiry')
          .eq('upload_token', token)
          .maybeSingle();

        if (error) {
          console.warn("Possible RLS error on candidates table for anon token query. Using edge function validation is recommended in production.", error);
        }

        if (!data) {
          setError("Invalid or expired link. Please contact HR.");
          return;
        }

        if (new Date(data.token_expiry) < new Date()) {
          setError("This link has expired. Please request a new one from HR.");
          return;
        }

        if (data.bgv_status === 'Submitted' || data.bgv_status === 'Verified') {
          setError("Your documents have already been submitted.");
          return;
        }

        setCandidate(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load candidate information');
      } finally {
        setLoading(false);
      }
    };

    fetchCandidate();
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'degree' | 'experience') => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const uploadFile = async (file: File, type: string) => {
    if (!candidate) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${candidate.id}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('bgv-documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error(`Error uploading ${type}:`, uploadError);
      throw new Error(`Failed to upload ${type} document`);
    }

    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;

    if (!files.degree && !files.experience) {
      toast({
        title: "Missing Files",
        description: "Please upload at least one document to proceed.",
        variant: "destructive"
      });
      return;
    }

    if (!isFresher && (!formData.university_email || !formData.manager_email)) {
      toast({
        title: "Missing Information",
        description: "Please provide valid emails for reference checks.",
        variant: "destructive"
      });
      return;
    }

    if (isFresher && !formData.university_email) {
      toast({
        title: "Missing Information",
        description: "Please provide a valid university email for reference checks.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload files
      if (files.degree) await uploadFile(files.degree, 'degree');
      if (files.experience) await uploadFile(files.experience, 'experience');

      // 2. Update Candidate Record
      const { error: updateError } = await supabase
        .from('candidates')
        .update({
          education_details: formData.education_details,
          last_employer_details: formData.last_employer_details,
          bgv_status: 'Submitted'
        })
        .eq('id', candidate.id);

      if (updateError) throw updateError;

      // 3. Insert Verification Contacts
      const { error: contactsError } = await supabase
        .from('bgv_verification_contacts')
        .insert({
          candidate_id: candidate.id,
          hr_email: formData.hr_email,
          manager_email: formData.manager_email,
          university_email: formData.university_email,
          reference_email: formData.reference_email,
          mail_status: 'Not Sent'
        });

      if (contactsError) throw contactsError;

      // 4. Automatically trigger verification process
      try {
        const { error: verifyError } = await supabase.functions.invoke('send-bgv-verification', {
          body: { candidate_id: candidate.id }
        });
        if (verifyError) {
          console.error("Failed to automatically send verification emails:", verifyError);
        }
      } catch (invokeErr) {
        console.error("Error invoking verification function:", invokeErr);
      }

      setSuccess(true);
      toast({
        title: "Success",
        description: "Your documents have been submitted securely, and verification emails have been notified."
      });

    } catch (err: any) {
      console.error(err);
      toast({
        title: "Submission Failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-700">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-gray-600">
            {error}
          </CardContent>
          <CardFooter className="flex justify-center pt-4">
            <Button onClick={() => window.location.href = 'mailto:hr@hirespark.com'} variant="outline">
              Contact HR Support
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-green-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">Submission Successful</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-gray-600">
            <p>Thank you, {candidate?.name}.</p>
            <p className="mt-2 text-sm">Your background verification documents and details have been securely uploaded to the HireSpark HR team.</p>
          </CardContent>
          <CardFooter className="flex justify-center pt-4">
            <Button onClick={() => window.close()} className="w-full">
              Close Window
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <img src="/hirespark-logo.png" alt="HireSpark Logo" className="h-16 w-auto object-contain mx-auto mb-4 drop-shadow-sm" />
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Background Verification</h2>
          <p className="mt-2 text-lg text-gray-600">
            Welcome {candidate?.name}. Please provide your details securely below.
          </p>
        </div>

        <Card className="shadow-lg border-0 ring-1 ring-gray-200">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-8 pt-8 px-8">

              {/* Educational Details */}
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" /> Educational Background
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Highest Degree Details <span className="text-red-500">*</span></label>
                    <Textarea
                      name="education_details"
                      value={formData.education_details}
                      onChange={handleInputChange}
                      placeholder="e.g. Bachelor of Science in Computer Science, State University, 2018-2022"
                      required
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">University Registrar/Records Email <span className="text-red-500">*</span></label>
                      <Input
                        type="email"
                        name="university_email"
                        value={formData.university_email}
                        onChange={handleInputChange}
                        placeholder="registrar@university.edu"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Degree Certificate Upload</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          id="degree_file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, 'degree')}
                          className="file:bg-primary/10 file:text-primary file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-md cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="space-y-4 pt-4">
                <div className="border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" /> Previous Employment
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-2 bg-slate-100 p-3 rounded-md border border-slate-200">
                    <input
                      type="checkbox"
                      id="isFresher"
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={isFresher}
                      onChange={(e) => setIsFresher(e.target.checked)}
                    />
                    <label htmlFor="isFresher" className="text-sm font-medium text-gray-700 cursor-pointer">
                      I am a fresher / This is my first job
                    </label>
                  </div>

                  {!isFresher && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Last Employer Details <span className="text-red-500">*</span></label>
                        <Textarea
                          name="last_employer_details"
                          value={formData.last_employer_details}
                          onChange={handleInputChange}
                          placeholder="e.g. Software Engineer at Tech Corp Inc., June 2022 - Present. Responsibilities included..."
                          required={!isFresher}
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Previous Manager/HR Email <span className="text-red-500">*</span></label>
                          <Input
                            type="email"
                            name="manager_email"
                            value={formData.manager_email}
                            onChange={handleInputChange}
                            placeholder="manager@company.com"
                            required={!isFresher}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Experience Certificate/Relieving Letter</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              id="experience_file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => handleFileChange(e, 'experience')}
                              className="file:bg-primary/10 file:text-primary file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-md cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Additional References */}
              <div className="space-y-4 pt-4">
                <div className="border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-primary" /> Additional Contacts
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">HR Department Email (Optional)</label>
                    <Input
                      type="email"
                      name="hr_email"
                      value={formData.hr_email}
                      onChange={handleInputChange}
                      placeholder="hr@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Professional Reference Email (Optional)</label>
                    <Input
                      type="email"
                      name="reference_email"
                      value={formData.reference_email}
                      onChange={handleInputChange}
                      placeholder="colleague@domain.com"
                    />
                  </div>
                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-gray-50 px-8 py-4 border-t flex justify-end">
              <Button type="submit" size="lg" disabled={submitting} className="w-full md:w-auto px-8">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Secure Submit
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CandidateBGVUpload;
