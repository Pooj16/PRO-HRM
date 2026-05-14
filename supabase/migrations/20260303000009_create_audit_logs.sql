
-- 🛡️ Creating missing audit_logs table
-- This table is required by multiple edge functions.

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by_role TEXT DEFAULT 'system',
    changed_by_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role (Edge Functions) full access
DROP POLICY IF EXISTS "Service role full access" ON public.audit_logs;
CREATE POLICY "Service role full access" ON public.audit_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Allow public to see logs (optional, but prevents PGRST205)
DROP POLICY IF EXISTS "Public view logs" ON public.audit_logs;
CREATE POLICY "Public view logs" ON public.audit_logs
    FOR SELECT
    TO public
    USING (true);
