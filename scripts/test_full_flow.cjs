const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // or anon

async function test() {
  const res = await fetch(`${url}/functions/v1/send-assessment-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'apikey': key
    },
    body: JSON.stringify({
      candidate_id: '0a727803-c25d-4780-8d67-e6437c1a55c6',
      assessment_id: '62821550-69fd-4537-b2fa-8a974b6f9545'
    })
  });
  const text = await res.text();
  console.log('Status HTTP:', res.status);
  console.log('Response Body:', text);
}
test();
