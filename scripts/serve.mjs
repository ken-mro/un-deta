// 依存なしの静的配信サーバ（開発・E2E 用）。既定では 127.0.0.1 のみで待ち受ける。
// 使い方: node scripts/serve.mjs [--port 4173] [--root .] [--base /un-deta/] [--host ::]
//   --host :: … スマホなど他の端末から確認するときだけ明示的に指定する（LAN / Tailscale に公開される）
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const DEFAULT_HOST = '127.0.0.1';

/** URL パスをルート配下の実ファイルパスに解決する。ルート外・不正なら null / 'bad' */
async function resolvePath(rootReal, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return 'bad';
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return 'bad';
  // .git / .env などドットで始まるパス要素は配信しない
  if (decoded.split('/').some((seg) => seg.startsWith('.'))) return null;
  if (decoded.endsWith('/')) decoded += 'index.html';
  const candidate = resolve(rootReal, '.' + decoded);
  if (candidate !== rootReal && !candidate.startsWith(rootReal + sep)) return null;
  let real;
  try {
    real = await realpath(candidate); // シンボリックリンク経由の脱出も防ぐ
  } catch {
    return null;
  }
  if (!real.startsWith(rootReal + sep)) return null;
  const info = await stat(real);
  return info.isFile() ? real : null;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

export async function startServer({ root = process.cwd(), port = 4173, base = '/', host = DEFAULT_HOST } = {}) {
  if (typeof base !== 'string' || !base.startsWith('/') || !base.endsWith('/')) {
    throw new TypeError('base は "/" で始まり "/" で終わるパスにしてください（例: /un-deta/）');
  }
  const rootReal = await realpath(resolve(root));
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return send(res, 405, 'Method Not Allowed');
      }
      const fullPath = (req.url ?? '/').split('?')[0].split('#')[0];
      // GitHub Pages と同様、末尾スラッシュなしのサブパスはリダイレクト
      if (base !== '/' && fullPath === base.slice(0, -1)) {
        res.writeHead(301, { Location: base });
        return res.end();
      }
      if (!fullPath.startsWith(base)) return send(res, 404, 'Not Found');
      const urlPath = '/' + fullPath.slice(base.length);
      const file = await resolvePath(rootReal, urlPath);
      if (file === 'bad') return send(res, 400, 'Bad Request');
      if (!file) return send(res, 404, 'Not Found');
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch {
      if (!res.headersSent) send(res, 500, 'Internal Server Error');
      else res.destroy();
    }
  });
  await new Promise((ok, ng) => {
    server.once('error', ng);
    server.listen(port, host, ok);
  });
  return server;
}

// CLI として起動された場合
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, def) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : def;
  };
  const port = Number(arg('--port', process.env.PORT ?? 4173));
  const root = arg('--root', join(fileURLToPath(new URL('..', import.meta.url))));
  const base = arg('--base', '/');
  const host = arg('--host', DEFAULT_HOST);
  const server = await startServer({ root, port, base, host });
  const shown = host === DEFAULT_HOST ? DEFAULT_HOST : `${host}（全インターフェース）`;
  console.log(`serving ${root} on ${shown} port ${server.address().port}${base}`);
}
