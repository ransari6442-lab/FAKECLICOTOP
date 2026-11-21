export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const { slug } = req.query;
  const update = req.body;
  const SUPABASE_URL = "https://famlbufmdobiijxomey.supabase.co";
  const SUPABASE_KEY = "sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY";

  // Check if user sent a Join Request or Joined Channel
  const joinEvent = update.chat_join_request || (update.chat_member && update.chat_member.new_chat_member?.status === "member" ? update.chat_member : null);

  if (!slug || !joinEvent) return res.status(200).json({ status: "ignored" });

  try {
    // 1. Fetch landing page config
    const pageRes = await fetch(${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${slug}&select=*, {
      headers: { apikey: SUPABASE_KEY, Authorization: Bearer ${SUPABASE_KEY} }
    });
    const pages = await pageRes.json();
    const page = pages[0];
    if (!page) return res.status(200).json({ status: "page_not_found" });

    // 2. Get latest unjoined click log for fbclid attribution
    const logRes = await fetch(${SUPABASE_URL}/rest/v1/click_logs?page_slug=eq.${slug}&is_joined=eq.false&order=created_at.desc&limit=1, {
      headers: { apikey: SUPABASE_KEY, Authorization: Bearer ${SUPABASE_KEY} }
    });
    const logs = await logRes.json();
    const latestClick = logs[0];

    // 3. Fire Meta CAPI "Lead" Event ONLY when real Telegram join happens
    const eventTime = Math.floor(Date.now() / 1000);
    const userData = {
      client_user_agent: latestClick?.user_agent || "TelegramBot/1.0"
    };
    if (latestClick?.fbclid) userData.fbc = fb.1.${eventTime}.${latestClick.fbclid};
    if (latestClick?.fbp) userData.fbp = latestClick.fbp;

    await fetch(https://graph.facebook.com/v19.0/${page.pixel_id}/events?access_token=${page.capi_token}, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: "Lead",
          event_time: eventTime,
          action_source: "website",
          event_source_url: https://${req.headers.host}/page.html?id=${slug},
          user_data: userData
        }]
      })
    });

    // 4. Mark click joined & increment confirmed_joins count
    if (latestClick) {
      await fetch(${SUPABASE_URL}/rest/v1/click_logs?id=eq.${latestClick.id}, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: Bearer ${SUPABASE_KEY}, "Content-Type": "application/json" },
        body: JSON.stringify({ is_joined: true })
      });
    }

    await fetch(${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${slug}, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: Bearer ${SUPABASE_KEY}, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed_joins: (page.confirmed_joins || 0) + 1 })
    });

    return res.status(200).json({ status: "capi_fired" });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
