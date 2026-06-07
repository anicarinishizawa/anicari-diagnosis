import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, animal, job } = req.body;

  if (!token || !animal || !job) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // tokenをline_user_idとして保存（後でLINE IDに紐付け）
  const { error } = await supabase
    .from('diagnosis_results')
    .upsert({
      line_user_id: token,
      animal,
      job,
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
