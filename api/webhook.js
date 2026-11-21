export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const { slug } = req.query;
  const update = req.body;
  const SUPABASE_URL = "https://famlbufmdobiiljxomey.supabase.co";
  const SUPABASE_KEY = "sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY";

  const joinRequest = update.chat_join_request;
  const chatMember = update.chat_member && update.chat_member.new_chat_member?.status === "member" ? update.chat_member : null;
  const joinEvent = joinRequest || chatMember;

  if (!slug || !joinEvent) return res.status(200).json({ status: "ignored" });

  const tgUser = joinEvent.from || joinEvent.new_chat_member?.user || {};
  const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || "Telegram User";
  const username = tgUser.username ? `@${tgUser.username}` : "No Username";
  const usedInviteLink = joinEvent.invite_link?.invite_link || "";

  try {
    const pageRes = await fetch(`${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${slug}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const pages = await pageRes.json();
    const page = pages[0];
    if (!page) return res.status(200).json({ status: "page_not_found" });

    // 1. Try exact match using the unique invite_link generated for this user
    let latestClick = null;
    if (usedInviteLink) {
      const exactRes = await fetch(`${SUPABASE_URL}/rest/v1/click_logs?page_slug=eq.${slug}&invite_link=eq.${encodeURIComponent(usedInviteLink)}&is_joined=eq.false&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const exactLogs = await exactRes.json();
      latestClick = exactLogs[0] || null;
    }

    // 2. Fallback to latest unjoined click if direct link was used
    if (!latestClick) {
      const logRes = await fetch(`${SUPABASE_URL}/rest/v1/click_logs?page_slug=eq.${slug}&is_joined=eq.false&order=created_at.desc&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const logs = await logRes.json();
      latestClick = logs[0] || null;
    }

    const eventTime = Math.floor(Date.now() / 1000);
    const userData = {
      client_user_agent: latestClick?.user_agent || "TelegramBot/1.0"
    };
    if (latestClick?.fbclid) userData.fbc = `fb.1.${eventTime}.${latestClick.fbclid}`;
    if (latestClick?.fbp) userData.fbp = latestClick.fbp;

    await fetch(`https://graph.facebook.com/v19.0/${page.pixel_id}/events?access_token=${page.capi_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: "Lead",
          event_time: eventTime,
          action_source: "website",
          event_source_url: `https://${req.headers.host}/page.html?id=${slug}`,
          user_data: userData
        }]
      })
    });

    if (latestClick) {
      await fetch(`${SUPABASE_URL}/rest/v1/click_logs?id=eq.${latestClick.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          is_joined: true,
          tg_name: fullName,
          tg_username: username,
          joined_at: new Date().toISOString()
        })
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/click_logs`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          page_slug: slug,
          campaign_name: "Direct Telegram Link",
          is_joined: true,
          tg_name: fullName,
          tg_username: username,
          joined_at: new Date().toISOString()
        })
      });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${slug}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed_joins: (page.confirmed_joins || 0) + 1 })
    });

    return res.status(200).json({ status: "capi_fired", member: fullName });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
