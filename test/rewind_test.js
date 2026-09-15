import assert from 'node:assert/strict';
import { loadTestData, J } from './helpers.js';
import { Session, checkpoint } from '../src/record.js';
const data = await loadTestData();
const idle = { read: () => J.idle };
const step = (s,n=1) => {for(let i=0;i<n;i++){s.step();s.state.events=[];}};
let s = new Session(data,idle,{initial:{mode:'quest'},seed:9});
step(s,40);s.command('RENEW');step(s,80);s.command('RENEW');step(s,16);s.command('RENEW');
const recording=s.snapshot();
let watched=Session.watch(data,idle,recording);
watched.nextRoom();const first=checkpoint(watched.state);
watched.nextRoom();const second=checkpoint(watched.state);
watched=watched.previousRoom();assert.deepEqual(checkpoint(watched.state),first);
watched.nextRoom();assert.deepEqual(checkpoint(watched.state),second);
while(!watched.playbackDone)watched.nextRoom();
assert.deepEqual(checkpoint(watched.state),recording.checkpoint);
assert.deepEqual(watched.snapshot(),recording);
for (const rooms of [0, 1, 3]) {
  const takeover=Session.watch(data,idle,recording);
  for (let i=0;i<rooms;i++) takeover.nextRoom();
  const at=checkpoint(takeover.state);
  takeover.continueLive();
  assert.equal(takeover.playback,false);
  assert.deepEqual(checkpoint(takeover.state),at);
}
// Live room rewind reconstructs the simulation, truncates future commands, and branches.
s=s.backRoom();assert.equal(s.state.clock.day,3);assert.equal(s.playback,false);
assert.deepEqual(checkpoint(s.state),second);
step(s,24);s.command('RENEW');
assert.deepEqual(checkpoint(Session.replay(data,idle,s.snapshot()).state),checkpoint(s.state));
s=s.backRoom();assert.deepEqual(checkpoint(s.state),second);
s=s.backRoom();assert.deepEqual(checkpoint(s.state),first);
s=s.backRoom();assert.equal(s.simticks,0);assert.equal(s.backRoom(),s);
console.log('rewind_test: repeated room visits, replay seeking and branched live room rewind passed');
