/**
 * PANTAU SE — Lightweight Zero-Dependency Node.js Server
 * Jalankan dengan:
 *   node server.js
 * Atau custom port:
 *   PORT=8080 node server.js
 *
 * Fitur:
 * - Serving file statis PWA (index.html, manifest.json, sw.js, icons/, js/)
 * - Header Service-Worker-Allowed & Cache-Control optimal untuk PWA
 * - Proteksi path traversal & pemblokiran akses HTTP ke file sensitif (server.js, code.gs, *.sql, .env)
 * - Endpoint health check: GET /api/health
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf'
};

// File backend/konfigurasi yang tidak boleh diakses langsung lewat HTTP browser
const BLOCKED_BASENAMES = new Set([
  'server.js',
  'code.gs',
  'supabase_schema.sql',
  '.env',
  '.env.local',
  '.gitignore'
]);

const BLOCKED_EXTENSIONS = new Set(['.sql', '.gs', '.env', '.bak']);

function getContentType(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'manifest.json') {
    return 'application/manifest+json; charset=utf-8';
  }
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function getCacheHeader(filePath) {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (base === 'sw.js') {
    return 'no-cache, no-store, must-revalidate';
  }
  if (ext === '.html' || ext === '.js' || base === 'manifest.json') {
    return 'no-cache';
  }
  return 'public, max-age=86400';
}

function isBlockedPath(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg.startsWith('.')) return true;
  }
  const base = path.basename(normalized).toLowerCase();
  if (BLOCKED_BASENAMES.has(base)) return true;
  const ext = path.extname(base).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  return false;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(message);
}

const server = http.createServer((req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch (err) {
    sendError(res, 400, 'Bad Request');
    return;
  }

  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Health check endpoint
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      app: 'PANTAU SE — Support Equipment Hub',
      status: 'running',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    sendError(res, 405, 'Method Not Allowed');
    return;
  }

  // Resolve static file path safely inside ROOT_DIR
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  if (relativePath.endsWith('/')) {
    relativePath += 'index.html';
  }

  if (isBlockedPath(relativePath)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  const resolvedPath = path.resolve(ROOT_DIR, '.' + relativePath);
  if (!resolvedPath.startsWith(ROOT_DIR + path.sep) && resolvedPath !== ROOT_DIR) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendError(res, 404, 'Not Found');
      return;
    }

    const headers = {
      'Content-Type': getContentType(resolvedPath),
      'Content-Length': stats.size,
      'Cache-Control': getCacheHeader(resolvedPath),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    if (path.basename(resolvedPath).toLowerCase() === 'sw.js') {
      headers['Service-Worker-Allowed'] = '/';
    }

    res.writeHead(200, headers);
    if (method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(resolvedPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        sendError(res, 500, 'Internal Server Error');
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  });
});

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

server.listen(PORT, HOST, () => {
  const lanIps = getLanAddresses();
  console.log('');
  console.log('======================================================');
  console.log('  PANTAU SE — Support Equipment Hub Server Aktif');
  console.log('======================================================');
  console.log(`  Local   : http://localhost:${PORT}`);
  lanIps.forEach((ip) => {
    console.log(`  Network : http://${ip}:${PORT}`);
  });
  console.log(`  Health  : http://localhost:${PORT}/api/health`);
  console.log('======================================================');
  console.log('  Tekan Ctrl+C untuk menghentikan server.');
  console.log('');
});

function shutdown(signal) {
  console.log(`\nMenerima sinyal ${signal}. Menutup server PANTAU SE...`);
  server.close(() => {
    console.log('Server ditutup dengan aman.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
