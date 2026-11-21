export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { slug, campaignName, fbclid, fbp, userAgent } = req.body;
  const SUPABASE_URL = "https://famlbufmdobiiljxomey.supabase.co";
  const SUPABASE_KEY = "sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY";

  if (!slug) return res.status(400).json({ error: "Missing slug" });

  try {
    // 1. Fetch landing page details (bot_token, chat_id, fallback link)
    const pageRes = await fetch(`${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${slug}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const pages = await pageRes.json();
    const page = pages[0];
    if (!page) return res.status(404).json({ error: "Page not found" });

    // 2. Ask Telegram Bot to generate a fresh Join Request Link
    const expireDate = Math.floor(Date.now() / 1000) + 600; // 10 mins valid
    const tgRes = await fetch(`https://api.telegram.org/bot${page.bot_token}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: page.chat_id,
        name: `${(campaignName || "Ad").slice(0, 20)}_${Date.now().toString().slice(-4)}`,
        creates_join_request: true,
        expire_date: expireDate
      })
    });
    const tgData = await tgRes.json();

    // Use generated link, or fallback to static invite link if permission issue
    const finalInviteLink = (tgData.ok && tgData.result?.invite_link) 
      ? tgData.result.invite_link 
      : page.tg_invite_link;

    // 3. Log click along with exact generated invite_link
    await fetch(`${SUPABASE_URL}/rest/v1/click_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        page_slug: slug,
        campaign_name: campaignName || "Direct / Organic",
        fbclid: fbclid || "",
        fbp: fbp || "",
        user_agent: userAgent || "",
        invite_link: finalInviteLink
      })
    });

    return res.status(200).json({ invite_link: finalInviteLink });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
