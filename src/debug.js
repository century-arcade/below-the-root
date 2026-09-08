import { ENGINE_VERSION } from './record.js';
import { panelLines } from './panel.js';
import { isEditing } from './input.js';

const API = '/.netlify/functions/github';
const DRAFT_KEY = 'btr.issue-draft';

export function downloadRecord(session) {
  downloadRecordingText(JSON.stringify(session.snapshot()), `btr-playthrough-${session.frame}.json`);
}

export function downloadRecordingText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatIssueDetails(details) {
  return '{\n' + Object.entries(details).filter(([, value]) => value !== undefined).map(([key, value]) => {
    const json = ['recentPath', 'recentInputs'].includes(key) && value.length
      ? '[\n' + value.map(entry => '    ' + JSON.stringify(entry)).join(',\n') + '\n  ]'
      : JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
    return `  ${JSON.stringify(key)}: ${json}`;
  }).join(',\n') + '\n}';
}

export function issueContext(session) {
  const record = session.record;
  const s = session.state;
  const details = { engine: ENGINE_VERSION, frame: session.frame, room: s.room?.code,
    player: s.player, clock: s.clock, panel: panelLines(s),
    recentPath: record.path.slice(-30), recentInputs: record.inputs.slice(-50) };
  return 'Filed from the game’s debug screen. The full playthrough can be downloaded separately.\n\n'
    + '```json\n' + formatIssueDetails(details) + '\n```';
}

export async function setupDebug({ getSession, saveNow, pause, resume, importFile, note,
  downloadRecording }) {
  const bar = document.getElementById('debug');
  bar.hidden = false;
  document.body.classList.add('debugging');
  document.getElementById('debug-status').hidden = false;
  document.getElementById('file-issue').hidden = false;
  document.getElementById('github-auth').hidden = false;
  const login = document.getElementById('github-login');
  const logout = document.getElementById('github-logout');
  const report = document.getElementById('file-issue');
  const dialog = document.getElementById('issue-dialog');
  const form = document.getElementById('issue-form');
  const message = document.getElementById('issue-message');
  const result = document.getElementById('issue-result');
  const submit = document.getElementById('issue-submit');
  let authenticated = false;
  let context = '';

  document.getElementById('download-record').onclick = downloadRecording;
  document.getElementById('load-record').onchange = async e => {
    const selected = e.target.files[0];
    if (selected) await importFile(selected);
    e.target.value = '';
  };
  login.onclick = () => {
    pause();
    if (!saveNow()) { resume(); return; }
    location.assign(`${API}?op=login`);
  };
  logout.onclick = async () => {
    try {
      const response = await fetch(`${API}?op=logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Could not log out. Try again.');
      authenticated = false;
      login.hidden = false; logout.hidden = true;
    } catch (err) { note(err.message); }
  };
  report.onclick = () => {
    if (!authenticated) { login.click(); return; }
    pause(); saveNow();
    context = issueContext(getSession());
    result.textContent = '';
    try { message.value = sessionStorage.getItem(DRAFT_KEY) || ''; } catch {}
    dialog.show();
    message.focus();
  };
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'r' && !e.repeat && !e.metaKey && !e.altKey && !e.ctrlKey
        && !isEditing(e.target) && !dialog.open) {
      report.focus();
      report.click();
      e.preventDefault();
    }
  });
  message.oninput = () => { try { sessionStorage.setItem(DRAFT_KEY, message.value); } catch {} };
  document.getElementById('issue-cancel').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { resume(); report.focus(); });
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
      message.value = '';
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      dialog.close();
      note(`Issue #${body.number} filed`);
    } catch (err) { result.textContent = err.message; }
    finally { submit.disabled = false; }
  };
  try {
    const response = await fetch(`${API}?op=session`, { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    if (body.login) {
      authenticated = true;
      login.hidden = true; logout.hidden = false;
      logout.textContent = `Log out (${body.login})`;
      logout.title = logout.textContent;
    }
  } catch { /* Plain make serve has no server functions; recording still works. */ }
}
