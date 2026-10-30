/* global addEventListener, Response */
addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (err) => new Response(err.message, { status: 500 })
    )
  )
})

// A helper function to try fetching the stream with a specific InnerTube client
async function fetchStreamWithClient(videoId, clientConfig) {
  const apiUrl = 'https://www.youtube.com/youtubei/v1/player';
  const payload = {
    context: {
      client: clientConfig.context
    },
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

  if (response.ok) {
    const data = await response.json();
    return data.streamingData?.hlsManifestUrl || null;
  }
  return null; // Return null if the request fails or no stream is found
}

async function getLiveStream(url) {
  let videoId = null;

  // 1. Extract the Video ID from the URL
  if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1].split('&')[0];
  } else {
    // For channel URLs, we must first find the current live video ID
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await response.text();
    // A more resilient regex to find the live video ID
    const match = text.match(/"videoId":"([^"]+)"(?:.*?"isLive":true)/);
    if (match) {
      videoId = match[1];
    } else {
      // A fallback regex for cases where the first pattern fails
      const fallbackMatch = text.match(/"videoId":"([^"]+)"/);
      if (fallbackMatch) videoId = fallbackMatch[1];
    }
  }

  if (!videoId) {
    throw Error(`Could not find a live video ID for the requested URL: ${url}`);
  }

  // 2. Define the clients to try, in order of preference
  const clients = [
    { // iOS Client (Often the most reliable for HLS)
      name: 'iOS',
      userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
      context: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en', gl: 'US' }
    },
    { // Android Client (A strong secondary fallback)
      name: 'Android',
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      context: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, osName: 'Android', osVersion: '11', hl: 'en', gl: 'US' }
    }
  ];

  // 3. Iterate through the clients and try to get a stream URL
  for (const client of clients) {
    try {
      const streamUrl = await fetchStreamWithClient(videoId, client);
      if (streamUrl) {
        return streamUrl; // Return the first successful URL
      }
    } catch (e) {
      // Log the error internally but continue to the next client
      console.error(`Client ${client.name} failed: ${e.message}`);
    }
  }

  // If all clients fail
  throw Error(`All extraction methods failed to find an HLS stream for video ID: ${videoId}`);
}

async function handleRequest(request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith('/@')) {
    const channel = pathname.split('@')[1]?.split('.')[0];
    if (channel) {
      const url = `https://www.youtube.com/@${channel}/live`;
      const stream = await getLiveStream(url);
      return Response.redirect(stream, 302);
    } else {
      throw Error(`Channel handle not found: ${pathname}`);
    }
  } else if (pathname.startsWith('/channel/')) {
    const channel = pathname.split('/')[2]?.split('.')[0];
    if (channel) {
      const url = `https://www.youtube.com/channel/${channel}/live`;
      const stream = await getLiveStream(url);
      return Response.redirect(stream, 302);
    } else {
      throw Error(`Channel ID not found: ${pathname}`);
    }
  } else if (pathname.startsWith('/video/')) {
    const video = pathname.split('/')[2]?.split('.')[0];
    if (video) {
      const url = `https://www.youtube.com/watch?v=${video}`;
      const stream = await getLiveStream(url);
      return Response.redirect(stream, 302);
    } else {
      throw Error(`Video ID not found: ${pathname}`);
    }
  } else {
    throw Error(`Path not found: ${pathname}`);
  }
}
