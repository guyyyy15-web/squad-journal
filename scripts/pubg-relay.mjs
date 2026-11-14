// Dev only: relays http://localhost:8790/<path> → https://api.pubg.com/<path> with curl,
// for cloud dev environments where the network proxy injects the PUBG key (wrangler dev's runtime bypasses it).
// Use: node scripts/pubg-relay.mjs & then PUBG_BASE=http://localhost:8790 in .dev.vars
import http from 'node:http';
import { execFile } from 'node:child_process';
http.createServer((req, res) => {
  const url = 'https://api.pubg.com' + req.url;
  execFile('curl', ['-sS', '-g', '--compressed', '-w', '\n%{http_code}', '-H', 'Accept: application/vnd.api+json',
    '-H', 'Authorization: Bearer proxy-injected', url], { maxBuffer: 64 << 20 }, (err, out) => {
    if (err) { res.writeHead(502); return res.end(String(err)); }
    const i = out.lastIndexOf('\n');
    res.writeHead(Number(out.slice(i + 1)), { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '9' });
    res.end(out.slice(0, i));
  });
}).listen(8790, () => console.log('pubg relay on :8790'));
