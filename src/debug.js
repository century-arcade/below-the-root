import { ENGINE_VERSION } from './record.js';
import { panelLines } from './panel.js';

const API = '/.netlify/functions/github';
const DRAFT_KEY = 'btr.issue-draft';

export function downloadRecord(session) {
  const blob = new Blob([JSON.stringify(session.snapshot())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `btr-playthrough-${session.frame}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function issueContext(session) {
  const record = session.snapshot();
  const s = session.state;
  const details = { engine: ENGINE_VERSION, frame: session.frame, room: s.room?.code,
    player: s.player, clock: s.clock, panel: panelLines(s), c64: record.c64,
    recentPath: record.path.slice(-30), recentInputs: record.inputs.slice(-50) };
  return 'Filed from the game’s debug screen. The full playthrough can be downloaded separately.\n\n'
    + '```json\n' + JSON.stringify(details, null, 2) + '\n```';
}

export async function setupDebug({ getSession, saveNow, pause, resume, importFile, note, fit }) {
  const bar = document.getElementById('debug');
  bar.hidden = false;
  document.getElementById('debug-status').hidden = false;
  document.getElementById('github-auth').hidden = false;
  const login = document.getElementById('github-login');
  const logout = document.getElementById('github-logout');
  const report = document.getElementById('file-issue');
  const dialog = document.getElementById('issue-dialog');
  const form = document.getElementById('issue-form');
  const message = document.getElementById('issue-message');
  const result = document.getElementById('issue-result');
  const submit = document.getElementById('issue-submit');
  let context = '';

  document.getElementById('download-record').onclick = () => downloadRecord(getSession());
  document.getElementById('load-record').onchange = async e => {
    const selected = e.target.files[0];
    if (selected) await importFile(selected);
    e.target.value = '';
  };
  login.onclick = () => {
    // The session lookup only personalizes the toolbar. A slow/blocked lookup
    // must not prevent navigating to the server's authoritative login endpoint.
    pause();
    if (!saveNow()) { resume(); return; }
    location.assign(`${API}?op=login`);
  };
  logout.onclick = async () => {
    try {
      const response = await fetch(`${API}?op=logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Could not log out. Try again.');
      login.hidden = false; logout.hidden = true; report.hidden = true;
    } catch (err) { note(err.message); }
  };
  report.onclick = () => {
    pause(); saveNow();
    context = issueContext(getSession());
    result.textContent = '';
    try { message.value = sessionStorage.getItem(DRAFT_KEY) || ''; } catch { /* Draft is still editable. */ }
    dialog.show();
    fit();
    message.focus();
  };
  message.oninput = () => { try { sessionStorage.setItem(DRAFT_KEY, message.value); } catch { /* Keep the text in the form. */ } };
  document.getElementById('issue-cancel').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { resume(); fit(); report.focus(); });
  form.onsubmit = async e => {
    e.preventDefault();
    submit.disabled = true;
    result.textContent = 'Filing issue…';
    try {
      const response = await fetch(`${API}?op=issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.value, context }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not file the issue.');
      if (!/^https:\/\/github\.com\/century-arcade\/below-the-root\/issues\/\d+$/.test(body.url)) throw new Error('Unexpected issue response');
      const link = document.createElement('a');
      link.href = body.url; link.target = '_blank'; link.rel = 'noopener';
      link.textContent = `Issue #${body.number} filed — open on GitHub`;
      result.replaceChildren(link);
      message.value = '';
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Issue was filed. */ }
    } catch (err) { result.textContent = err.message; }
    finally { submit.disabled = false; }
  };
  try {
    const response = await fetch(`${API}?op=session`, { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    if (body.login) {
      login.hidden = true; logout.hidden = false; report.hidden = false;
      logout.textContent = `Log out (${body.login})`;
      logout.title = logout.textContent;
    }
  } catch { /* Plain make serve has no server functions; recording still works. */ }
}
