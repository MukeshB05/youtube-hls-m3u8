# Youtube HLS
It creates a permanent link for the live feed (HLS/m3u8) of a Youtube channel.
It picks up the most recent live feed when the channel has multiple live feeds.
Save the code in 'src/worker.js' to a Cloudflare Worker.

```bash
Using Channel '@' Name(example: @ABCNews)
# format of the link
https://hls.youtb.workers.dev/{youtube_@name}.m3u8
# example
https://hls.youtb.workers.dev/@ABCNews.m3u8

Using Channel ID(example: UCBi2mrWuNuyYy4gbM6fU18Q)
# format of the link
https://hls.youtb.workers.dev/channel/{youtube_channel_id}.m3u8
# example
https://hls.youtb.workers.dev/channel/UCBi2mrWuNuyYy4gbM6fU18Q.m3u8

Using Video ID(example: w_Ma8oQLmSM)
NOTE: This will only play LIVE streams using 'video id'. This is useful with channels having more than one live stream.
# format of the link
https://hls.youtb.workers.dev/video/{youtube_video_id}.m3u8
# example
https://hls.youtb.workers.dev/video/w_Ma8oQLmSM.m3u8
