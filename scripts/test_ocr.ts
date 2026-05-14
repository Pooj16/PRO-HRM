import fs from 'fs';

async function test() {
    console.log("Fetching PDF...");
    const pdfRes = await fetch("https://yupofnjbfsrqvvrtmrhi.supabase.co/storage/v1/object/public/resumes/public/b9d3a140-a42e-470c-a721-990187b21c85.pdf");
    if (!pdfRes.ok) {
        console.log("PDF fetch failed", pdfRes.status);
        return;
    }
    const arrayBuffer = await pdfRes.arrayBuffer();

    // Create base64 without using btoa for node
    const base64String = Buffer.from(arrayBuffer).toString('base64');

    console.log("Sending to OCR server... size: ", base64String.length);
    try {
        const ocrRes = await fetch('http://localhost:5002/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64_data: base64String, content_type: 'application/pdf' })
        });

        if (!ocrRes.ok) {
            console.log("OCR failure", await ocrRes.text());
            return;
        }

        const ocrData = await ocrRes.json();
        console.log("OCR success:", ocrData.success, "text length:", ocrData.extracted_text?.length);
        console.log("Preview text: ", ocrData.extracted_text?.substring(0, 100));
    } catch (err) {
        console.log("Fetch threw error:", err);
    }
}
test();
