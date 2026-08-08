// ============================================================
// Zenith — Intervention Service
// Manages all micro-intervention types and their execution
// ============================================================

class InterventionService {
  constructor() {
    this.activeIntervention = null;
    this.completedInterventions = [];
    this.listeners = [];
  }

  getInterventions() {
    return [
      {
        id: 'breathing',
        label: 'Guided Breathing',
        description: '30-second box breathing exercise',
        icon: '🫁',
        duration: 30,
        category: 'calm',
      },
      {
        id: 'break',
        label: 'Micro-Break Timer',
        description: 'Step away for 60–90 seconds',
        icon: '⏱',
        duration: 90,
        category: 'rest',
      },
      {
        id: 'ambient',
        label: 'Ambient Sounds',
        description: 'Rain & white noise to refocus',
        icon: '🌧',
        duration: 300,
        category: 'calm',
      },
      {
        id: 'chunk-task',
        label: 'Break It Down',
        description: 'Split your current task into 3 steps',
        icon: '📋',
        duration: 0,
        category: 'productivity',
      },
      {
        id: 'stretch',
        label: 'Quick Stretch',
        description: 'Neck, shoulders, wrists — 45 seconds',
        icon: '🧘',
        duration: 45,
        category: 'physical',
      },
      {
        id: 'focus-mode',
        label: 'Focus Reset',
        description: 'Dim screen, mute notifications briefly',
        icon: '🔕',
        duration: 120,
        category: 'focus',
      },
      {
        id: 'reflect',
        label: 'Pause & Reflect',
        description: 'A moment to check in with yourself',
        icon: '💭',
        duration: 20,
        category: 'mindfulness',
      },
      {
        id: 'screen-dim',
        label: 'Screen Dim Break',
        description: 'Gentle screen dim with micro-break overlay',
        icon: '🌑',
        duration: 30,
        category: 'rest',
      },
      {
        id: 'posture',
        label: 'Posture Check',
        description: 'Quick posture and ergonomics reminder',
        icon: '🪑',
        duration: 10,
        category: 'physical',
      },
      {
        id: 'soothing-music',
        label: 'Soothing Music',
        description: 'Calming melodies to ease your mind',
        icon: '🎵',
        duration: 180,
        category: 'calm',
      },
    ];
  }

  startIntervention(id) {
    const intervention = this.getInterventions().find(i => i.id === id);
    if (!intervention) return null;

    this.activeIntervention = {
      ...intervention,
      startedAt: Date.now(),
      completed: false,
    };

    this._notify('start', this.activeIntervention);
    return this.activeIntervention;
  }

  completeIntervention() {
    if (this.activeIntervention) {
      this.activeIntervention.completed = true;
      this.activeIntervention.completedAt = Date.now();
      this.completedInterventions.push({ ...this.activeIntervention });
      this._notify('complete', this.activeIntervention);
      this.activeIntervention = null;
    }
  }

  cancelIntervention() {
    if (this.activeIntervention) {
      this._notify('cancel', this.activeIntervention);
      this.activeIntervention = null;
    }
  }

  onEvent(callback) {
    this.listeners.push(callback);
  }

  _notify(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  }

  getStats() {
    return {
      totalCompleted: this.completedInterventions.length,
      byType: this.completedInterventions.reduce((acc, i) => {
        acc[i.id] = (acc[i.id] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

module.exports = InterventionService;
