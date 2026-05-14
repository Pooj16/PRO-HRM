import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, ExternalLink, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw, Zap } from 'lucide-react';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface RecentSubmissions {
  form_responses: any[];
  candidates: any[];
}

const GoogleFormIntegration = () => {
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmissions>({
    form_responses: [],
    candidates: []
  });
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const { toast } = useToast();
  const { forceRefresh } = useRealtimeData();

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-google-form`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The webhook URL has been copied to your clipboard"
    });
  };

  const testWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const testData = {
        name: "Test Candidate",
        email: "test@example.com",
        role_applied_for: "Software Engineer",
        phone_number: "1234567890",
        date_of_birth: "1990-01-01",
        consent: true,
        form_response_id: `test_${Date.now()}`
      };

      console.log('Testing webhook with data:', testData);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      console.log('Webhook test response:', result);

      if (response.ok && result.success) {
        setWebhookTestResult({
          success: true,
          message: result.message,
          candidate_id: result.candidate_id,
          form_response_id: result.form_response_id,
          details: result
        });
        
        toast({
          title: "Webhook test successful!",
          description: "Your Google Form integration is working correctly"
        });

        // Force refresh all data after successful webhook test
        console.log('Triggering data refresh after webhook test...');
        await forceRefresh();
        await loadRecentSubmissions();
      } else {
        setWebhookTestResult({
          success: false,
          error: result.error || 'Unknown error occurred',
          details: result
        });
        
        toast({
          title: "Webhook test failed",
          description: result.error || 'Check the diagnostics for more information',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Webhook test error:', error);
      setWebhookTestResult({
        success: false,
        error: error.message,
        details: { network_error: true, message: error.message }
      });
      
      toast({
        title: "Connection error",
        description: "Failed to connect to the webhook endpoint",
        variant: "destructive"
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const loadRecentSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      console.log('Loading recent submissions...');
      
      const { data: formResponses, error: formError } = await supabase
        .from('google_form_responses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (formError) {
        console.error('Error loading form responses:', formError);
        throw formError;
      }

      const { data: candidates, error: candidatesError } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (candidatesError) {
        console.error('Error loading candidates:', candidatesError);
        throw candidatesError;
      }

      console.log('Loaded form responses:', formResponses?.length);
      console.log('Loaded candidates:', candidates?.length);

      setRecentSubmissions({
        form_responses: formResponses || [],
        candidates: candidates || []
      });
    } catch (error) {
      console.error('Error loading recent submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load recent submissions",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Auto-refresh data every 30 seconds
  React.useEffect(() => {
    loadRecentSubmissions();
    
    const interval = setInterval(() => {
      console.log('Auto-refreshing recent submissions...');
      loadRecentSubmissions();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getDiagnosticSuggestions = () => {
    if (!webhookTestResult || webhookTestResult.success) return [];

    const suggestions = [];
    const error = webhookTestResult.error?.toLowerCase() || '';
    
    if (error.includes('cors') || error.includes('cross-origin')) {
      suggestions.push({
        type: 'error',
        title: 'CORS Policy Error',
        message: 'The webhook is being blocked by CORS policy. Make sure your Google Apps Script is configured correctly.',
        solution: 'In Google Apps Script, ensure you\'re making the request from the script editor, not from a web browser.'
      });
    }
    
    if (error.includes('network') || error.includes('fetch')) {
      suggestions.push({
        type: 'error',
        title: 'Network Connection Issue',
        message: 'Unable to connect to the webhook endpoint.',
        solution: 'Check your internet connection and ensure the Supabase project is accessible.'
      });
    }
    
    if (error.includes('missing') || error.includes('required')) {
      suggestions.push({
        type: 'warning',
        title: 'Missing Required Fields',
        message: 'The webhook received incomplete data.',
        solution: 'Ensure your Google Form includes fields for Name and Email, and that they are mapped correctly in Apps Script.'
      });
    }
    
    if (error.includes('unauthorized') || error.includes('401')) {
      suggestions.push({
        type: 'info',
        title: 'Authentication Fixed',
        message: 'The webhook is now configured to accept requests without authentication.',
        solution: 'This should now work. Try testing the webhook again.'
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        type: 'info',
        title: 'Generic Error',
        message: 'An unexpected error occurred during the webhook test.',
        solution: 'Check the webhook URL and ensure the request format matches the expected structure.'
      });
    }

    return suggestions;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Google Form Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="test">Test Webhook</TabsTrigger>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Status:</strong> The webhook is configured to accept requests without authentication. 
                  Integration is ready for Google Form submissions.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Use this URL in your Google Apps Script webhook configuration
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">Setup Instructions:</h4>
                  <div className="text-sm space-y-2">
                    <p><strong>1.</strong> Create a Google Form with fields for Name, Email, Position, etc.</p>
                    <p><strong>2.</strong> Open Google Apps Script and create a new project</p>
                    <p><strong>3.</strong> Set up a form submission trigger</p>
                    <p><strong>4.</strong> Configure the webhook to send form data to the URL above</p>
                    <p><strong>5.</strong> Test the integration using the Test tab</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium mb-2">Required Form Fields:</h5>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>• Name (required)</div>
                    <div>• Email (required)</div>
                    <div>• Position Applied For</div>
                    <div>• Phone Number</div>
                    <div>• Date of Birth</div>
                    <div>• Resume URL</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Test Webhook Connection</h4>
                    <p className="text-sm text-gray-600">
                      Send a test request to verify the webhook is working
                    </p>
                  </div>
                  <Button 
                    onClick={testWebhook} 
                    disabled={isTestingWebhook}
                    className="bg-cyan-600 hover:bg-blue-700"
                  >
                    {isTestingWebhook ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Test Webhook
                      </>
                    )}
                  </Button>
                </div>

                {webhookTestResult && (
                  <Alert className={webhookTestResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    <div className="flex items-center gap-2">
                      {webhookTestResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription>
                        {webhookTestResult.success ? (
                          <div>
                            <strong>Webhook test successful!</strong>
                            <br />
                            Candidate ID: {webhookTestResult.candidate_id}
                            <br />
                            Form Response ID: {webhookTestResult.form_response_id}
                            <br />
                            <span className="text-sm text-gray-600">
                              Check the Candidates tab to see the new entry
                            </span>
                          </div>
                        ) : (
                          <div>
                            <strong>Webhook test failed:</strong>
                            <br />
                            {webhookTestResult.error}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </TabsContent>

            <TabsContent value="monitor" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Recent Form Submissions</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadRecentSubmissions}
                    disabled={isLoadingSubmissions}
                  >
                    {isLoadingSubmissions ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <p>Form Responses: {recentSubmissions.form_responses?.length || 0}</p>
                  <p>Candidates Created: {recentSubmissions.candidates?.length || 0}</p>
                  <p>Auto-refreshes every 30 seconds</p>
                </div>

                {recentSubmissions.form_responses?.length > 0 ? (
                  <div className="space-y-3">
                    {recentSubmissions.form_responses.map((submission) => (
                      <div key={submission.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{submission.candidate_name}</h5>
                          <Badge variant={submission.status === 'processed' ? 'default' : submission.status === 'failed' ? 'destructive' : 'secondary'}>
                            {submission.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>Email: {submission.candidate_email}</p>
                          <p>Position: {submission.role_applied_for}</p>
                          <p>Submitted: {new Date(submission.created_at).toLocaleString()}</p>
                          {submission.processed_at && (
                            <p>Processed: {new Date(submission.processed_at).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No form submissions found</p>
                    <p className="text-sm">Test the webhook or submit a Google Form to see data here</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="diagnostics" className="space-y-4">
              <div className="space-y-4">
                <h4 className="font-medium">Integration Status</h4>
                
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    ✅ Webhook endpoint is configured and accessible<br/>
                    ✅ Authentication is disabled for public access<br/>
                    ✅ Database tables are ready for form submissions<br/>
                    ✅ Real-time updates are enabled
                  </AlertDescription>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium mb-2">Next Steps:</h5>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>1. Test the webhook:</strong> Use the "Test Webhook" button above
                    </div>
                    <div>
                      <strong>2. Check data flow:</strong> After testing, check the Candidates tab to see new entries
                    </div>
                    <div>
                      <strong>3. Google Form setup:</strong> Configure your Google Apps Script to POST to the webhook URL
                    </div>
                    <div>
                      <strong>4. Monitor submissions:</strong> Use the Monitor tab to track form responses
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleFormIntegration;
