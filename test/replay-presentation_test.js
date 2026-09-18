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

for (const delay of [0, 500, 1000]) {
  test(`successive messages each receive ${delay} ms of active presentation time`, () => {
    const { session, timing } = fixture();
    timing.messageDelay = delay;
    for (const text of ['FIRST MESSAGE', 'SECOND MESSAGE']) {
      say(session.state, text);
      timing.observe(session);
      if (delay) {
        timing.advance(session, delay - 1);
        assert.equal(timing.ready(session), false);
        timing.advance(session, 1);
      }
      assert.equal(timing.ready(session), true);
    }
  });
}

test('delay tuning takes effect immediately and never dismisses a song message', () => {
  const { session, timing } = fixture();
  assert.equal(timing.messageDelay, 500);
  timing.advance(session, 250);
  assert.equal(timing.ready(session), false);
  timing.messageDelay = 200;
  assert.equal(timing.ready(session), true);
  timing.messageDelay = 1000;
  assert.equal(timing.ready(session), false);
  session.state.tuneWait = 2;
  const panel = session.state.panel.slice();
  assert.equal(timing.ready(session), true, 'music waits keep ticking during message dwell');
  timing.advance(session, 2000);
  assert.deepEqual(session.state.panel, panel);
  assert.equal(session.state.tuneWait, 2);
});

test('pause and hidden time do not consume the reading interval', () => {
  const { session, timing } = fixture();
  timing.advance(session, 200);
  timing.advance(session, 10000, { running: false });
  assert.equal(timing.ready(session), false);
  timing.advance(session, 299);
  assert.equal(timing.ready(session), false);
  timing.advance(session, 1);
  assert.equal(timing.ready(session), true);
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
