# YouTube Live HLS Extractor & Proxy (Cloudflare Workers)

This project provides a permanent `.m3u8` link for YouTube live streams.

## Setup

1. Deploy the **Extractor Worker** (`src/worker.js`).
2. Deploy the **Proxy Worker** (`src/proxy.js`) to bypass `403` errors.

## Usage

**Final Playable Link:**
`https://your-proxy-worker.workers.dev/?url=https://your-extractor-worker.workers.dev/@channelname.m3u8`

Replace `@channelname` with the YouTube handle (e.g., `@abcnews`).
