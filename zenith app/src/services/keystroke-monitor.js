// ============================================================
// Zenith — Keystroke Monitor Service
// Captures keyboard events at the application level and feeds
// them into the cognitive detection engine.
// ============================================================

class KeystrokeMonitor {
  constructor() {
    this.timestamps = [];
    this.errorCount = 0; // backspace/delete presses
    this.totalKeys = 0;
    this.isMonitoring = false;
    this.listeners = [];
    this.windowSize = 10000; // 10-second sliding window (ms)
    this.sessionStart = Date.now();
    this.contextSwitchCount = 0;
    this.lastActiveWindow = null;
    this.intensityStartTime = null;
    this.continuousTypingMinutes = 0;
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.sessionStart = Date.now();
    this._setupListeners();
    console.log('[Zenith] Keystroke monitoring started');
  }

  stop() {
    this.isMonitoring = false;
    this._removeListeners();
    console.log('[Zenith] Keystroke monitoring stopped');
  }

  _setupListeners() {
    // We use DOM-level key events since iohook requires native compilation
    // In production, this would use OS-level hooks via native modules
    this._onKeyDown = (event) => {
      if (!this.isMonitoring) return;

      const now = Date.now();
      this.timestamps.push(now);
      this.totalKeys++;

      // Track errors (backspace, delete)
      if (event.key === 'Backspace' || event.key === 'Delete') {
        this.errorCount++;
      }

      // Track continuous typing intensity
      if (!this.intensityStartTime) {
        this.intensityStartTime = now;
      }
      this.continuousTypingMinutes = (now - this.intensityStartTime) / 60000;

      // Prune old timestamps (keep last windowSize ms)
      const cutoff = now - this.windowSize;
      this.timestamps = this.timestamps.filter(t => t > cutoff);

      // Emit data to listeners every 50 keystrokes
      if (this.totalKeys % 50 === 0) {
        this._emitSnapshot();
      }
    };

    document.addEventListener('keydown', this._onKeyDown);
  }

  _removeListeners() {
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
    }
  }

  // Simulate external input data (for demo/testing without global hooks)
  injectKeystroke(timestamp, isError = false) {
    this.timestamps.push(timestamp || Date.now());
    this.totalKeys++;
    if (isError) this.errorCount++;

    const cutoff = (timestamp || Date.now()) - this.windowSize;
    this.timestamps = this.timestamps.filter(t => t > cutoff);
  }

  getSnapshot() {
    const now = Date.now();
    const windowTimestamps = this.timestamps.filter(t => t > now - this.windowSize);

    if (windowTimestamps.length < 3) {
      return {
        typing_speed: 0,
        avg_pause: 0,
        max_pause: 0,
        min_pause: 0,
        pause_variance: 0,
        key_count: 0,
        burst_typing: 0,
        long_pause_count: 0,
        pause_ratio: 0,
        error_rate: 0,
        continuous_minutes: this.continuousTypingMinutes,
        context_switches: this.contextSwitchCount,
        insufficient_data: true,
      };
    }

    // Compute pauses
    const pauses = [];
    for (let i = 1; i < windowTimestamps.length; i++) {
      const p = (windowTimestamps[i] - windowTimestamps[i - 1]) / 1000; // convert to seconds
      if (p > 0 && p < 10) pauses.push(p);
    }

    if (pauses.length === 0) {
      return { insufficient_data: true, continuous_minutes: this.continuousTypingMinutes };
    }

    const avg_pause = pauses.reduce((a, b) => a + b, 0) / pauses.length;
    const max_pause = Math.max(...pauses);
    const min_pause = Math.min(...pauses);
    const pause_variance = pauses.reduce((sum, p) => sum + (p - avg_pause) ** 2, 0) / pauses.length;
    const key_count = windowTimestamps.length;
    const typing_speed = key_count / (this.windowSize / 1000);
    const burst_typing = key_count / (avg_pause + 0.001);
    const long_pause_count = pauses.filter(p => p > 1).length;
    const pause_ratio = avg_pause / (max_pause + 0.001);
    const error_rate = this.totalKeys > 0 ? this.errorCount / this.totalKeys : 0;

    return {
      typing_speed,
      avg_pause,
      max_pause,
      min_pause,
      pause_variance,
      key_count,
      burst_typing,
      long_pause_count,
      pause_ratio,
      error_rate,
      continuous_minutes: this.continuousTypingMinutes,
      context_switches: this.contextSwitchCount,
      insufficient_data: false,
    };
  }

  _emitSnapshot() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(fn => fn(snapshot));
  }

  onSnapshot(callback) {
    this.listeners.push(callback);
  }

  resetSession() {
    this.timestamps = [];
    this.errorCount = 0;
    this.totalKeys = 0;
    this.sessionStart = Date.now();
    this.intensityStartTime = null;
    this.continuousTypingMinutes = 0;
    this.contextSwitchCount = 0;
  }

  // Reset the intensity timer (after a break)
  resetIntensityTimer() {
    this.intensityStartTime = null;
    this.continuousTypingMinutes = 0;
  }
}

module.exports = KeystrokeMonitor;
