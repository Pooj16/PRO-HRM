
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Save, Settings, User, Shield, Key } from 'lucide-react';

const HRSettings = () => {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    role: 'hr_staff'
  });
  // Gemini API key removed; using internal ai-assistant or other providers
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentUser();
    loadProfileData();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadProfileData = async () => {
    try {
      const { data, error } = await supabase
        .from('hr_users')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setExistingUserId(data.id);
        setProfile({
          name: data.name,
          email: data.email,
          role: data.role
        });
        // legacy gemini key removed from UI
        setIsGoogleConnected(data.google_calendar_connected || false);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const profileData = {
        email: profile.email,
        name: profile.name,
        role: profile.role
      };

      let result;
      if (existingUserId) {
        result = await supabase
          .from('hr_users')
          .update(profileData)
          .eq('id', existingUserId)
          .select()
          .single();
      } else {
        result = await supabase
          .from('hr_users')
          .insert({
            user_id: currentUserId || '',
            email: profile.email,
            name: profile.name,
            role: profile.role
          })
          .select()
          .single();

        if (result.data) {
          setExistingUserId(result.data.id);
        }
      }

      if (result.error) throw result.error;

      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully."
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Gemini API key management removed

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">HR Settings</h1>
        <Settings className="h-6 w-6" />
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Manage your HR profile and account settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="Enter your email address"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="hr_staff">HR Staff</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="hr_admin">HR Admin</option>
                </select>
              </div>

              <Button onClick={saveProfile} disabled={loading} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div >
  );
};

export default HRSettings;
