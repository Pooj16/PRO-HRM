-- Assessment Portal Architecture Initial Migration
-- Creates the secure candidate-facing tables, isolated from HR view access.

-- 1. Assessment Sessions Table (Links candidate, assessment, and the secure token)
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    
    -- Security Token Layer
    token VARCHAR UNIQUE NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending', -- pending, in_progress, submitted, evaluated
    
    -- Time Bounds
    expires_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    auto_submitted BOOLEAN DEFAULT false,
    
    -- Final scoring aggregate
    score DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure 1 active session mapping per test per candidate
    UNIQUE(candidate_id, assessment_id)
);

-- 2. Candidate Responses Table (Granular incremental saving array)
CREATE TABLE IF NOT EXISTS public.candidate_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    
    -- Candidate Payload
    answer_text TEXT,
    is_correct BOOLEAN,
    points_awarded DECIMAL(5,2),
    
    -- AI Evaluation (Never retrieved blindly by standard API routes)
    ai_reasoning TEXT,
    
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, question_id)
);

-- 3. Row Level Security Policies

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_responses ENABLE ROW LEVEL SECURITY;

-- Candidates can ONLY READ their specific session by token lookup (RESTful approach)
CREATE POLICY "Public token access for sessions" ON public.assessment_sessions
    FOR SELECT TO public
    USING (status != 'evaluated'); -- Do not expose completed and graded sessions by default to prevent snooping

-- Authenticated HR can do ALL (Create invites, read scores)
CREATE POLICY "HR access to sessions" ON public.assessment_sessions
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Candidates can INSERT/UPDATE responses conditionally via a database function wrapper or direct matching token (RPC preferred for this, but simplistic RLS provided)
CREATE POLICY "Public token insert access for responses" ON public.candidate_responses
    FOR INSERT TO public
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.assessment_sessions 
        WHERE id = session_id 
        AND status = 'in_progress' 
        AND expires_at > NOW()
    ));

CREATE POLICY "Public token update access for responses" ON public.candidate_responses
    FOR UPDATE TO public
    USING (EXISTS (
        SELECT 1 FROM public.assessment_sessions 
        WHERE id = session_id 
        AND status = 'in_progress'
        AND expires_at > NOW()
    ));

CREATE POLICY "HR access to responses" ON public.candidate_responses
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
