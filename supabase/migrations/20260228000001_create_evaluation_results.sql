-- Evaluation Results Table Migration
-- Stores the final grade and AI explanatory logic for HR view, decoupled from candidate answers directly

CREATE TABLE IF NOT EXISTS public.evaluation_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    
    -- Final scoring aggregate
    overall_score DECIMAL(5,2) NOT NULL,
    total_possible DECIMAL(5,2) NOT NULL,
    
    -- Granular breakdown per question (JSON array structure)
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- AI Justifications
    ai_explanation JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id)
);

ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;

-- HR should have full access to evaluations
CREATE POLICY "HR access to evaluations" ON public.evaluation_results
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Candidates generally shouldn't see exact breakdown evaluations to prevent cheating loops, 
-- but if we want to allow viewing score AFTER HR approves, we can conditionalize it.
-- For now, NO PUBLIC access to granular evaluations.
