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
      // These headers are mandatory for the InnerTube API to work
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
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const text = await response.text();
    const match = text.match(/"videoId":"([^"]+)"(?:.*?"isLive":true)/) || text.match(/"videoId":"([^"]+)"/);
    if (match) videoId = match[1];
  }

  if (!videoId) {
    throw Error(`Could not find a live video ID for: ${url}`);
  }

  // 2. Define the verified client rotation (IOS -> TV_EMBEDDED -> ANDROID_VR)
  const clients = [
    { // IOS Client
      name: 'IOS',
      userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
      context: {
        clientName: 'IOS',
        clientVersion: '20.10.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.3.2.22D82',
        hl: 'en', gl: 'US',
      }
    },
    { // TV_EMBEDDED Client
      name: 'TV_EMBEDDED',
      userAgent: 'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      context: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en', gl: 'US',
      }
    },
    { // ANDROID_VR Client
      name: 'ANDROID_VR',
      userAgent: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12; GLOBAL) gzip',
      context: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.62.27',
        androidSdkVersion: 32,
        osName: 'Android',
        osVersion: '12',
        hl: 'en', gl: 'US',
      }
    }
  ];

  // 3. Try each client
  for (const client of clients) {
    try {
      const streamUrl = await fetchStreamWithClient(videoId, client);
      if (streamUrl) {
        return streamUrl;
      }
    } catch (e) {
      // Continue silently to the next client
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
  } else {
    throw Error(`Path not found: ${pathname}`);
  }
}
