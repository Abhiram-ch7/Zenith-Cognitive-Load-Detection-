// ============================================================
// Zenith — Cognitive Load Detection Engine
// Analyzes keystroke features to determine cognitive state.
// Uses the same feature set as the trained RandomForest/LSTM model.
// ============================================================

class CognitiveEngine {
  constructor() {
    // Thresholds derived from training data analysis
    // These are calibrated defaults — recalibrate per user in production
    this.thresholds = {
      typing_speed_low: 2.0,        // keys/sec below this = slow
      typing_speed_high: 6.0,       // keys/sec above this = fluent
      avg_pause_high: 0.5,          // seconds — long avg pauses suggest load
      pause_variance_high: 0.3,     // high variance = erratic
      error_rate_high: 0.15,        // >15% error rate = stressed
      long_pause_threshold: 3,      // too many long pauses
      burst_threshold: 50,          // burst metric threshold
      continuous_typing_alert: 25,  // minutes of continuous typing
    };

    // Weighted scoring system
    this.weights = {
      typing_speed: 0.20,
      pause_pattern: 0.25,
      error_rate: 0.20,
      variance: 0.15,
      continuity: 0.10,
      context_switching: 0.10,
    };

    this.history = [];
    this.maxHistory = 60; // Keep last 60 snapshots (~5 minutes at 5-sec intervals)
    this.currentState = 'calm';
    this.stateListeners = [];
    this.lastAlertTime = 0;
    this.alertCooldown = 120000; // 2 minutes between alerts
    this.smoothedScore = 0;
  }

  /**
   * Analyze a keystroke snapshot and return cognitive load assessment
   * @param {Object} snapshot - Feature snapshot from KeystrokeMonitor
   * @returns {Object} - Cognitive state assessment
   */
  analyze(snapshot) {
    if (snapshot.insufficient_data) {
      return {
        state: 'idle',
        score: 0,
        confidence: 0,
        factors: [],
        recommendation: null,
        trend: 'stable',
      };
    }

    const factors = [];
    let rawScore = 0;

    // ── 1. Typing Speed Analysis ──────────────────────────────
    const speedScore = this._analyzeSpeed(snapshot.typing_speed);
    rawScore += speedScore * this.weights.typing_speed;
    if (speedScore > 0.6) {
      factors.push({
        id: 'speed',
        label: 'Typing speed irregular',
        severity: speedScore,
        detail: `${snapshot.typing_speed.toFixed(1)} keys/sec`,
      });
    }

    // ── 2. Pause Pattern Analysis ─────────────────────────────
    const pauseScore = this._analyzePauses(snapshot);
    rawScore += pauseScore * this.weights.pause_pattern;
    if (pauseScore > 0.5) {
      factors.push({
        id: 'pauses',
        label: 'Hesitation patterns detected',
        severity: pauseScore,
        detail: `Avg pause: ${(snapshot.avg_pause * 1000).toFixed(0)}ms`,
      });
    }

    // ── 3. Error Rate Analysis ────────────────────────────────
    const errorScore = this._analyzeErrors(snapshot.error_rate);
    rawScore += errorScore * this.weights.error_rate;
    if (errorScore > 0.5) {
      factors.push({
        id: 'errors',
        label: 'High correction rate',
        severity: errorScore,
        detail: `${(snapshot.error_rate * 100).toFixed(1)}% corrections`,
      });
    }

    // ── 4. Variance Analysis ──────────────────────────────────
    const varianceScore = this._analyzeVariance(snapshot.pause_variance);
    rawScore += varianceScore * this.weights.variance;
    if (varianceScore > 0.6) {
      factors.push({
        id: 'variance',
        label: 'Erratic typing rhythm',
        severity: varianceScore,
        detail: `Variance: ${snapshot.pause_variance.toFixed(3)}`,
      });
    }

    // ── 5. Continuous Typing Duration ─────────────────────────
    const continuityScore = this._analyzeContinuity(snapshot.continuous_minutes);
    rawScore += continuityScore * this.weights.continuity;
    if (continuityScore > 0.5) {
      factors.push({
        id: 'duration',
        label: `Typing intensely for ${Math.round(snapshot.continuous_minutes)} min`,
        severity: continuityScore,
        detail: 'Consider a short break',
      });
    }

    // ── 6. Context Switching ──────────────────────────────────
    const switchScore = this._analyzeContextSwitching(snapshot.context_switches);
    rawScore += switchScore * this.weights.context_switching;
    if (switchScore > 0.5) {
      factors.push({
        id: 'switching',
        label: 'Frequent context switching',
        severity: switchScore,
        detail: `${snapshot.context_switches} switches detected`,
      });
    }

    // ── Exponential smoothing ─────────────────────────────────
    const alpha = 0.3; // smoothing factor
    this.smoothedScore = alpha * rawScore + (1 - alpha) * this.smoothedScore;

    // Determine state
    const state = this._classifyState(this.smoothedScore);
    const shouldAlert = this._shouldAlert(state);

    // Store in history
    this.history.push({
      timestamp: Date.now(),
      score: this.smoothedScore,
      state,
      factors,
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const result = {
      state,
      score: Math.min(1, Math.max(0, this.smoothedScore)),
      confidence: this._calculateConfidence(),
      factors,
      recommendation: shouldAlert ? this._getRecommendation(state, factors) : null,
      trend: this._getTrend(),
    };

    // Notify state change
    if (state !== this.currentState) {
      this.currentState = state;
      this.stateListeners.forEach(fn => fn(result));
    }

    if (shouldAlert) {
      this.lastAlertTime = Date.now();
      this.stateListeners.forEach(fn => fn(result));
    }

    return result;
  }

  _analyzeSpeed(speed) {
    if (speed < this.thresholds.typing_speed_low) {
      return Math.min(1, (this.thresholds.typing_speed_low - speed) / this.thresholds.typing_speed_low);
    }
    if (speed > this.thresholds.typing_speed_high * 1.5) {
      // Extremely fast typing can also indicate stress
      return 0.4;
    }
    return 0;
  }

  _analyzePauses(snapshot) {
    let score = 0;
    if (snapshot.avg_pause > this.thresholds.avg_pause_high) {
      score += 0.4;
    }
    if (snapshot.long_pause_count > this.thresholds.long_pause_threshold) {
      score += 0.3;
    }
    if (snapshot.pause_ratio < 0.2) {
      score += 0.3; // very uneven pauses
    }
    return Math.min(1, score);
  }

  _analyzeErrors(errorRate) {
    if (errorRate > this.thresholds.error_rate_high) {
      return Math.min(1, errorRate / 0.3);
    }
    return errorRate / this.thresholds.error_rate_high * 0.3;
  }

  _analyzeVariance(variance) {
    if (variance > this.thresholds.pause_variance_high) {
      return Math.min(1, variance / (this.thresholds.pause_variance_high * 2));
    }
    return 0;
  }

  _analyzeContinuity(minutes) {
    if (minutes > this.thresholds.continuous_typing_alert) {
      return Math.min(1, minutes / 60);
    }
    if (minutes > 15) {
      return 0.3;
    }
    return 0;
  }

  _analyzeContextSwitching(switches) {
    if (switches > 10) return 0.8;
    if (switches > 5) return 0.5;
    return 0;
  }

  _classifyState(score) {
    if (score >= 0.7) return 'overloaded';
    if (score >= 0.45) return 'stressed';
    if (score >= 0.25) return 'focused';
    return 'calm';
  }

  _shouldAlert(state) {
    const now = Date.now();
    if (now - this.lastAlertTime < this.alertCooldown) return false;
    return state === 'overloaded' || state === 'stressed';
  }

  _calculateConfidence() {
    // More history = more confident
    return Math.min(1, this.history.length / 20);
  }

  _getTrend() {
    if (this.history.length < 5) return 'stable';
    const recent = this.history.slice(-5);
    const older = this.history.slice(-10, -5);
    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.score, 0) / older.length;

    if (recentAvg > olderAvg + 0.1) return 'increasing';
    if (recentAvg < olderAvg - 0.1) return 'decreasing';
    return 'stable';
  }

  _getRecommendation(state, factors) {
    const recommendations = [];

    // Duration-based
    const durationFactor = factors.find(f => f.id === 'duration');
    if (durationFactor) {
      recommendations.push('break', 'stretch');
    }

    // Error-based
    const errorFactor = factors.find(f => f.id === 'errors');
    if (errorFactor) {
      recommendations.push('breathing', 'chunk-task');
    }

    // Hesitation-based
    const pauseFactor = factors.find(f => f.id === 'pauses');
    if (pauseFactor) {
      recommendations.push('breathing', 'focus-mode');
    }

    // Context switching
    const switchFactor = factors.find(f => f.id === 'switching');
    if (switchFactor) {
      recommendations.push('focus-mode', 'chunk-task');
    }

    // Default fallback
    if (recommendations.length === 0) {
      if (state === 'overloaded') {
        recommendations.push('breathing', 'break', 'ambient');
      } else {
        recommendations.push('breathing', 'focus-mode');
      }
    }

    // Deduplicate
    return [...new Set(recommendations)].slice(0, 3);
  }

  onStateChange(callback) {
    this.stateListeners.push(callback);
  }

  getHistory() {
    return this.history;
  }

  reset() {
    this.history = [];
    this.smoothedScore = 0;
    this.currentState = 'calm';
    this.lastAlertTime = 0;
  }
}

module.exports = CognitiveEngine;
