import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const gmailUser = Deno.env.get('GMAIL_USER');
        const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');

        const supabase = createClient(supabaseUrl, serviceKey);

        // Get specific column info for assessment_assignments
        const { data: columns, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'assessment_assignments' });
        // Note: get_table_columns might not exist, fallback to information_schema via query if possible
        // Since we can't easily run arbitrary SQL via RPC if it doesn't exist, we'll try a small select on the column

        const { error: sessionColError } = await supabase.from('assessment_assignments').select('session_id').limit(1);

        const diagnostics: any = {
            timestamp: new Date().toISOString(),
            env: {
                GMAIL_USER: !!Deno.env.get('GMAIL_USER'),
                GMAIL_APP_PASSWORD: !!Deno.env.get('GMAIL_APP_PASSWORD'),
                SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
                SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
                GMAIL_USER_VALUE: Deno.env.get('GMAIL_USER') || null
            },
            schema_checks: {}
        };
        diagnostics.schema_checks.assessment_assignments_has_session_id = !sessionColError;

        try {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            const tablesToCheck = ['candidates', 'assessments', 'assessment_sessions', 'evaluation_results', 'assessment_assignments', 'rate_limit_tracking'];
            const tables: Record<string, any> = {};

            for (const table of tablesToCheck) {
                const { error } = await supabase.from(table).select('id').limit(1);
                tables[table] = { exists: !error };
            }
            diagnostics.tables = tables; // Assign tables to diagnostics here
        } catch (err: any) {
            diagnostics.tables_check_error = err.message;
        }


        // Direct test call
        try {
            const { data, error } = await supabase.functions.invoke('create-assessment-session', {
                body: {
                    candidate_id: '0a727803-c25d-4780-8d67-e6437c1a55c6',
                    assessment_id: 'bf575e45-2534-403f-bafe-430ad9647b54'
                }
            });
            diagnostics.session_creation_test = { data, error };
        } catch (err: any) {
            diagnostics.session_creation_test = { catch_error: err.message };
        }

        // Check columns of assessment_sessions
        try {
            const { data: colCheck } = await supabase.from('assessment_sessions').select('*').limit(1);
            diagnostics.assessment_sessions_columns = colCheck && colCheck.length > 0 ? Object.keys(colCheck[0]) : 'empty table';
        } catch (err: any) {
            diagnostics.assessment_sessions_columns_error = err.message;
        }

        // Thorough anon access check
        try {
            const anonClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? ''
            );

            const checks: any = {};

            // 1. Session check
            const { data: sData, error: sErr } = await anonClient.from('assessment_sessions').select('id').limit(1);
            checks.assessment_sessions = { success: !sErr, error: sErr?.message };

            // 2. Candidates check
            const { data: cData, error: cErr } = await anonClient.from('candidates').select('id').limit(1);
            checks.candidates = { success: !cErr, error: cErr?.message };

            // 3. Assessments check
            const { data: aData, error: aErr } = await anonClient.from('assessments').select('id').limit(1);
            checks.assessments = { success: !aErr, error: aErr?.message };

            diagnostics.anon_access_depth_test = checks;
        } catch (err: any) {
            diagnostics.anon_access_depth_test_error = err.message;
        }

        return new Response(JSON.stringify(diagnostics, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
