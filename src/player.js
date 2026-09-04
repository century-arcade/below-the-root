// docs/spec/player.md: the per-step movement state machine

import {
  cell, isSolid, isClimbable, isSupport, role, doorNumber, ladderSnap, isLadderCentre, COLS, ROWS,
} from './world.js';
import { say } from './text.js';
import { spend } from './clock.js';

export const SFX = {
  blip: 0, confirm: 1, footA: 2, footB: 3, climbUp: 4, climbDown: 5, leap: 6, knockdown: 7, glide: 8,
  fall: 9, door: 10, glideTurn: 11, bell: 12, chime: 13,
};

const FRAME = {
  idle: (f) => (f < 0 ? 0 : 3),
  walk: (f, alt) => (f < 0 ? 1 : 4) + alt,
  crawlIdle: (f) => (f < 0 ? 17 : 20),
  crawl: (f, alt) => (f < 0 ? 18 : 21) + alt,
  glide: (f) => (f < 0 ? 6 : 7),
  climb: [8, 9],
  ladderTop: 10,
  stoop: (f) => (f < 0 ? 11 : 13),
  flight: (f) => (f < 0 ? 12 : 14),
  stars: [15, 16],
  lying: 23,
};

export function newPlayer(sheet, stamina) {
  return {
    col: 0, row: 0, facing: -1,
    period: 8, counter: 0,
    fallen: 0, lastGood: { col: 0, row: 0 },
    stride: 0, strideAlt: 0, running: false, crawling: false, pose: false,
    leaping: false, leapPhase: 0, hover: 0,
    gliding: false, glideInhibited: false,
    knockdown: 0, frame: 0, frameAlt: 0,
    stamina, fatigue: 255,
    indoors: false, underground: false,
    sheet,
  };
}

export function figureOf(state) {
  const p = state.player;
  return { sheet: p.sheet, frame: p.frame, col: p.col, row: p.row };
}

function sfx(state, id) {
  state.events.push({ sfx: id });
}

function carrying(state, cls) {
  return state.objects.some((o) => o.class === cls && o.exists && o.carried);
}

// the eleven cells: read once per step and again after every move
function sample(state) {
  const { col, row } = state.player;
  return {
    own: cell(state, col, row),
    left: cell(state, col - 1, row), right: cell(state, col + 1, row),
    floor: cell(state, col, row + 1),
    downLeft: cell(state, col - 1, row + 1), downRight: cell(state, col + 1, row + 1),
    up1: cell(state, col, row - 1), up2: cell(state, col, row - 2), head: cell(state, col, row - 3),
    upLeft2: cell(state, col - 1, row - 2), upRight2: cell(state, col + 1, row - 2),
  };
}

export function idleFrame(p) {
  return p.crawling ? FRAME.crawlIdle(p.facing) : FRAME.idle(p.facing);
}

function stoopPose(state) {
  const p = state.player;
  p.pose = true;
  p.period = 5;
  p.frame = FRAME.stoop(p.facing);
}

function cancelMotion(p) {
  p.leaping = false;
  p.gliding = false;
  p.stride = 0;
  p.running = false;
  p.crawling = false;
}

export function step(state) {
  const p = state.player;
  const s = sample(state);
  if (p.pose) {
    p.pose = false;
    p.frame = idleFrame(p);
    return;
  }
  if (isSupport(state, s.floor) && p.fallen > 0) {
    if (p.fallen >= 6) return startKnockdown(state);
    sfx(state, SFX.footA);
    p.fallen = 0;
  }
  if (p.stride) return walkHalf(state, s);
  if (p.knockdown) return knockdownStep(state);
  if (p.leaping) return leapStep(state, s);
  if (p.gliding) return glideStep(state, s);
  const input = state.input.read();
  if (input.fire) return fireHeld(state, s, input);
  return fireFree(state, s, input);
}

function fireHeld(state, s, input) {
  const p = state.player;
  const supported = isSupport(state, s.floor);
  if (p.fallen >= 2 && !supported && !p.glideInhibited) {
    if (carrying(state, 7)) {
      p.gliding = true;
      p.fallen = 0;
      p.crawling = false;
      p.period = 8;
      p.frame = FRAME.glide(p.facing);
      sfx(state, SFX.glide);
      return glideStep(state, s);
    }
    return fireFree(state, s, input);
  }
  if (input.dx !== 0 && !supported) return fireFree(state, s, input);
  if (input.dx === p.facing) return leap(state);
  if (input.dx !== 0) {
    p.facing = input.dx;
    if (FRAME.climb.includes(p.frame)) return leap(state);
    p.frame = idleFrame(p);
    return;
  }
  if (input.dy > 0 && supported) {
    state.stop = { reason: 'menu' };
    return;
  }
  if (input.dy === 0 && doorNumber(state, s.own)) {
    state.stop = { reason: 'door', n: doorNumber(state, s.own) };
    sfx(state, SFX.door);
    return;
  }
  return fireFree(state, s, input);
}

function fireFree(state, s, input) {
  const p = state.player;
  if (!isSupport(state, s.floor)) {
    p.row += 1;
    p.period = 4;
    p.fallen += 1;
    if (p.fallen === 2) sfx(state, SFX.fall);
    return afterMove(state, false);
  }
  let dx = input.dx;
  if (isLadderCentre(state, s.own) && isLadderCentre(state, s.floor)) dx = 0;
  if (dx !== 0 && dx !== p.facing) {
    p.facing = dx;
    p.frame = idleFrame(p);
    return;
  }
  if (dx !== 0) {
    p.strideAlt = 1 - p.strideAlt;
    return walkHalf(state, s);
  }
  if (input.dy < 0) {
    if (isClimbable(state, s.own)) return climb(state, -1);
    if (p.crawling) {
      p.crawling = false;
      stoopPose(state);
    }
    return;
  }
  if (input.dy > 0) {
    if (isClimbable(state, s.floor)) return climb(state, 1);
    if (!p.crawling) {
      p.crawling = true;
      stoopPose(state);
    }
    return;
  }
  p.period = 8;
  p.running = false;
}

function walkHalf(state, s) {
  const p = state.player;
  const first = p.stride === 0;
  if (first) {
    p.period = p.crawling ? 8 : p.running ? 3 : 6;
    p.frame = p.crawling ? FRAME.crawl(p.facing, p.strideAlt) : FRAME.walk(p.facing, p.strideAlt);
    p.stride = 1;
    return;
  }
  p.period = p.crawling ? 8 : p.running ? 2 : 4;
  p.frame = p.crawling ? FRAME.crawlIdle(p.facing) : FRAME.idle(p.facing);
  p.stride = 0;
  const into = p.facing < 0 ? s.left : s.right;
  p.col += p.facing;
  if (isSolid(state, into)) p.row -= 1;
  sfx(state, p.strideAlt ? SFX.footB : SFX.footA);
  if (p.underground && doorNumber(state, cell(state, p.col, p.row)) === 2 && carrying(state, 0)) {
    state.stop = { reason: 'bell' };
    sfx(state, SFX.bell);
  }
  return afterMove(state, true);
}

function leap(state) {
  const p = state.player;
  if (p.underground && FRAME.climb.includes(p.frame)) return;
  p.period = 6;
  p.leaping = true;
  p.leapPhase = 1;
  p.running = true;
  p.crawling = false;
  p.frame = FRAME.stoop(p.facing);
  sfx(state, SFX.leap);
  spend(state, 5);
  p.hover = p.stamina >= 30 ? 3 : p.stamina >= 20 ? 2 : 1;
}

function leapStep(state, s) {
  const p = state.player;
  p.period = 4;
  p.frame = FRAME.flight(p.facing);
  if (p.leapPhase !== 1 && isSolid(state, s.floor)) {
    p.leaping = false;
    sfx(state, SFX.footA);
    return step(state);
  }
  const ledge = p.facing < 0 ? s.downLeft : s.downRight;
  const descend = () => {
    p.row += 1;
    if (isSolid(state, ledge)) p.row -= 1;
  };
  p.col += p.facing;
  switch (p.leapPhase) {
    case 1: p.row -= 1; p.leapPhase = 2; break;
    case 2: p.row -= 1; p.leapPhase = 3; break;
    case 3:
      p.hover -= 1;
      if (p.hover <= 0) { descend(); p.leapPhase = 4; }
      break;
    default:
      descend();
      p.leaping = false;
      p.frame = idleFrame(p);
  }
  return afterMove(state, true);
}

function glideStep(state, s) {
  const p = state.player;
  if (isSolid(state, s.own)) {
    p.row -= 1;
    p.gliding = false;
    sfx(state, SFX.footA);
    return;
  }
  if (isSolid(state, s.floor)) {
    p.gliding = false;
    sfx(state, SFX.footA);
    return;
  }
  const input = state.input.read();
  if (input.dx !== 0 && input.dx !== p.facing) {
    p.facing = input.dx;
    sfx(state, SFX.glideTurn);
  }
  p.frame = FRAME.glide(p.facing);
  p.col += p.facing;
  p.row += 1;
  return afterMove(state, true);
}

function climb(state, dy) {
  const p = state.player;
  p.period = 10;
  p.row += dy;
  p.col += ladderSnap(state, cell(state, p.col, p.row));
  p.running = false;
  p.crawling = false;
  if (p.row >= 0 && p.row < ROWS - 1) {
    const entering = cell(state, p.col, p.row);
    const beyond = cell(state, p.col, p.row + dy);
    if (p.row === 0 || isClimbable(state, entering)) {
      if (p.row !== 0 && !isClimbable(state, beyond)) {
        p.frame = FRAME.ladderTop;
      } else {
        p.frameAlt ^= 1;
        p.frame = FRAME.climb[p.frameAlt];
        sfx(state, dy < 0 ? SFX.climbUp : SFX.climbDown);
        spend(state, 1);
      }
    } else {
      stoopPose(state);
    }
  }
  return afterMove(state, true);
}

function startKnockdown(state) {
  const p = state.player;
  p.knockdown = 1;
  p.frame = FRAME.stars[0];
  p.frameAlt = 0;
  p.fallen = 0;
  p.glideInhibited = false;
  cancelMotion(p);
  p.period = 15;
  sfx(state, SFX.knockdown);
  spend(state, 64);
  if (Math.floor(state.rng() * 16) === 0) tearShuba(state);
}

function tearShuba(state) {
  const shuba = state.objects.find((o) => o.class === 7 && o.exists && o.carried);
  if (!shuba) return;
  shuba.exists = false;
  shuba.carried = false;
  say(state, 'YOUR SHUBA HAS TORN');
}

function knockdownStep(state) {
  const p = state.player;
  p.knockdown += 1;
  p.period = 15;
  if (p.knockdown <= 9) {
    p.frameAlt ^= 1;
    p.frame = FRAME.stars[p.frameAlt];
  } else if (p.knockdown === 10) {
    p.frame = FRAME.stoop(p.facing);
  } else {
    p.knockdown = 0;
    p.period = 8;
    p.frame = idleFrame(p);
  }
}

function afterMove(state, clearFall) {
  const p = state.player;
  if (clearFall) p.fallen = 0;
  const s = sample(state);
  const own = role(state, s.own);
  if (own === 'bramble' && p.fallen < 2 && !p.gliding) return knockBack(state, false);
  if (own === 'wall' || (!p.crawling && role(state, s.head) === 'wall')) return knockBack(state, true);
  if (own === 'water') {
    state.stop = { reason: 'drown' };
    return;
  }
  const dir = p.row < 0 ? 'north' : p.row >= ROWS - 1 ? 'south'
    : p.col < 0 ? 'west' : p.col >= COLS ? 'east' : null;
  if (dir) {
    if (dir === 'west') p.col += 1;
    if (dir === 'east') p.col -= 1;
    state.stop = { reason: 'edge', dir };
    return;
  }
  p.lastGood = { col: p.col, row: p.row };
}

function knockBack(state, wall) {
  const p = state.player;
  p.col = p.lastGood.col;
  p.row = p.lastGood.row;
  cancelMotion(p);
  p.fallen = 10;
  if (wall) p.glideInhibited = true;
  p.frame = idleFrame(p);
}

// off the top or bottom of the world: the move is undone, no knock-down
export function haltAtEdge(state) {
  const p = state.player;
  p.col = p.lastGood.col;
  p.row = p.lastGood.row;
  cancelMotion(p);
  p.frame = idleFrame(p);
}

export function lieDown(state) {
  const p = state.player;
  p.frame = FRAME.lying;
}
