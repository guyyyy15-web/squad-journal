// PUBG API client. /players is rate-limited (10/min on a dev key); /matches and telemetry are not.

export class PubgError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function pubg(env) {
  const base = `${env.PUBG_BASE || 'https://api.pubg.com'}/shards/${env.PUBG_SHARD || 'steam'}`;
  async function get(path, auth = true) {
    const headers = { Accept: 'application/vnd.api+json', 'Accept-Encoding': 'gzip' };
    if (auth) headers.Authorization = `Bearer ${env.PUBG_API_KEY}`;
    const res = await fetch(base + path, { headers });
    if (auth) {
      const rem = res.headers.get('X-RateLimit-Remaining');
      const reset = res.headers.get('X-RateLimit-Reset'); // unix seconds
      if (rem !== null) rate.remaining = Number(rem);
      if (reset) rate.resetAt = Number(reset) * 1000;
    }
    if (res.status === 404) return null;
    if (res.status === 429) throw new PubgError(429, 'rate limited');
    if (res.status === 401) throw new PubgError(401, 'bad PUBG API key');
    if (!res.ok) throw new PubgError(res.status, `PUBG ${res.status}`);
    return res;
  }
  const rate = { remaining: null, resetAt: 0 };
  const qs = (list) => list.map(encodeURIComponent).join(',');
  return {
    rate,
    /** Up to 10 names (case-sensitive). null when none found. */
    async playersByNames(names) {
      const res = await get(`/players?filter[playerNames]=${qs(names)}`);
      return res ? res.json() : null;
    },
    /** Up to 10 account ids. */
    async playersByIds(ids) {
      const res = await get(`/players?filter[playerIds]=${qs(ids)}`);
      return res ? res.json() : null;
    },
    /** Raw match JSON text (we archive it as-is). null when PUBG doesn't have it. */
    async matchText(id) {
      const res = await get(`/matches/${encodeURIComponent(id)}`, false);
      return res ? res.text() : null;
    },
  };
}
