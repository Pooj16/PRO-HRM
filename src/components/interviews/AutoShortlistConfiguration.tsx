import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface RoleThreshold {
  id: string;
  role_name: string;
  min_assessment_score: number;
  auto_shortlist: boolean;
}

/**
 * Component for HR to configure auto-shortlist settings per role
 * Controls which roles automatically progress candidates to interview scheduling
 */
export const AutoShortlistConfiguration: React.FC = () => {
  const [roles, setRoles] = useState<RoleThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Load current role thresholds
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("role_thresholds")
          .select("id, role_name, min_assessment_score, auto_shortlist")
          .order("role_name");

        if (error) throw error;
        setRoles(data || []);
      } catch (error) {
        console.error("Error loading role thresholds:", error);
        toast({
          title: "Error",
          description: "Failed to load role thresholds",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadRoles();
  }, [toast]);

  const handleThresholdChange = (
    roleId: string,
    field: "min_assessment_score" | "auto_shortlist",
    value: number | boolean
  ) => {
    setRoles((prevRoles) =>
      prevRoles.map((role) =>
        role.id === roleId ? { ...role, [field]: value } : role
      )
    );
    setUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each role threshold
      for (const role of roles) {
        const { error } = await supabase
          .from("role_thresholds")
          .update({
            min_assessment_score: role.min_assessment_score,
            auto_shortlist: role.auto_shortlist,
          })
          .eq("id", role.id);

        if (error) throw error;
      }

      setUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Auto-shortlist configuration saved",
        variant: "default",
      });
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Shortlist Configuration</CardTitle>
        <CardDescription>
          Control which roles automatically advance qualified candidates to interview
          scheduling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roles.length === 0 ? (
            <p className="text-sm text-gray-500">No roles configured</p>
          ) : (
            <>
              {/* Header Row */}
              <div className="grid grid-cols-4 gap-4 border-b pb-3 text-sm font-semibold text-gray-600">
                <div>Role Name</div>
                <div>Min Score</div>
                <div>Auto-Shortlist</div>
                <div></div>
              </div>

              {/* Role Rows */}
              {roles.map((role) => (
                <div key={role.id} className="grid grid-cols-4 gap-4 items-center py-3 border-b">
                  <div className="font-medium">{role.role_name}</div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={role.min_assessment_score}
                      onChange={(e) =>
                        handleThresholdChange(
                          role.id,
                          "min_assessment_score",
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-20"
                    />
                  </div>
                  <div>
                    <Switch
                      checked={role.auto_shortlist}
                      onCheckedChange={(checked) =>
                        handleThresholdChange(
                          role.id,
                          "auto_shortlist",
                          checked
                        )
                      }
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {role.auto_shortlist ? "✓ Enabled" : "○ Disabled"}
                  </div>
                </div>
              ))}

              {/* Save Button */}
              {unsavedChanges && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
