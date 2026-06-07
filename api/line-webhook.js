import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// LINE署名検証
function validateSignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINEにメッセージ送信
async function sendLineMessage(replyToken, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// プッシュメッセージ送信
async function pushLineMessage(userId, messages) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
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
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const events = req.body.events || [];

  for (const event of events) {
    // 友だち追加イベント
    if (event.type === 'follow') {
      const userId = event.source.userId;

      // データベースから診断結果を取得
      const { data, error } = await supabase
        .from('diagnosis_results')
        .select('*')
        .eq('line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const result = data[0];
        // 診断結果をLINEで送信
        await pushLineMessage(userId, [
          {
            type: 'text',
            text: `🐾 AniCari 動物×キャリア診断結果\n\nあなたは...\n\n✨ ${result.animal}型${result.job}です！\n\n動物占いで判定された「${result.animal}」の特性と、アンケートで導き出された「${result.job}」が組み合わさったあなただけの結果です🎉\n\n詳しい解説はこちら👇\nhttps://anicari-diagnosis.vercel.app`,
          }
        ]);
      } else {
        // 診断結果がない場合
        await pushLineMessage(userId, [
          {
            type: 'text',
            text: `🐾 AniCari 動物×キャリア診断へようこそ！\n\n友だち追加ありがとうございます✨\n\nまずは診断を受けてみてください👇\nhttps://anicari-diagnosis.vercel.app\n\n生年月日を入力して10問答えるだけで、あなたにぴったりの動物タイプ×キャリアが診断されます🦁`,
          }
        ]);
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}
