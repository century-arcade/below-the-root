import assert from 'node:assert/strict';
import { createHandler } from '../functions/github.mjs';
const origin = 'https://below-the-root.netlify.app';
const base = origin + '/.netlify/functions/github';
const env = { GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-secret', GITHUB_SESSION_SECRET: 'a'.repeat(32) };
let calls = [];
let scope = 'public_repo,gist';
let gistStatus = 201;
let issueStatus = 201;
let deleteStatus = 204;
let issueThrows = false;
let deleteThrows = false;
const gist = { id: '456', html_url: 'https://gist.github.com/tester/456',
  files: { 'btr-playthrough-5.json': { raw_url: 'https://gist.githubusercontent.com/tester/456/raw/btr-playthrough-5.json' } } };
const issue = { html_url: 'https://github.com/century-arcade/below-the-root/issues/123', number: 123 };
const remote = async (url, options) => {
  calls.push({ url, options });
  if (url.endsWith('/access_token')) return Response.json({ access_token: 'private-test-token', scope });
  if (url.endsWith('/user')) return Response.json({ login: 'tester' });
  assert.equal(options.headers.Authorization, 'Bearer private-test-token');
  if (url.endsWith('/gists') && options.method === 'POST') return Response.json(gist, { status: gistStatus });
  if (url.endsWith('/gists/456') && options.method === 'DELETE') {
    if (deleteThrows) throw new Error('Cleanup network failure');
    return new Response(null, { status: deleteStatus });
  }
  assert.equal(url, 'https://api.github.com/repos/century-arcade/below-the-root/issues');
  assert.equal(options.method, 'POST');
  if (issueThrows) throw new Error('Issue network failure');
  return Response.json(issue, { status: issueStatus });
};
const handler = createHandler(env, remote);
const req = (op, headers = {}, body) => new Request(base + '?op=' + op, { method: body ? 'POST' : 'GET', headers, body });
assert.equal((await (await createHandler({})(req('session'))).json()).configured, false);
const login = await handler(req('login'));
assert.equal(login.status, 302);
const auth = new URL(login.headers.get('Location'));
assert.equal(auth.origin, 'https://github.com');
assert.equal(auth.searchParams.get('scope'), 'public_repo gist');
assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
const flowCookie = login.headers.getSetCookie()[0].split(';')[0];
assert.match(login.headers.getSetCookie()[0], /Secure; HttpOnly; SameSite=Lax/);
const bad = await handler(req('callback&state=bad&code=test', { Cookie: flowCookie }));
assert.match(bad.headers.get('Location'), /failed/); assert.equal(calls.length, 0);
async function sessionCookie() {
  const callback = await handler(req('callback&code=test&state=' + auth.searchParams.get('state'), { Cookie: flowCookie }));
  assert.equal(callback.headers.get('Location'), '/?debug');
  const value = callback.headers.getSetCookie().find(x => x.startsWith('__Host-btr-github=')).split(';')[0];
  assert.ok(!value.includes('private-test-token'));
  return value;
}
const cookie = await sessionCookie();
const info = await handler(req('session', { Cookie: cookie }));
assert.deepEqual(await info.json(), { configured: true, login: 'tester' });
const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' };
const recording = JSON.stringify({ frames: 5, checkpoint: { room: 'P2' }, inputs: [[0, 1, 0, false]] });
const report = { message: 'Door failed\nI tapped it.', context: '{"room":"P2"}', recording, meta: { frame: 5, room: 'P2' } };
const body = JSON.stringify(report);
const post = (changes = {}) => handler(req('issue', headers, JSON.stringify({ ...report, ...changes })));
assert.equal((await handler(req('issue', { ...headers, Origin: 'https://other.example' }, body))).status, 403);
assert.equal((await handler(req('issue', { Origin: origin, 'Content-Type': 'application/json' }, body))).status, 401);
for (const changes of [{ message: '' }, { message: 'a'.repeat(8001) }, { context: 'a'.repeat(40001) },
  { recording: undefined }, { recording: null }, { recording: {} }, { recording: 5 }]) {
  const before = calls.length;
  assert.equal((await post(changes)).status, 400);
  assert.equal(calls.length, before, 'invalid reports must not upload');
}
calls = [];
const result = await post();
assert.equal(result.status, 200);
assert.deepEqual(await result.json(), { url: issue.html_url, number: 123, gist: gist.html_url });
assert.equal(calls.length, 2);
assert.equal(calls[0].url, 'https://api.github.com/gists');
assert.deepEqual(JSON.parse(calls[0].options.body), {
  public: false, description: 'below-the-root playthrough, frame 5, room P2',
  files: { 'btr-playthrough-5.json': { content: recording } },
});
const stateBlock = '<details><summary>State at filing</summary>\n\n```json\n' + report.context + '\n```\n</details>';
assert.deepEqual(JSON.parse(calls[1].options.body), { title: 'Door failed',
  body: `${report.message}\n\nPlaythrough: ${gist.html_url} (raw: ${gist.files['btr-playthrough-5.json'].raw_url}; load it with Load recording under ?debug)\n\n${stateBlock}` });
// Recordings also provide metadata when a client omits the optional meta object.
calls = [];
assert.equal((await post({ meta: undefined })).status, 200);
assert.equal(JSON.parse(calls[0].options.body).description, 'below-the-root playthrough, frame 5, room P2');
// The recording cap counts UTF-8 bytes, independently of JSON escaping overhead.
const maxBytes = 4 * 1024 * 1024;
const largeRecording = JSON.stringify({ frames: 5, checkpoint: { room: 'P2' }, padding: '' });
const atLimit = largeRecording.replace('"padding":""', '"padding":"' + 'é'.repeat(Math.floor((maxBytes - Buffer.byteLength(largeRecording)) / 2)) + '"');
const exactLimit = atLimit + ' '.repeat(maxBytes - Buffer.byteLength(atLimit));
assert.equal(Buffer.byteLength(exactLimit), maxBytes);
calls = [];
assert.equal((await post({ recording: exactLimit })).status, 200);
assert.equal(JSON.parse(calls[0].options.body).files['btr-playthrough-5.json'].content, exactLimit);
for (const oversized of [exactLimit + 'é', 'a'.repeat(6_000_000)]) {
  const before = calls.length;
  const response = await post({ recording: oversized });
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /Download the recording and attach it by hand/);
  assert.equal(calls.length, before);
}
gistStatus = 403;
calls = [];
const fallback = await post();
assert.equal(fallback.status, 200);
assert.equal((await fallback.json()).gist, null);
assert.equal(calls.length, 2);
assert.equal(JSON.parse(calls[1].options.body).body,
  `${report.message}\n\nPlaythrough upload failed (HTTP 403); the reporter can attach the download by hand.\n\n${stateBlock}`);
gistStatus = 201;
for (const status of [403, 401]) {
  issueStatus = status;
  for (const cleanup of ['ok', 'http failure', 'network failure']) {
    deleteStatus = cleanup === 'http failure' ? 500 : 204;
    deleteThrows = cleanup === 'network failure';
    calls = [];
    const failure = await post();
    assert.equal(failure.status, status === 401 ? 401 : 502);
    assert.match((await failure.json()).error, status === 401 ? /Log in again/ : /message has been kept/);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].url, 'https://api.github.com/gists/456');
    assert.equal(calls[2].options.method, 'DELETE');
  }
}
issueThrows = true;
deleteThrows = false;
calls = [];
assert.equal((await post()).status, 502);
assert.equal(calls.at(-1).options.method, 'DELETE');
issueThrows = false;
gistStatus = 403;
calls = [];
assert.equal((await post()).status, 401);
assert.equal(calls.length, 2, 'failed uploads must not be deleted');
issueStatus = 201;
gistStatus = 201;
for (const granted of ['public_repo', undefined, 'public_repo notgist', 'public_repo gist']) {
  scope = granted;
  const value = await sessionCookie();
  const session = await handler(req('session', { Cookie: value }));
  const allowed = granted === 'public_repo gist';
  assert.equal((await session.json()).login, allowed ? 'tester' : null);
  const before = calls.length;
  assert.equal((await handler(req('issue', { ...headers, Cookie: value }, body))).status, allowed ? 200 : 401);
  if (!allowed) assert.equal(calls.length, before);
}
const logout = await handler(req('logout', headers, '{}'));
assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
console.log('github_test: OAuth scopes/PKCE, encrypted cookie, CSRF, gist upload, report limits, issue creation, fallback and cleanup passed (mock GitHub)');
