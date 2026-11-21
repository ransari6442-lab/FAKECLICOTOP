import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://famlbufmdobiiljxomey.supabase.co',
  'sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY'
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slug, campaignName, fbclid, fbp, userAgent } = req.body;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  const { data: page, error: pageErr } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .single();

  if (pageErr || !page) {
    return res.status(404).json({ error: 'Page not found' });
  }

  let finalInviteLink = page.tg_invite_link;

  if (page.bot_token && page.chat_id) {
    try {
      const chatId = page.chat_id.toString().startsWith('-100')
        ? page.chat_id.toString().trim()
        : `-100${page.chat_id.toString().replace(/^-/, '').trim()}`;

      const tgRes = await fetch(`https://api.telegram.org/bot${page.bot_token.trim()}/createChatInviteLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          name: (campaignName || 'Ad').substring(0, 32),
          creates_join_request: true
        })
      });
      const tgData = await tgRes.json();

      if (tgData.ok && tgData.result?.invite_link) {
        finalInviteLink = tgData.result.invite_link;
      }
    } catch (err) {}
  }

  await supabase.from('click_logs').insert([{
    page_slug: slug,
    campaign_name: campaignName || 'Direct / Organic',
    fbclid: fbclid || '',
    fbp: fbp || '',
    user_agent: userAgent || '',
    invite_link: finalInviteLink,
    is_joined: false
  }]);

  return res.status(200).json({ invite_link: finalInviteLink });
}
