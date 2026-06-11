// Vercel serverless function — proxy to Baidu ASR
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audio, format, rate, channel } = req.body;

  if (!audio) {
    return res.status(400).json({ error: 'Missing audio data' });
  }

  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return res.status(500).json({ error: 'Baidu API keys not configured' });
  }

  try {
    // Step 1: Get Baidu access token
    const tokenRes = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
      { method: 'POST' }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Failed to get Baidu token', detail: tokenData });
    }

    // Step 2: Call Baidu ASR
    const asrBody = {
      format: format || 'pcm',
      rate: rate || 16000,
      channel: channel || 1,
      cuid: 'expense-tracker',
      token: tokenData.access_token,
      speech: audio,        // base64
      len: Math.ceil((audio.length * 3) / 4)  // approximate raw byte length
    };

    const asrRes = await fetch('https://vop.baidu.com/server_api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asrBody)
    });
    const asrData = await asrRes.json();

    if (asrData.err_no !== 0) {
      return res.status(500).json({ error: 'Baidu ASR error', detail: asrData });
    }

    // Step 3: Return transcribed text
    const text = (asrData.result || []).join('');
    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
