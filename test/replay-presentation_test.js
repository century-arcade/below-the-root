import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReplayPresentation } from '../src/replay-presentation.js';
import { newPanel, say } from '../src/panel.js';

function fixture() {
  const session = { playback: true, playbackDone: false, state: { panel: newPanel(), tuneWait: null } };
  const timing = new ReplayPresentation();
  say(session.state, 'FIRST MESSAGE');
  timing.observe(session);
  return { session, timing };
}

test('successive messages each receive 750 ms of active presentation time', () => {
  const { session, timing } = fixture();
  assert.equal(timing.messageDelay, 750);
  for (const text of ['FIRST MESSAGE', 'SECOND MESSAGE']) {
    say(session.state, text);
    timing.observe(session);
    timing.advance(session, 749);
    assert.equal(timing.ready(session), false);
    timing.advance(session, 1);
    assert.equal(timing.ready(session), true);
  }
});

test('message dwell never dismisses a song message or blocks its countdown', () => {
  const { session, timing } = fixture();
  timing.advance(session, 250);
  assert.equal(timing.ready(session), false);
  session.state.tuneWait = 2;
  const panel = session.state.panel.slice();
  assert.equal(timing.ready(session), true);
  timing.advance(session, 2000);
  assert.deepEqual(session.state.panel, panel);
  assert.equal(session.state.tuneWait, 2);
});

test('pause and hidden time do not consume the reading interval', () => {
  const { session, timing } = fixture();
  timing.advance(session, 200);
  timing.advance(session, 10000, { running: false });
  assert.equal(timing.ready(session), false);
  timing.advance(session, 549);
  assert.equal(timing.ready(session), false);
  timing.advance(session, 1);
  assert.equal(timing.ready(session), true);
});

test('a replay song that keeps playing while paused does not wait again on resume', () => {
  const { session, timing } = fixture();
  session.finalPanel = session.state.panel.slice();
  session.state.tuneWait = 2;
  session.state.stall = 60;
  for (let i = 0; i < 100; i++) timing.advance(session, 5, { running: false });
  assert.equal(session.state.stall, 30);
  timing.advance(session, 10000, { running: false });
  assert.equal(session.state.stall, 0);
  assert.equal(session.state.tuneWait, null);
  assert.deepEqual(session.state.panel, session.finalPanel);
  timing.advance(session, 750);
  assert.equal(timing.ready(session), true);
});

test('power-off pauses the song countdown and live stalls are never advanced', () => {
  const { session, timing } = fixture();
  session.finalPanel = session.state.panel.slice();
  session.state.tuneWait = 2;
  session.state.stall = 60;
  timing.advance(session, 5000, { running: false, musicRunning: false });
  assert.equal(session.state.stall, 60);
  session.playback = false;
  timing.advance(session, 5000, { running: false });
  assert.equal(session.state.stall, 60);
  assert.equal(session.state.tuneWait, 2);
});

test('seeking, completion, replacement and live continuation reset presentation time', () => {
  const { session, timing } = fixture();
  timing.advance(session, 200);
  timing.advance(session, 1000, { seeking: true });
  assert.equal(timing.session, null);
  timing.observe(session);
  assert.equal(timing.elapsed, 0);
  timing.advance(session, 250);
  const replacement = { ...session };
  timing.observe(replacement);
  assert.equal(timing.elapsed, 0);
  replacement.playbackDone = true;
  timing.advance(replacement, 1000);
  assert.equal(timing.session, null);
  assert.equal(timing.ready(replacement), true);
  session.playback = false;
  timing.advance(session, 1000);
  assert.equal(timing.session, null);
  assert.equal(timing.ready(session), true);
});
