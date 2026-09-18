export class ReplayPresentation {
  constructor() {
    this.messageDelay = 500;
    this.reset();
  }

  reset() {
    this.session = null;
    this.panel = '';
    this.elapsed = 0;
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

  advance(session, elapsed, { running = true, seeking = false } = {}) {
    if (!session.playback || session.playbackDone || seeking) {
      this.reset();
      return;
    }
    this.observe(session);
    if (running) this.elapsed += elapsed;
  }

  ready(session) {
    return !session.playback || session.playbackDone || session.state.tuneWait != null
      || !session.state.panel.some(Boolean) || this.elapsed >= this.messageDelay;
  }
}
