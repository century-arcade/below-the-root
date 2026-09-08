// OAuth credentials and GitHub tokens never enter the browser's JavaScript or localStorage.
import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const REPO = 'century-arcade/below-the-root';
const COOKIE = '__Host-btr-github';
const FLOW = '__Host-btr-oauth';
const SESSION_SECONDS = 8 * 60 * 60;
const json = (body, status = 200, headers = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', ...headers },
});
const cookie = (name, value, seconds) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
const redirect = (url, cookies = []) => {
  const headers = new Headers({ Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 302, headers });
};

function seal(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url');
}
function unseal(req, name, secret) {
  try {
    const value = (req.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
    const bytes = Buffer.from(value.slice(name.length + 1), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    return data.expires > Date.now() ? data : null;
  } catch { return null; }
}
const equals = (a, b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createHandler(env = process.env, request = fetch) {
  const failed = () => redirect('/?debug&github=failed', [cookie(FLOW, '', 0)]);
  return async req => {
    const url = new URL(req.url);
    const op = url.searchParams.get('op') || 'session';
    const { GITHUB_CLIENT_ID: client, GITHUB_CLIENT_SECRET: clientSecret, GITHUB_SESSION_SECRET: secret } = env;
    const configured = !!(client && clientSecret && secret?.length >= 32);
    if (!configured) return json({ configured: false, error: 'GitHub login needs the site’s OAuth configuration.' }, op === 'session' ? 200 : 503);
    const callback = `${url.origin}/.netlify/functions/github?op=callback`;
    const session = unseal(req, COOKIE, secret);
    const github = (path, options = {}, token = session?.token) => request(`https://api.github.com${path}`, {
      ...options, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'below-the-root', 'Content-Type': 'application/json' },
    });
    try {
      if (op === 'session' && req.method === 'GET') return json({ configured: true, login: session?.login || null });
      if (op === 'login' && req.method === 'GET') {
        const state = randomBytes(32).toString('base64url');
        const verifier = randomBytes(32).toString('base64url');
        const auth = new URL('https://github.com/login/oauth/authorize');
        auth.search = new URLSearchParams({ client_id: client, redirect_uri: callback, scope: 'public_repo', state,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        return redirect(auth, [cookie(FLOW, seal({ state, verifier, expires: Date.now() + 600000 }, secret), 600)]);
      }
      if (op === 'callback' && req.method === 'GET') {
        const flow = unseal(req, FLOW, secret);
        if (!flow || !equals(flow.state, url.searchParams.get('state')) || !url.searchParams.get('code')) {
          return failed();
        }
        const tokenResponse = await request('https://github.com/login/oauth/access_token', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: client, client_secret: clientSecret, code: url.searchParams.get('code'),
            redirect_uri: callback, code_verifier: flow.verifier }),
        });
        const token = await tokenResponse.json();
        if (!tokenResponse.ok || !token.access_token) return failed();
        const userResponse = await github('/user', {}, token.access_token);
        const user = await userResponse.json();
        if (!userResponse.ok || !user.login) return failed();
        return redirect('/?debug', [cookie(FLOW, '', 0), cookie(COOKIE, seal({ token: token.access_token,
          login: user.login, expires: Date.now() + SESSION_SECONDS * 1000 }, secret), SESSION_SECONDS)]);
      }
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (req.headers.get('Origin') !== url.origin || req.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
        return json({ error: 'Invalid request origin or content type' }, 403);
      }
      if (op === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': cookie(COOKIE, '', 0) });
      if (op !== 'issue') return json({ error: 'Unknown operation' }, 404);
      if (!session) return json({ error: 'Log in to GitHub to file this issue.' }, 401);
      const text = await req.text();
      if (text.length > 60000) return json({ error: 'Issue report is too large. Download the full recording separately.' }, 413);
      const body = JSON.parse(text);
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 8000
          || typeof body.context !== 'string' || body.context.length > 40000) return json({ error: 'Enter a message of at most 8,000 characters.' }, 400);
      const message = body.message.trim();
      const result = await github(`/repos/${REPO}/issues`, { method: 'POST', body: JSON.stringify({
        title: message.split('\n')[0].slice(0, 120), body: `${message}\n\n${body.context}`,
      }) });
      if (!result.ok) return json({ error: result.status === 401 ? 'GitHub login expired. Log in again.'
        : 'GitHub could not create the issue. Your message has been kept; try again.' }, result.status === 401 ? 401 : 502);
      const issue = await result.json();
      return json({ url: issue.html_url, number: issue.number });
    } catch {
      return json({ error: 'The GitHub request failed. Your message has been kept; try again.' }, 502);
    }
  };
}

export default createHandler();
