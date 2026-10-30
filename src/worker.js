/* global addEventListener, Response */
addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (err) => new Response(err.message, { status: 500 })
    )
  )
})

async function getLiveStream(url) {
  // 1. Extract the Video ID or Channel Handle from the URL
  let videoId = null;
  let channelHandle = null;

  if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1].split('&')[0];
  } else if (url.includes('/channel/')) {
    // For channel IDs, we first need to fetch the channel page to find the live video ID
    // This is a simplified approach; for handles (@abcnews), we use the live URL directly
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await response.text();
    const match = text.match(/"videoId":"([^"]+)"(?:.*?"isLive":true)/);
    if (match) videoId = match[1];
  } else if (url.includes('/@')) {
    channelHandle = url.split('/@')[1].split('/')[0];
    // Fetch the handle's live page to find the video ID
    const liveUrl = `https://www.youtube.com/@${channelHandle}/live`;
    const response = await fetch(liveUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await response.text();
    // Look for the live video ID in the page source
    const match = text.match(/"videoId":"([^"]+)"(?:.*?"isLive":true)/);
    if (match) {
      videoId = match[1];
    } else {
      // Fallback: try to find any video ID if the specific live regex fails
       const fallbackMatch = text.match(/"videoId":"([^"]+)"/);
       if (fallbackMatch) videoId = fallbackMatch[1];
    }
  }

  if (!videoId) {
    throw Error(`Could not find a live video ID for the requested URL: ${url}`);
  }

  // 2. Use the InnerTube API with the iOS client to get the HLS manifest
  const apiUrl = 'https://www.youtube.com/youtubei/v1/player';
  const payload = {
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '20.10.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.3.2.22D82',
        hl: 'en',
        gl: 'US'
      }
    },
    videoId: videoId,
    contentCheckOk: true,
    racyCheckOk: true
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/'
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    const data = await response.json();
    const hlsUrl = data.streamingData?.hlsManifestUrl;
    if (hlsUrl) {
      return hlsUrl;
    }
    throw Error(`InnerTube API did not return an hlsManifestUrl. The stream might not be live or available via this client.`);
  } else {
    throw Error(`InnerTube API request failed with status: ${response.status}`);
  }
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
