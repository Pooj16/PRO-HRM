import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log(`📄 extract-resume-text-openai function triggered - ${req.method}`);

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { resumeUrl, candidateId } = await req.json();

        if (!resumeUrl) {
            throw new Error('resumeUrl is required');
        }
        if (!candidateId) {
            throw new Error('candidateId is required');
        }

        console.log(`🔗 Resume URL/path: ${resumeUrl}`);
        console.log(`👤 Candidate ID: ${candidateId}`);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // ── Step 1: Get a signed URL or public URL for the file ──────────────────────
        let fileUrl: string;

        if (resumeUrl.startsWith('http')) {
            // Check if it's a Supabase storage URL
            if (resumeUrl.includes('/storage/v1/object/')) {
                console.log('🔍 Detected Supabase Storage URL, attempting to extract path for signing...');
                try {
                    const url = new URL(resumeUrl);
                    // Extract path: /storage/v1/object/public/resumes/path/to/file.pdf
                    const pathParts = url.pathname.split('/storage/v1/object/')[1].split('/');
                    // Skip 'public' or 'authenticated' prefix if present
                    const hasPrefix = pathParts[0] === 'public' || pathParts[0] === 'authenticated';
                    const bucketName = hasPrefix ? pathParts[1] : pathParts[0];
                    const storagePath = pathParts.slice(hasPrefix ? 2 : 1).join('/');

                    console.log(`☁️  Extracted bucket: ${bucketName}, path: ${storagePath}`);

                    const { data: signedData, error: signedError } = await supabase.storage
                        .from(bucketName)
                        .createSignedUrl(storagePath, 300);

                    if (signedData?.signedUrl) {
                        fileUrl = signedData.signedUrl;
                        console.log('✅ Created signed URL for Supabase storage');
                    } else {
                        console.warn('⚠️  Could not create signed URL, falling back to original URL');
                        fileUrl = resumeUrl;
                    }
                } catch (e) {
                    console.warn('⚠️  Could not parse URL as Supabase storage URL:', e.message);
                    fileUrl = resumeUrl;
                }
            } else {
                fileUrl = resumeUrl;
                console.log('📎 Using provided full URL directly');
            }
        } else {
            // It's a storage path
            const bucketName = 'resumes';
            const storagePath = resumeUrl.startsWith('resumes/') ? resumeUrl.replace('resumes/', '') : resumeUrl;
            console.log(`☁️  Generating signed URL for storage path: ${storagePath} in bucket: ${bucketName}`);

            const { data: signedData, error: signedError } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(storagePath, 300);

            if (signedError || !signedData?.signedUrl) {
                console.error('❌ Failed to create signed URL:', signedError);
                throw new Error(`Could not create signed URL: ${signedError?.message || 'Unknown error'}`);
            }

            fileUrl = signedData.signedUrl;
            console.log('✅ Signed URL created');
        }

        // ── Step 2: Download the file ────────────────────────────────────────────────
        console.log('⬇️  Downloading resume file from:', fileUrl.split('?')[0] + '...');
        const downloadResponse = await fetch(fileUrl);

        if (!downloadResponse.ok) {
            throw new Error(`Failed to download resume: HTTP ${downloadResponse.status} ${downloadResponse.statusText}`);
        }

        const contentType = downloadResponse.headers.get('content-type') || '';
        const fileBuffer = await downloadResponse.arrayBuffer();
        console.log(`📦 Downloaded ${fileBuffer.byteLength} bytes, content-type: ${contentType}`);

        // ── Step 3: Extract text depending on file type ──────────────────────────────
        let extractedText = '';
        const lowerUrl = resumeUrl.toLowerCase();
        const isPdf = lowerUrl.endsWith('.pdf') || contentType.includes('pdf');
        const isDocx = lowerUrl.endsWith('.docx') || contentType.includes('officedocument.wordprocessingml');

        try {
            if (isPdf) {
                console.log('📑 Extracting text from PDF...');
                extractedText = await extractTextFromPdf(fileBuffer);
            } else if (isDocx) {
                console.log('📝 Extracting text from DOCX...');
                extractedText = await extractTextFromDocx(fileBuffer);
            } else {
                console.log('🔍 Unknown type, trying PDF first then raw...');
                try {
                    extractedText = await extractTextFromPdf(fileBuffer);
                } catch {
                    extractedText = extractRawText(fileBuffer);
                }
            }
        } catch (extractError) {
            console.warn('⚠️ Primary extraction failed, trying raw fallback:', extractError.message);
            extractedText = extractRawText(fileBuffer);
        }

        // Sanitise the extracted text
        extractedText = sanitiseText(extractedText);
        console.log(`✅ Extracted ${extractedText.length} characters of text`);

        // Check for OCR fallback if text is too thin
        if (extractedText.length < 50) {
            console.log('⚠️ Insufficient text extracted, attempting OCR fallback via AI assistant...');
            try {
                const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ai-assistant', {
                    body: {
                        action: 'extract_text',
                        resumeUrl: fileUrl,
                        candidateId: candidateId
                    }
                });

                if (!ocrError && ocrData?.result?.extractedText) {
                    extractedText = ocrData.result.extractedText;
                    console.log(`✅ OCR fallback successful: ${extractedText.length} characters`);
                } else {
                    console.warn('❌ OCR fallback failed or returned no text:', ocrError);
                }
            } catch (ocrErr) {
                console.warn('❌ OCR fallback exception:', ocrErr.message);
            }
        }

        if (extractedText.length < 20) {
            throw new Error('Resume text extraction produced insufficient content. The file may be image-based or corrupted.');
        }

        // ── Step 4: Save text + update status ────────────────────────────────────────
        const { error: updateError } = await supabase
            .from('candidates')
            .update({
                resume_text: extractedText,
                status: 'text_extracted',
            })
            .eq('id', candidateId);

        if (updateError) {
            console.error('❌ Failed to save resume_text:', updateError);
            throw new Error(`Failed to save extracted text: ${updateError.message}`);
        }

        console.log(`🎉 resume_text saved for candidate ${candidateId}`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Resume text extracted successfully',
            candidateId,
            textLength: extractedText.length,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('❌ extract-resume-text-openai error:', error.message);

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
    try {
        const pdfParseModule = await import('npm:pdf-parse@1.1.1');
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const { Buffer } = await import('node:buffer');

        const bufferData = Buffer.from(buffer);
        const data = await pdfParse(bufferData);
        return data.text || '';
    } catch (error) {
        console.error('PDF extraction error:', error.message);
        throw error;
    }
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) throw new Error('Not a valid DOCX');
    const xmlContent = await docXmlFile.async('text');
    const matches = xmlContent.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return matches.map((m: string) => m.replace(/<[^>]+>/g, '')).join(' ');
}

function extractRawText(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(bytes).replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, ' ').trim();
}

function sanitiseText(text: string): string {
    return text.replace(/\x00/g, '').replace(/\r\n/g, '\n').replace(/\s{3,}/g, '  ').trim();
}
