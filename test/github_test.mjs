import { authenticatedGithubFixture, githubFixture } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/github.mjs';

test("OAuth uses PKCE and rejects callbacks with a mismatched state", async () => {
  const mock = await githubFixture();
  const { handler, req } = mock;
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
  assert.match(bad.headers.get('Location'), /failed/); assert.equal(mock.calls.length, 0);
});

test("an encrypted session cookie identifies the authenticated user", async () => {
  const mock = await authenticatedGithubFixture();
  const { handler, req, cookie } = mock;
  const info = await handler(req('session', { Cookie: cookie }));
  assert.deepEqual(await info.json(), { configured: true, login: 'tester' });
});

test("issue reports reject cross-origin, unauthenticated, and invalid requests", async () => {
  const mock = await authenticatedGithubFixture();
  const { origin, handler, req, headers, body, post } = mock;
  assert.equal((await handler(req('issue', { ...headers, Origin: 'https://other.example' }, body))).status, 403);
  assert.equal((await handler(req('issue', { Origin: origin, 'Content-Type': 'application/json' }, body))).status, 401);
  for (const changes of [{ message: '' }, { message: 'a'.repeat(8001) }, { context: 'a'.repeat(40001) },
    { recording: undefined }, { recording: null }, { recording: {} }, { recording: 5 }]) {
    const before = mock.calls.length;
    assert.equal((await post(changes)).status, 400);
    assert.equal(mock.calls.length, before, 'invalid reports must not upload');
  }
});

test("a report uploads a private gist and links it in the issue", async () => {
  const mock = await authenticatedGithubFixture();
  const { gist, issue, recording, report, post } = mock;
  mock.calls = [];
  const result = await post();
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { url: issue.html_url, number: 123, gist: gist.html_url });
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[0].url, 'https://api.github.com/gists');
  assert.deepEqual(JSON.parse(mock.calls[0].options.body), {
    public: false, description: 'below-the-root playthrough, tick 5, room P2',
    files: { 'btr-playthrough-5.json': { content: recording } },
  });
  const stateBlock = '<details><summary>State at filing</summary>\n\n```json\n' + report.context + '\n```\n</details>';
  assert.deepEqual(JSON.parse(mock.calls[1].options.body), { title: 'Door failed',
    body: `${report.message}\n\nPlaythrough: ${gist.html_url} (raw: ${gist.files['btr-playthrough-5.json'].raw_url}; load it with Load recording under ?debug)\n\n${stateBlock}` });
});

test("recordings supply metadata when the client omits it", async () => {
  const mock = await authenticatedGithubFixture();
  const { post } = mock;
  // Recordings also provide metadata when a client omits the optional meta object.
  mock.calls = [];
  assert.equal((await post({ meta: undefined })).status, 200);
  assert.equal(JSON.parse(mock.calls[0].options.body).description, 'below-the-root playthrough, tick 5, room P2');
});

test("recording size limits count UTF-8 bytes before upload", async () => {
  const mock = await authenticatedGithubFixture();
  const { post } = mock;
  // The recording cap counts UTF-8 bytes, independently of JSON escaping overhead.
  const maxBytes = 4 * 1024 * 1024;
  const largeRecording = JSON.stringify({ checkpoint: { room: 'P2', simticks: 5 }, padding: '' });
  const atLimit = largeRecording.replace('"padding":""', '"padding":"' + 'é'.repeat(Math.floor((maxBytes - Buffer.byteLength(largeRecording)) / 2)) + '"');
  const exactLimit = atLimit + ' '.repeat(maxBytes - Buffer.byteLength(atLimit));
  assert.equal(Buffer.byteLength(exactLimit), maxBytes);
  mock.calls = [];
  assert.equal((await post({ recording: exactLimit })).status, 200);
  assert.equal(JSON.parse(mock.calls[0].options.body).files['btr-playthrough-5.json'].content, exactLimit);
  for (const oversized of [exactLimit + 'é', 'a'.repeat(6_000_000)]) {
    const before = mock.calls.length;
    const response = await post({ recording: oversized });
    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /Download the recording and attach it by hand/);
    assert.equal(mock.calls.length, before);
  }
});

test("failed gist uploads preserve the report with an attachment fallback", async () => {
  const mock = await authenticatedGithubFixture();
  const { report, post } = mock;
  const stateBlock = '<details><summary>State at filing</summary>\n\n```json\n' + report.context + '\n```\n</details>';

  mock.gistStatus = 403;
  mock.calls = [];
  const fallback = await post();
  assert.equal(fallback.status, 200);
  assert.equal((await fallback.json()).gist, null);
  assert.equal(mock.calls.length, 2);
  assert.equal(JSON.parse(mock.calls[1].options.body).body,
    `${report.message}\n\nPlaythrough upload failed (HTTP 403); the reporter can attach the download by hand.\n\n${stateBlock}`);
});

test("failed issue creation cleans up uploaded gists and tolerates cleanup failure", async () => {
  const mock = await authenticatedGithubFixture();
  const { post } = mock;

  mock.gistStatus = 201;
  for (const status of [403, 401]) {
    mock.issueStatus = status;
    for (const cleanup of ['ok', 'http failure', 'network failure']) {
      mock.deleteStatus = cleanup === 'http failure' ? 500 : 204;
      mock.deleteThrows = cleanup === 'network failure';
      mock.calls = [];
      const failure = await post();
      assert.equal(failure.status, status === 401 ? 401 : 502);
      assert.match((await failure.json()).error, status === 401 ? /Log in again/ : /message has been kept/);
      assert.equal(mock.calls.length, 3);
      assert.equal(mock.calls[2].url, 'https://api.github.com/gists/456');
      assert.equal(mock.calls[2].options.method, 'DELETE');
    }
  }
  mock.issueThrows = true;
  mock.deleteThrows = false;
  mock.calls = [];
  assert.equal((await post()).status, 502);
  assert.equal(mock.calls.at(-1).options.method, 'DELETE');
  mock.issueThrows = false;
  mock.gistStatus = 403;
  mock.calls = [];
  assert.equal((await post()).status, 401);
  assert.equal(mock.calls.length, 2, 'failed uploads must not be deleted');
});

test("both repository and gist scopes are required and logout expires the cookie", async () => {
  const mock = await authenticatedGithubFixture();
  const { handler, req, headers, body, sessionCookie } = mock;

  mock.issueStatus = 201;
  mock.gistStatus = 201;
  for (const granted of ['public_repo', undefined, 'public_repo notgist', 'public_repo gist']) {
    mock.scope = granted;
    const value = await sessionCookie();
    const session = await handler(req('session', { Cookie: value }));
    const allowed = granted === 'public_repo gist';
    assert.equal((await session.json()).login, allowed ? 'tester' : null);
    const before = mock.calls.length;
    assert.equal((await handler(req('issue', { ...headers, Cookie: value }, body))).status, allowed ? 200 : 401);
    if (!allowed) assert.equal(mock.calls.length, before);
  }
  const logout = await handler(req('logout', headers, '{}'));
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
});
