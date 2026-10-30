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

  // 1. Resolve the live video ID
  if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1].split('&')[0];
  } else {
    // For channel/@handle URLs, fetch the page to find the current live video ID
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const text = await response.text();
    // Look for videoId associated with isLive:true, or fall back to the first videoId
    const match = text.match(/"videoId":"([^"]+)"(?:.*?"isLive":true)/) || text.match(/"videoId":"([^"]+)"/);
    if (match) videoId = match[1];
  }

  if (!videoId) {
    throw Error(`Could not find a live video ID for: ${url}`);
  }

  // 2. Define fallback clients (order matters: most reliable first)
  const clients = [
    { // TV Embedded Client (often returns HLS without PO Token)
      name: 'TV_EMBEDDED',
      userAgent: 'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      context: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US',
      }
    },
    { // Web Embedded Player
      name: 'WEB_EMBEDDED_PLAYER',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      context: {
        clientName: 'WEB_EMBEDDED_PLAYER',
        clientVersion: '1.20240101.00.00',
        hl: 'en',
        gl: 'US',
      }
    },
    { // Android Client
      name: 'ANDROID',
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      context: {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        androidSdkVersion: 30,
        osName: 'Android',
        osVersion: '11',
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
      // Silently continue to the next client
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
