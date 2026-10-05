import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const ReferenceVerification = () => {
    const { token } = useParams<{ token: string }>();
    const [searchParams] = useSearchParams();
    const roleStr = searchParams.get('role') || 'Contact';

    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [candidate, setCandidate] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                if (!token) throw new Error("Invalid verification token");

                const { data, error } = await supabase.functions.invoke('bgv-portal', { body: { action: 'reference_start', token, role: roleStr } });
                if (error || !data?.candidate) {
                    setError("Verification link is invalid or has expired.");
                    return;
                }

                setCandidate(data.candidate);
            } catch (err: any) {
                setError(err.message || 'Failed to load verification details');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [token, roleStr]);

    const handleVerify = async (status: 'Verified' | 'Flagged') => {
        setSubmitting(true);
        try {
            const { data, error } = await supabase.functions.invoke('bgv-portal', { body: { action: 'reference_submit', token, role: roleStr, status } });
            if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed to submit verification');

            setSuccess(true);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "Failed to submit verification",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-900 border-t-transparent"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-slate-200">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <ShieldCheck className="w-6 h-6 text-slate-500" />
                        </div>
                        <CardTitle className="text-xl">Verification Portal</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-slate-600">
                        {error}
                    </CardContent>
                    <CardFooter className="flex justify-center pt-4">
                        <Button onClick={() => window.close()} variant="outline">Close Window</Button>
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
                        <CardTitle className="text-2xl text-green-700">Response Recorded</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-slate-600">
                        <p>Thank you for your time.</p>
                        <p className="mt-2 text-sm">Your verification response for {candidate?.name} has been securely submitted to the HireSpark HR team.</p>
                    </CardContent>
                    <CardFooter className="flex justify-center pt-4">
                        <Button onClick={() => window.close()} className="w-full">Close Window</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center">
                    <img src="/hirespark-logo.png" alt="HireSpark Logo" className="h-16 w-auto object-contain mx-auto mb-4 drop-shadow-sm" />
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Background Verification</h2>
                    <p className="mt-2 text-lg text-slate-600">
                        Reference Verification for <strong>{candidate?.name}</strong>
                    </p>
                </div>

                <Card className="shadow-lg border-0 ring-1 ring-slate-200">
                    <CardHeader className="bg-slate-100 border-b border-slate-200 py-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-200 rounded-lg">
                                <ShieldCheck className="w-6 h-6 text-slate-800" />
                            </div>
                            <div>
                                <CardTitle className="text-slate-900">Review Candidate Details</CardTitle>
                                <CardDescription className="text-slate-800/80">
                                    Please confirm if the information provided by the candidate is accurate.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Position Applied</h3>
                            <p className="text-slate-900 font-medium">{candidate?.applied_role || 'Not Specified'}</p>
                        </div>

                        {roleStr === 'University Records' || roleStr === 'Contact' ? (
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Education Details Provided</h3>
                                <p className="text-slate-900 whitespace-pre-wrap">{candidate?.education_details || 'No details provided.'}</p>
                            </div>
                        ) : null}

                        {roleStr === 'Manager' || roleStr === 'Human Resources' || roleStr === 'Contact' ? (
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Employment Details Provided</h3>
                                <p className="text-slate-900 whitespace-pre-wrap">{candidate?.last_employer_details || 'No details provided.'}</p>
                            </div>
                        ) : null}
                    </CardContent>
                    <CardFooter className="bg-slate-50 px-6 py-6 border-t flex flex-col sm:flex-row gap-4 justify-between items-center rounded-b-lg">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                            onClick={() => handleVerify('Flagged')}
                            disabled={submitting}
                        >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Information is Incorrect
                        </Button>
                        <Button
                            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800"
                            onClick={() => handleVerify('Verified')}
                            disabled={submitting}
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approve & Verify
                        </Button>
                    </CardFooter>
                </Card>

                <p className="text-center text-sm text-slate-400">
                    This is a secure link generated by HireSpark ATS. Your response is confidential.
                </p>
            </div>
        </div>
    );
};

export default ReferenceVerification;
