import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
);

async function main() {
    const { data: candidates, error } = await supabase.from('candidates').select('id, name, resume_url').is('resume_text', null);
    if (error) {
        console.error("Error fetching candidates:", error);
        return;
    }

    // Also check for empty text
    const { data: emptyCandidates } = await supabase.from('candidates').select('id, name, resume_url').eq('resume_text', '');
    const allTargets = [...(candidates || []), ...(emptyCandidates || [])];

    console.log(`Found ${allTargets.length} candidates needing OCR.`);

    for (const c of allTargets) {
        if (!c.resume_url) continue;

        console.log(`Processing ${c.name}... URL: ${c.resume_url}`);
        try {
            const pdfRes = await fetch(c.resume_url);
            if (!pdfRes.ok) throw new Error("Failed to fetch PDF");
            const arrayBuffer = await pdfRes.arrayBuffer();
            const base64String = Buffer.from(arrayBuffer).toString('base64');

            const ocrRes = await fetch('http://localhost:5002/extract-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64_data: base64String, content_type: 'application/pdf' })
            });

            if (ocrRes.ok) {
                const ocrData = await ocrRes.json();
                if (ocrData.success && ocrData.extracted_text) {
                    console.log(`✅ Extracted ${ocrData.extracted_text.length} chars for ${c.name}`);
                    const { error: updateError } = await supabase.from('candidates').update({
                        resume_text: ocrData.extracted_text,
                        status: 'text_extracted'
                    }).eq('id', c.id);
                    if (updateError) console.error("Update error:", updateError);
                    else console.log(`✅ Updated ${c.name} in DB.`);
                }
            } else {
                console.error(`OCR failed for ${c.name}:`, await ocrRes.text());
            }
        } catch (err) {
            console.error(`Error processing ${c.name}:`, err);
        }
    }
}
main();
