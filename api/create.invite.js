import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://famlbufmdobiiljxomey.supabase.co',
  'sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY'
);

export default async function handler(req, res) {
  const slug = req.query.slug || req.body?.slug || 'vip-n6de90';
  const { data: page } = await supabase.from('landing_pages').select('*').eq('slug', slug).single();
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const chatId = page.chat_id.toString().startsWith('-100')
    ? page.chat_id.toString().trim()
    : `-100${page.chat_id.toString().replace(/^-/, '').trim()}`;

  const tgRes = await fetch(`https://api.telegram.org/bot${page.bot_token.trim()}/createChatInviteLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      name: 'Test_Request_Link',
      creates_join_request: true
    })
  });
  const tgData = await tgRes.json();
  return res.status(200).json({ chat_id_used: chatId, telegram_response: tgData });
}
