export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = 'https://famlbufmdobiiljxomey.supabase.co';
  const SUPABASE_KEY = 'sb_publishable__JJOo6JOGVNIAcaOCjsAPQ_kKljVdZY';
  const fallbackImg = 'https://i.ibb.co/1J2HgYpQ/IMG-20261103-094934-226.jpg';

  try {
    if (!id) return res.redirect(302, fallbackImg);

    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${encodeURIComponent(id)}&select=bot_token,channel_id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const rows = await dbRes.json();
    if (!rows.length || !rows[0].bot_token || !rows[0].channel_id) {
      return res.redirect(302, fallbackImg);
    }

    const { bot_token, channel_id } = rows[0];
    const chatRes = await fetch(`https://api.telegram.org/bot${bot_token}/getChat?chat_id=${encodeURIComponent(channel_id)}`);
    const chatData = await chatRes.json();
    const fileId = chatData?.result?.photo?.big_file_id;

    if (!fileId) return res.redirect(302, fallbackImg);

    const fileRes = await fetch(`https://api.telegram.org/bot${bot_token}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData?.result?.file_path;

    if (!filePath) return res.redirect(302, fallbackImg);

    const imgRes = await fetch(`https://api.telegram.org/file/bot${bot_token}/${filePath}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(buffer);
  } catch (e) {
    return res.redirect(302, fallbackImg);
  }
}
