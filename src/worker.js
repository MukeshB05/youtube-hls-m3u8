/* global addEventListener, Response */
addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (err) => new Response(err.message, { status: 500 })
    )
  )
})

async function fetchStreamWithClient(videoId, clientConfig) {
  const apiUrl = 'https://www.youtube.com/youtubei/v1/player';
  const payload = {
    context: { client: clientConfig.context },
    videoId: videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': clientConfig.userAgent,
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.streamingData?.hlsManifestUrl || null;
}

async function getLiveStream(url) {
  let videoId = null;

  // 1. Resolve the live video ID from the channel/@handle URL
  if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1].split('&')[0];
  } else {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const text = await response.text();
    const match = text.match(/"videoId":"([^"]+)"(?:.*?"isLive":true)/) || text.match(/"videoId":"([^"]+)"/);
    if (match) videoId = match[1];
  }

  if (!videoId) {
    throw Error(`Could not find a live video ID for: ${url}`);
  }

  // 2. Define working clients (MWEB and ANDROID are currently verified)
  const clients = [
    { // MWEB (iPad Safari) - Bypasses embed restrictions, no PO token needed
      name: 'MWEB',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      context: {
        clientName: 'MWEB',
        clientVersion: '2.20240724.01.00',
        hl: 'en',
        gl: 'US',
      }
    },
    { // ANDROID - Specific version verified by streamlink to return HLS
      name: 'ANDROID',
      userAgent: 'com.google.android.youtube/19.45.36 (Linux; U; Android 11) gzip',
      context: {
        clientName: 'ANDROID',
        clientVersion: '19.45.36',
        androidSdkVersion: 30,
        osName: 'Android',
        osVersion: '11',
        hl: 'en',
        gl: 'US',
      }
    },
    { // ANDROID_VR - CDN-exempt from certain token requirements
      name: 'ANDROID_VR',
      userAgent: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12; GLOBAL) gzip',
      context: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.62.27',
        androidSdkVersion: 32,
        osName: 'Android',
        osVersion: '12',
        hl: 'en',
        gl: 'US',
      }
    }
  ];

  // 3. Try each client until one returns an HLS URL
  for (const client of clients) {
    try {
      const streamUrl = await fetchStreamWithClient(videoId, client);
      if (streamUrl) {
        return streamUrl;
      }
    } catch (e) {
      // Continue to next client silently
    }
  }

  throw Error(`All client fallbacks failed to return an HLS stream for video ID: ${videoId}`);
}

async function handleRequest(request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith('/@')) {
    const channel = pathname.split('@')[1]?.split('.')[0];
    if (!channel) throw Error(`Channel handle not found: ${pathname}`);
    const stream = await getLiveStream(`https://www.youtube.com/@${channel}/live`);
    return Response.redirect(stream, 302);
  } else if (pathname.startsWith('/channel/')) {
    const channel = pathname.split('/')[2]?.split('.')[0];
    if (!channel) throw Error(`Channel ID not found: ${pathname}`);
    const stream = await getLiveStream(`https://www.youtube.com/channel/${channel}/live`);
    return Response.redirect(stream, 302);
  } else if (pathname.startsWith('/video/')) {
    const video = pathname.split('/')[2]?.split('.')[0];
    if (!video) throw Error(`Video ID not found: ${pathname}`);
    const stream = await getLiveStream(`https://www.youtube.com/watch?v=${video}`);
    return Response.redirect(stream, 302);
  } else {
    throw Error(`Path not found: ${pathname}`);
  }
}
