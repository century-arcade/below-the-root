export class ReplayPresentation {
  constructor() {
    this.messageDelay = 750;
    this.reset();
  }

  reset() {
    this.session = null;
    this.panel = '';
    this.elapsed = 0;
    this.pausedSongElapsed = 0;
    this.pausedSongFrames = 0;
  }

  observe(session) {
    if (this.session !== session) {
      this.reset();
      this.session = session;
    }
    const panel = Array.from(session.state.panel).join(',');
    if (panel === this.panel) return false;
    this.panel = panel;
    this.elapsed = 0;
    return true;
  }

  advance(session, elapsed, { running = true, seeking = false, musicRunning = true } = {}) {
    if (!session.playback || session.playbackDone || seeking) {
      this.reset();
      return;
    }
    this.observe(session);
    if (running) {
      this.elapsed += elapsed;
      this.pausedSongElapsed = 0;
      this.pausedSongFrames = 0;
    } else if (musicRunning && session.finalPanel && session.state.tuneWait != null) {
      this.pausedSongElapsed += elapsed;
      const frames = Math.floor(this.pausedSongElapsed * 60 / 1000);
      session.state.stall = Math.max(0, session.state.stall - (frames - this.pausedSongFrames));
      this.pausedSongFrames = frames;
      if (!session.state.stall) session.state.tuneWait = null;
    }
  }

  ready(session) {
    return !session.playback || session.playbackDone || session.state.tuneWait != null
      || !session.state.panel.some(Boolean) || this.elapsed >= this.messageDelay;
  }
}
