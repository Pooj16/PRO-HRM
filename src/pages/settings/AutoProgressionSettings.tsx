import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoShortlistConfiguration } from "@/components/interviews/AutoShortlistConfiguration";
import { useAutoProgression } from "@/hooks/useAutoProgression";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Settings, Zap } from "lucide-react";

/**
 * Auto-Progression Settings Page
 * Allows HR to configure auto-shortlist rules and manually trigger auto-progression
 */
export const AutoProgressionSettings: React.FC = () => {
  const { triggerAutoProgression } = useAutoProgression();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleManualTrigger = async () => {
    setIsProcessing(true);
    try {
      const result = await triggerAutoProgression();
      if (result?.processed) {
        toast({
          title: "Auto-Progression Complete",
          description: `Processed ${result.processed} candidates, ${result.auto_shortlisted || 0} auto-shortlisted`,
          variant: "default",
        });
      } else {
        toast({
          title: "No Changes",
          description: "No candidates were processed or all are already up-to-date",
          variant: "default",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run auto-progression",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          Auto-Progression Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure automatic candidate progression rules and manage auto-shortlisting
        </p>
      </div>

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="manual">Manual Trigger</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card className="border">
            <CardHeader>
              <CardTitle>Auto-Shortlist Rules per Role</CardTitle>
              <CardDescription>
                Configure which roles should automatically advance qualified candidates to interview scheduling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutoShortlistConfiguration />
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-cyan-200 bg-cyan-50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-900">How Auto-Shortlisting Works</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span>→</span>
                    <span>Candidates complete their assessments</span>
                  </li>
                  <li className="flex gap-2">
                    <span>→</span>
                    <span>System compares their score against the minimum threshold</span>
                  </li>
                  <li className="flex gap-2">
                    <span>→</span>
                    <span>If they qualify AND auto-shortlist is enabled for their role:</span>
                  </li>
                  <li className="flex gap-2 ml-4">
                    <span>✓</span>
                    <span>Their status is automatically updated to "interview_scheduled"</span>
                  </li>
                  <li className="flex gap-2 ml-4">
                    <span>✓</span>
                    <span>You receive a notification</span>
                  </li>
                  <li className="flex gap-2 ml-4">
                    <span>✓</span>
                    <span>The action is logged to the audit trail</span>
                  </li>
                  <li className="flex gap-2">
                    <span>→</span>
                    <span>You can then schedule their interviews</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Trigger Tab */}
        <TabsContent value="manual" className="space-y-4">
          <Card className="border">
            <CardHeader>
              <CardTitle>Manual Auto-Progression Trigger</CardTitle>
              <CardDescription>
                Manually run the auto-progression process to update candidate statuses immediately
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will process all candidates with completed assessments and:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Check their assessment scores</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Compare against role thresholds</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Auto-shortlist qualifying candidates (if enabled)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Send you a summary report</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleManualTrigger}
                disabled={isProcessing}
                size="lg"
                className="w-full gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
                {isProcessing ? "Processing..." : "Run Auto-Progression Now"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This action is safe to run multiple times. Candidates are only progressed once.
              </p>
            </CardContent>
          </Card>

          {/* Best Practices Card */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-amber-900">Best Practices</h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li>• Run auto-progression after completing each assessment batch</li>
                  <li>• Review the notification to see which candidates advanced</li>
                  <li>• Adjust role thresholds based on candidate quality feedback</li>
                  <li>• Use the audit trail to track all auto-progression actions</li>
                  <li>• Disable auto-shortlist for roles requiring manual review</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
