/**
 * Mock build webhook receiver for local testing.
 *
 * Usage:
 * 1. Start OriCMS locally.
 * 2. Configure a build webhook URL such as http://localhost:3005/build.
 * 3. Run: node examples/build-webhook-receiver.mjs
 * 4. Trigger a build from the UI.
 */

import http from 'node:http';

const PORT = 3005;

const server = http.createServer((req, res) => {
  console.log(`\n[Mock Builder] Received ${req.method} request to ${req.url}`);

  if (req.url === '/build' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('[Mock Builder] Build payload:', body);
      console.log('[Mock Builder] Starting build simulation (5 seconds)...');

      setTimeout(() => {
        console.log('[Mock Builder] Build complete');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Build completed successfully' }));
      }, 5000);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[Mock Builder] listening on http://localhost:${PORT}`);
  console.log(`[Mock Builder] Configure your OriCMS build webhook to: http://localhost:${PORT}/build`);
});
