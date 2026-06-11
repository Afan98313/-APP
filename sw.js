const CACHE_NAME = 'expense-tracker-v2';
const ASSETS = [
  '/-APP/',
  '/-APP/index.html',
  '/-APP/css/app.css',
  '/-APP/js/db.js',
  '/-APP/js/parser.js',
  '/-APP/js/voice.js',
  '/-APP/js/ui.js',
  '/-APP/js/app.js'
];

// Baidu ASR credentials (embedded in SW for Chinese network access)
const BAIDU_API_KEY = 'GADAVKbDllWnPw1uNqBKdLKK';
const BAIDU_SECRET_KEY = 'ZC7PTxYKLFQPrU5rd5iwD7bXy1Ms396b';

let baiduToken = null;
let tokenExpiry = 0;

async function getBaiduToken() {
  if (baiduToken && Date.now() < tokenExpiry) return baiduToken;

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
  const resp = await fetch(url, { method: 'POST' });
  const data = await resp.json();

  if (data.access_token) {
    baiduToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // 5 min buffer
    return baiduToken;
  }
  throw new Error('Baidu token failed: ' + JSON.stringify(data));
}

async function handleVoiceAPI(request) {
  try {
    const body = await request.json();
    const { audio, format, rate, channel } = body;

    if (!audio) {
      return new Response(JSON.stringify({ error: '缺少音频数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const token = await getBaiduToken();

    // Calculate approximate raw byte length from base64
    const rawLen = Math.ceil((audio.length * 3) / 4);

    const asrBody = {
      format: format || 'pcm',
      rate: rate || 16000,
      channel: channel || 1,
      cuid: 'expense-tracker-pwa',
      token: token,
      speech: audio,
      len: rawLen
    };

    const asrResp = await fetch('https://vop.baidu.com/server_api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asrBody)
    });

    const asrData = await asrResp.json();

    if (asrData.err_no !== 0) {
      return new Response(JSON.stringify({
        error: '语音识别失败',
        detail: asrData.err_msg || asrData
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const text = (asrData.result || []).join('');
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: '处理失败', detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Install: cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS).catch(err => console.warn('Cache partial:', err))
    )
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: proxy API calls, cache static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Intercept /api/voice requests → proxy to Baidu ASR
  if (url.pathname.includes('/api/voice')) {
    e.respondWith(handleVoiceAPI(e.request.clone()));
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
