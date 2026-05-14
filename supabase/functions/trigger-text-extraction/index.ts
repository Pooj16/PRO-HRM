import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { candidateId, candidateIds } = body;
    console.log('🔥 Manual text extraction triggered');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (candidateIds && candidateIds.length > 0) {
      console.log('📊 Batch extraction for:', candidateIds.length, 'candidates');
      const results = [];
      for (const id of candidateIds) {
        const result = await extractForCandidate(supabase, id);
        results.push(result);
      }
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (candidateId) {
      console.log('🎯 Single extraction for candidate:', candidateId);
      const result = await extractForCandidate(supabase, candidateId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error('Either candidateId or candidateIds must be provided');
    }

  } catch (error: any) {
    console.error('❌ Manual extraction error:', error);
    return new Response(JSON.stringify({
      error: error.message || String(error),
      success: false
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractForCandidate(supabase: any, candidateId: string) {
  // Get candidate info
  const { data: candidate, error: fetchError } = await supabase
    .from('candidates')
    .select('id, name, resume_url, status')
    .eq('id', candidateId)
    .single();

  if (fetchError || !candidate) {
    return { candidateId, success: false, error: 'Candidate not found' };
  }

  if (!candidate.resume_url) {
    return { candidateId, success: false, error: 'No resume URL' };
  }

  console.log('📄 Processing:', candidate.name, '| URL:', candidate.resume_url);

  // Update status to extracting
  await supabase.from('candidates').update({ status: 'extracting_text' }).eq('id', candidateId);

  try {
    // ── Step 1: Resolve the file URL ─────────────────────────────────────────
    let fileUrl = candidate.resume_url;
    if (fileUrl.includes('/storage/v1/object/')) {
      try {
        const url = new URL(fileUrl);
        const afterObject = url.pathname.split('/storage/v1/object/')[1];
        const pathParts = afterObject.split('/');
        const isPublic = pathParts[0] === 'public' || pathParts[0] === 'authenticated';
        const bucketName = isPublic ? pathParts[1] : pathParts[0];
        const storagePath = pathParts.slice(isPublic ? 2 : 1).join('/');

        const { data: signed } = await supabase.storage.from(bucketName).createSignedUrl(storagePath, 300);
        if (signed?.signedUrl) fileUrl = signed.signedUrl;
      } catch (_) {
        // keep original url
      }
    }

    // ── Step 2: Download file ─────────────────────────────────────────────────
    const downloadRes = await fetch(fileUrl);
    if (!downloadRes.ok) throw new Error(`HTTP ${downloadRes.status} downloading resume`);

    const contentType = downloadRes.headers.get('content-type') || '';
    const buffer = await downloadRes.arrayBuffer();
    console.log(`⬇️  Downloaded ${buffer.byteLength} bytes`);

    // ── Step 3: Extract text ──────────────────────────────────────────────────
    let text = '';
    const isPdf = candidate.resume_url.toLowerCase().endsWith('.pdf') || contentType.includes('pdf');
    const isDocx = candidate.resume_url.toLowerCase().endsWith('.docx') || contentType.includes('officedocument');

    if (isPdf) {
      text = await extractPdf(buffer);
    } else if (isDocx) {
      text = await extractDocx(buffer);
    } else {
      try { text = await extractPdf(buffer); } catch (_) { text = extractRaw(buffer); }
    }

    text = sanitise(text);
    console.log(`✅ Extracted ${text.length} chars`);

    if (text.length < 20) throw new Error('Extracted text too short — file may be image-based or corrupted');

    // ── Step 4: Save ──────────────────────────────────────────────────────────
    const { error: updateError } = await supabase.from('candidates').update({
      resume_text: text,
      status: 'text_extracted',
    }).eq('id', candidateId);

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    console.log(`🎉 Saved resume_text for ${candidateId}`);
    return { candidateId, success: true, textLength: text.length };

  } catch (err: any) {
    console.error(`❌ Extraction failed for ${candidateId}:`, err.message);
    await supabase.from('candidates').update({
      status: 'extraction_failed',
      resume_text: `Extraction failed: ${err.message}`
    }).eq('id', candidateId);
    return { candidateId, success: false, error: err.message };
  }
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfMod = await import('npm:pdf-parse@1.1.1');
  const pdfParse = pdfMod.default ?? pdfMod;
  const { Buffer } = await import('node:buffer');
  const data = await pdfParse(Buffer.from(buffer));
  return data.text ?? '';
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
  const zip = await JSZip.loadAsync(buffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) throw new Error('Invalid DOCX');
  const xml = await docXml.async('text');
  return (xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map((m: string) => m.replace(/<[^>]+>/g, ''))
    .join(' ');
}

function extractRaw(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, ' ')
    .replace(/\s{3,}/g, '  ').trim();
}

function sanitise(text: string): string {
  return text.replace(/\x00/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/[ \t]{4,}/g, '   ').replace(/\n{4,}/g, '\n\n\n').trim();
}