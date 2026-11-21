const SUPABASE_URL = 'https://famlbufmdobiiljxomey.supabase.co';
const SUPABASE_KEY = 'sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { slug, campaignName, fbclid, fbp, userAgent } = req.body || {};
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const pageRes = await fetch(
      `${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${encodeURIComponent(slug)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const pages = await pageRes.json();
    const page = Array.isArray(pages) ? pages[0] : null;

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    let finalInviteLink = page.tg_invite_link;
    let tgError = null;

    if (page.bot_token && page.chat_id) {
      const rawId = page.chat_id.toString().trim();
      const chatId = rawId.startsWith('-100') ? rawId : `-100${rawId.replace(/^-/, '')}`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${page.bot_token.trim()}/createChatInviteLink`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            name: (campaignName || 'Ad').substring(0, 32),
            creates_join_request: true
          })
        }
      );
      const tgData = await tgRes.json();

      if (tgData.ok && tgData.result?.invite_link) {
        finalInviteLink = tgData.result.invite_link;
      } else {
        tgError = tgData;
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/click_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        page_slug: slug,
        campaign_name: campaignName || 'Direct / Organic',
        fbclid: fbclid || '',
        fbp: fbp || '',
        user_agent: userAgent || '',
        invite_link: finalInviteLink,
        is_joined: false
      })
    });

    return res.status(200).json({ invite_link: finalInviteLink, tgError });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
