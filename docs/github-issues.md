# Debug GitHub issue filing

Only `?debug` shows **Report Issue**, at the top right. Clicking
**Report Issue** or pressing `R` starts login when logged out, saving the
quest first. Once authenticated, either opens a single-message dialog immediately.
The dialog sits below the game and includes **Log out**. Submission creates an issue as
that user in `century-arcade/below-the-root`; its first message line
becomes the title. State and recent moves are included; the full recording
is a separate download, not automatically uploaded. Each recent input change
and room transition occupies one JSON line. The redundant C64-format save
image is omitted from issue reports.

The implementation uses a Netlify function, not credentials in the
static build. Its source is `functions/github.mjs`, configured through
`netlify.toml`; the HTTP endpoint remains `/.netlify/functions/github`.
No server package dependencies are required.

## One-time deployment setup

1. Register a GitHub OAuth App in the owning account/organization's
   developer settings. Set the homepage to
   `https://below-the-root.netlify.app` and the authorization callback to:

   `https://below-the-root.netlify.app/.netlify/functions/github?op=callback`

2. Set these environment variables in the Netlify site's settings,
   with **Functions** scope:

   - `GITHUB_CLIENT_ID`: the app's client ID.
   - `GITHUB_CLIENT_SECRET`: the app's client secret.
   - `GITHUB_SESSION_SECRET`: a separate random secret of at least 32
     characters, for encrypted session cookies. Generate it with a
     password manager or `openssl rand -hex 32`; store it directly in
     Netlify, never in the repository or browser.

3. Deploy the code with those variables available. The function directory
   is configured in `netlify.toml`. Visit `/?debug`, log in, and file one
   deliberately labelled smoke-test issue when ready to test real posting.
   No real issue is created by the automated tests.

The web flow uses OAuth state and PKCE; GitHub documents the parameters
and server-side code exchange in its [OAuth authorization guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
The OAuth scope is `public_repo` for this public repository. That scope is
broader than issue-only access; review it when authorizing. A GitHub App
with narrowly scoped repository permissions is a possible later change,
not the flow implemented here.

Netlify requires runtime environment variables to be configured for the
function; values in `netlify.toml` do not supply function secrets. See
[function environment variables](https://docs.netlify.com/build/functions/environment-variables/).

`make serve` runs Netlify Dev, serving both the game and the function at
`http://localhost:8000`. Authenticate/link the CLI with `netlify login`
and `netlify link` first. By default it uses `dev`/all-context variables;
`make serve CONTEXT=production` selects production-context values instead.
`make serve PORT=8888` changes the local port. Production variables marked
as secrets may not be available locally; set separate dev values rather
than assuming selecting the production context exposes them. See Netlify's
[local development guide](https://docs.netlify.com/api-and-cli-guides/cli-guides/local-development/).

For local OAuth, use a separate GitHub OAuth App with callback
`http://localhost:8000/.netlify/functions/github?op=callback` and set its
client ID/secret in the Netlify `dev` context. The production app's callback
does not authorize localhost just because its credentials are available
locally. Keep production credentials/callback unchanged. Other ports and
preview domains likewise need a matching app/callback configuration.

## Security and failure behavior

- Credentials stay server-side. Tokens are AES-GCM-encrypted inside
  Secure, HttpOnly, SameSite=Lax host-only cookies, never localStorage.
- The callback checks the short-lived state cookie and exchanges its
  code with the PKCE verifier. Session lifetime is eight hours; expired
  GitHub tokens require another login. No refresh token is retained.
- Issue POSTs require a same-origin JSON request and an authenticated
  session. The repository is fixed on the server, not supplied by users.
- Empty/oversized reports are rejected. GitHub errors keep the message
  available to retry. Draft text is held separately in sessionStorage.
- Log out clears the site cookie. GitHub account settings can revoke the
  OAuth authorization itself.
- No secrets or token responses are logged by the function. Automated
  tests use dummy credentials and mocked network calls.

The toolbar's background session lookup only reveals an existing login.
It does not gate login: a pending or failed lookup still allows
**Report Issue** and `R` to navigate to the server's login endpoint.
`test/browser_login_test.py` checks these cases, logged-out sessions, and
logging out with mocked navigation, and confirms the quest saves first.
