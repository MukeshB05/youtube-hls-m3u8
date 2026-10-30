/* global addEventListener, Response */
addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (err) => new Response(err.message, { status: 500 })
    )
  )
})

async function getLiveStream(url) {
  // Use an iOS User-Agent, which is more reliable for extracting HLS manifests
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }

  let response = await fetch(url, { headers })
  if (!response.ok) {
    // Fallback to a standard request if the iOS request fails
    response = await fetch(url)
  }

  if (response.ok) {
    const text = await response.text()
    // More robust regex to catch variations in the HTML structure
    const stream = text.match(/"hlsManifestUrl":"([^"]+)"/) || text.match(/(?<=hlsManifestUrl":").*\.m3u8/g)
    
    if (stream) {
      // If the match returns an array, take the first element
      const finalUrl = Array.isArray(stream) ? stream[0] : stream[1]
      return finalUrl
    }
    // Throw a specific error if the URL is not found, preventing the 'null' crash
    throw Error(`YouTube stream extraction failed: hlsManifestUrl not found for ${url}`)
  } else {
    throw Error(`YouTube URL (${url}) failed with status: ${response.status}`)
  }
}

async function handleRequest(request) {
  const { pathname } = new URL(request.url)

  if (pathname.startsWith('/@')) {
    const channel = pathname.split('@')?.[1]?.split('.')?.[0]
    if (channel) {
      const url = `https://www.youtube.com/@${channel}/live`
      const stream = await getLiveStream(url)
      return Response.redirect(stream, 302)
    } else {
      throw Error(`Channel ID not found: ${pathname}`)
    }
  } else if (pathname.startsWith('/channel/')) {
    const channel = pathname.split('/')?.[2]?.split('.')?.[0]
    if (channel) {
      const url = `https://www.youtube.com/channel/${channel}/live`
      const stream = await getLiveStream(url)
      return Response.redirect(stream, 302)
    } else {
      throw Error(`Channel ID not found: ${pathname}`)
    }
  } else if (pathname.startsWith('/video/')) {
    const video = pathname.split('/')?.[2]?.split('.')?.[0]
    if (video) {
      const url = `https://www.youtube.com/watch?v=${video}`
      const stream = await getLiveStream(url)
      return Response.redirect(stream, 302)
    } else {
      throw Error(`Video ID not found: ${pathname}`)
    }
  } else {
    throw Error(`Path not found: ${pathname}`)
  }
}
