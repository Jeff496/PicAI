#!/usr/bin/env node
/**
 * Local server for the labeling tools.
 * Serves HTML files and proxies /api/* requests to the PicAI backend,
 * avoiding CORS issues when opening labelers in the browser.
 *
 * Usage: node eval/tools/serve.mjs [--port 8080] [--backend http://localhost:3001]
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const args = process.argv.slice(2);
const port = parseInt(args[args.indexOf('--port') + 1]) || 8080;
const backend = args[args.indexOf('--backend') + 1] || 'http://localhost:3001';

const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.jsonl': 'application/jsonl',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

const server = createServer(async (req, res) => {
  // Proxy /api/* to backend
  if (req.url.startsWith('/api/')) {
    try {
      const target = `${backend}${req.url}`;
      const proxyRes = await fetch(target, {
        method: req.method,
        headers: {
          ...Object.fromEntries(
            Object.entries(req.headers).filter(([k]) => !['host', 'origin', 'referer'].includes(k))
          ),
        },
      });

      res.writeHead(proxyRes.status, {
        'Content-Type': proxyRes.headers.get('content-type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      const buffer = Buffer.from(await proxyRes.arrayBuffer());
      res.end(buffer);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Proxy error: ${err.message}`);
    }
    return;
  }

  // Serve static files from eval/ (tools/ and datasets/)
  const evalRoot = join(__dirname, '..');
  let filePath = req.url === '/' ? '/tools/tagging-labeler.html' : req.url;
  const fullPath = join(evalRoot, filePath);

  try {
    const content = await readFile(fullPath);
    const ext = extname(fullPath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Labeling server running at http://localhost:${port}`);
  console.log(`Proxying /api/* to ${backend}`);
  console.log('');
  console.log(`  Tagging labeler:   http://localhost:${port}/tools/tagging-labeler.html`);
  console.log(`  RAG query labeler: http://localhost:${port}/tools/rag-query-labeler.html`);
});
