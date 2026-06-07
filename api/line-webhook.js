import crypto from 'crypto';

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// LINE署名検証
function validateSignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// プッシュメッセージ送信
async function pushLineMessage(userId, messages) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
  return res;
}

// Supabaseから結果取得（fetch使用）
async function getResult(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/diagnosis_results?line_user_id=eq.${userId}&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    }
  );
  const data = await res.json();
  return data && data.length > 0 ? data[0] : null;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-line-signature'];
  const rawBody = JSON.stringify(req.body);

  if (!validateSignature(rawBody, signature)) {
    return res.status(200).json({ status: 'invalid signature' });
  }

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type === 'follow') {
      const userId = event.source.userId;
      const result = await getResult(userId);

      if (result) {
        await pushLineMessage(userId, [{
          type: 'text',
          text: `🐾 AniCari 動物×キャリア診断結果\n\nあなたは...\n\n✨ ${result.animal}型${result.job}です！\n\n動物占いで判定された「${result.animal}」の特性と、アンケートで導き出された「${result.job}」が組み合わさったあなただけの結果です🎉\n\n詳しい解説はこちら👇\nhttps://anicari-diagnosis.vercel.app`,
        }]);
      } else {
        await pushLineMessage(userId, [{
          type: 'text',
          text: `🐾 AniCari 動物×キャリア診断へようこそ！\n\n友だち追加ありがとうございます✨\n\nまずは診断を受けてみてください👇\nhttps://anicari-diagnosis.vercel.app\n\n生年月日を入力して10問答えるだけで、あなたにぴったりの動物タイプ×キャリアが診断されます🦁`,
        }]);
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}
