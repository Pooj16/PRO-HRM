import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  name: z.string().min(1).max(100).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') navigate('/');
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validated = authSchema.parse({ email, password, name });
      const { error, data } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name: validated.name },
        }
      });
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error("That email is already taken — try signing in instead.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      if (data.user) {
        const { error: hrError } = await supabase
          .from('hr_users')
          .insert([{
            user_id: data.user.id,
            id: data.user.id,
            email: validated.email,
            name: validated.name || validated.email,
            role: 'hr_staff'
          }]);
        if (hrError) console.error('Error creating HR user:', hrError);
        toast.success("You're in! Check your email to verify your account.");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Something went wrong — please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validated = authSchema.parse({ email, password });
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Hmm, that email or password doesn't look right.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success('Welcome back!');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Something went wrong — please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 20% 20%, hsl(237 60% 40% / 0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, hsl(270 60% 55% / 0.10) 0%, transparent 60%), hsl(220 18% 97%)',
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo above card */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/hirespark-logo.png" alt="HireSpark Logo" className="h-10 w-auto object-contain drop-shadow-sm" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">HireSpark</span>
        </div>

        <Card
          className="border border-slate-200 shadow-xl"
          style={{ borderTop: '3px solid hsl(237 60% 40%)' }}
        >
          <CardHeader className="space-y-1 pb-4">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <CardTitle className="text-2xl font-bold">Welcome back 👋</CardTitle>
                <CardDescription className="mt-1">
                  Your hiring pipeline is ready — let's go.
                </CardDescription>
                <CardContent className="px-0 pt-5">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="signin-email" className="text-sm font-medium text-foreground/80">Work email</label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="transition-shadow duration-150 focus:shadow-[0_0_0_3px_hsl(237_60%_40%_/_0.15)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="signin-password" className="text-sm font-medium text-foreground/80">Password</label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="transition-shadow duration-150 focus:shadow-[0_0_0_3px_hsl(237_60%_40%_/_0.15)]"
                      />
                    </div>
                    <Button type="submit" className="w-full mt-2 gap-1.5 font-semibold" disabled={isLoading}>
                      {isLoading ? 'Signing in…' : 'Let me in →'}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>

              <TabsContent value="signup">
                <CardTitle className="text-2xl font-bold">Join the team</CardTitle>
                <CardDescription className="mt-1">
                  Set up your HireSpark account in seconds.
                </CardDescription>
                <CardContent className="px-0 pt-5">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="signup-name" className="text-sm font-medium text-foreground/80">Your name</label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Alex Johnson"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isLoading}
                        className="transition-shadow duration-150 focus:shadow-[0_0_0_3px_hsl(237_60%_40%_/_0.15)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="signup-email" className="text-sm font-medium text-foreground/80">Work email</label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="transition-shadow duration-150 focus:shadow-[0_0_0_3px_hsl(237_60%_40%_/_0.15)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="signup-password" className="text-sm font-medium text-foreground/80">Password</label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="transition-shadow duration-150 focus:shadow-[0_0_0_3px_hsl(237_60%_40%_/_0.15)]"
                      />
                      <p className="text-xs text-muted-foreground">At least 8 characters</p>
                    </div>
                    <Button type="submit" className="w-full mt-2 gap-1.5 font-semibold" disabled={isLoading}>
                      {isLoading ? 'Creating account…' : 'Create my account →'}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
