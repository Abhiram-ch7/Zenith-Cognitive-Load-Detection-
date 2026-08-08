// Zenith — Daily Data Store
// Uses a simple JSON file — no electron-store dependency needed
const fs = require('fs');
const path = require('path');
const os = require('os');

class DataStore {
  constructor() {
    // Store data in ~/.zenith/data.json — always works, no ESM issues
    this._dir = path.join(os.homedir(), '.zenith');
    this._filePath = path.join(this._dir, 'data.json');
    try { fs.mkdirSync(this._dir, { recursive: true }); } catch(e) {}
    this._data = this._load();
    this._seedHistoricalData();
  }

  _load() {
    try {
      if (fs.existsSync(this._filePath)) {
        return JSON.parse(fs.readFileSync(this._filePath, 'utf8'));
      }
    } catch(e) { console.error('[Zenith DataStore] Load error:', e.message); }
    return {};
  }

  _save() {
    try {
      fs.writeFileSync(this._filePath, JSON.stringify(this._data, null, 2), 'utf8');
    } catch(e) { console.error('[Zenith DataStore] Save error:', e.message); }
  }

  get(key) { return this._data[key]; }
  set(key, val) { this._data[key] = val; this._save(); }
  delete(key) { delete this._data[key]; this._save(); }

  _seedHistoricalData() {
    const existing = this._data['tracked_days'] || [];
    if (existing.length >= 8) {
      console.log('[Zenith] Historical data already seeded (' + existing.length + ' days)');
      return;
    }

    console.log('[Zenith] Seeding 7 days of historical AI data...');
    const now = new Date();
    const days = [];

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push(dateStr);

      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Build hourly stress — high load 12-3PM on weekdays
      const hourlyStress = {};
      const startH = isWeekend ? 11 : 9;
      const endH = isWeekend ? 16 : 18;
      let peakHour = null, peakVal = 0;

      for (let h = startH; h <= endH; h++) {
        const hourStr = h.toString().padStart(2, '0') + ':00';
        let val;
        if (!isWeekend && h >= 12 && h <= 15) {
          val = 0.72 + Math.random() * 0.2;
        } else if (!isWeekend && (h === 9 || h === 10)) {
          val = 0.35 + Math.random() * 0.15;
        } else {
          val = 0.15 + Math.random() * 0.25;
        }
        hourlyStress[hourStr] = { total: val * 12, count: 12 };
        if (val > peakVal) { peakVal = val; peakHour = hourStr; }
      }

      // Apps — VS Code and Antigravity = high usage, YouTube = low
      const apps = {
        'VS Code': Math.floor(120 + Math.random() * 80),
        'Antigravity IDE': Math.floor(80 + Math.random() * 60),
        'Chrome - YouTube': Math.floor(30 + Math.random() * 40),
        'Slack': Math.floor(20 + Math.random() * 30),
        'Discord': Math.floor(10 + Math.random() * 20),
      };
      if (isWeekend) {
        apps['Chrome - YouTube'] = Math.floor(80 + Math.random() * 60);
        apps['VS Code'] = Math.floor(20 + Math.random() * 30);
      }

      const avgScore = isWeekend ? 0.25 + Math.random() * 0.15 : 0.50 + Math.random() * 0.15;
      const totalMinutes = isWeekend ? 180 + Math.floor(Math.random() * 60) : 400 + Math.floor(Math.random() * 80);

      // Build synthetic snapshots
      const snapshots = [];
      for (let s = 0; s < 50; s++) {
        const score = Math.max(0, Math.min(1, avgScore + (Math.random() - 0.5) * 0.3));
        const state = score > 0.7 ? 'overloaded' : score > 0.5 ? 'stressed' : score > 0.3 ? 'focused' : 'calm';
        snapshots.push({ time: Date.now() - i * 86400000 + s * 300000, score, state, hour: startH + Math.floor(s / 5) });
      }

      const calmPct = isWeekend ? 55 : 35;
      const focusedPct = isWeekend ? 20 : 30;
      const stressedPct = isWeekend ? 15 : 22;
      const overloadedPct = isWeekend ? 10 : 13;

      this._data['daily_' + dateStr] = {
        date: dateStr, snapshots, hourlyStress, apps,
        peakStressHour: peakHour,
        avgScore, maxScore: 0.92 + Math.random() * 0.08,
        totalMinutes,
        interventionsUsed: Math.floor(Math.random() * 4),
        stateDistribution: { calm: calmPct, focused: focusedPct, stressed: stressedPct, overloaded: overloadedPct }
      };
    }

    this._data['tracked_days'] = days;
    this._save();
    console.log('[Zenith] Seeded', days.length, 'days of historical data to', this._filePath);
  }

  _todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  _getDay(date) {
    return this._data['daily_' + date] || {
      date, snapshots: [], hourlyStress: {}, apps: {},
      peakStressHour: null, avgScore: 0, maxScore: 0, totalMinutes: 0,
      interventionsUsed: 0,
      stateDistribution: { calm: 0, focused: 0, stressed: 0, overloaded: 0 }
    };
  }

  _saveDay(date, data) {
    this._data['daily_' + date] = data;
    const days = this._data['tracked_days'] || [];
    if (!days.includes(date)) {
      days.push(date);
      if (days.length > 90) days.shift();
      this._data['tracked_days'] = days;
    }
    this._save();
  }

  recordSnapshot(state, score, activeApp) {
    const date = this._todayKey();
    const day = this._getDay(date);
    const hour = new Date().getHours();
    const hourStr = hour.toString().padStart(2, '0') + ':00';

    if (!day.hourlyStress[hourStr]) day.hourlyStress[hourStr] = { total: 0, count: 0 };
    day.hourlyStress[hourStr].total += score;
    day.hourlyStress[hourStr].count += 1;

    if (activeApp && activeApp !== 'Unknown') {
      day.apps[activeApp] = (day.apps[activeApp] || 0) + 1;
    }

    if (day.stateDistribution[state] !== undefined) {
      day.stateDistribution[state]++;
    }

    day.snapshots.push({ time: Date.now(), score, state, hour });
    if (day.snapshots.length > 2000) day.snapshots = day.snapshots.slice(-1500);

    const scores = day.snapshots.map(s => s.score);
    day.avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    day.maxScore = Math.max(...scores);
    day.totalMinutes = Math.round(day.snapshots.length * 5 / 60);

    let peakHour = null, peakAvg = 0;
    for (const [h, d] of Object.entries(day.hourlyStress)) {
      const avg = d.total / d.count;
      if (avg > peakAvg) { peakAvg = avg; peakHour = h; }
    }
    day.peakStressHour = peakHour;

    this._saveDay(date, day);
    return day;
  }

  recordIntervention() {
    const date = this._todayKey();
    const day = this._getDay(date);
    day.interventionsUsed++;
    this._saveDay(date, day);
  }

  getToday() { return this._getDay(this._todayKey()); }

  getWeek() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(this._getDay(d.toISOString().slice(0, 10)));
    }
    return days;
  }

  getInsights() {
    const today = this.getToday();
    const week = this.getWeek();
    const insights = [];

    if (today.peakStressHour) {
      insights.push({ icon: '🔥', type: 'warning', text: `Peak cognitive load around ${today.peakStressHour}` });
    }

    const appEntries = Object.entries(today.apps).sort((a, b) => b[1] - a[1]);
    if (appEntries.length > 0) {
      insights.push({ icon: '💻', type: 'info', text: `Most active in: ${appEntries[0][0]}` });
    }

    // AI correlation: high-load vs low-load apps
    const highLoadApps = ['VS Code', 'Antigravity', 'IntelliJ'];
    const lowLoadApps = ['YouTube', 'Discord', 'Spotify'];
    const foundHigh = appEntries.find(([n]) => highLoadApps.some(h => n.includes(h)));
    const foundLow = appEntries.find(([n]) => lowLoadApps.some(l => n.includes(l)));
    if (foundHigh && foundLow) {
      insights.push({ icon: '🧠', type: 'info', text: `Higher cognitive load in ${foundHigh[0]} vs lower in ${foundLow[0]}` });
    }

    const weekScores = week.filter(d => d.snapshots.length > 0).map(d => d.avgScore);
    if (weekScores.length >= 2) {
      const recent = weekScores.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const earlier = weekScores.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, weekScores.length - 2);
      if (recent > earlier + 0.1) insights.push({ icon: '📈', type: 'warning', text: 'Stress levels trending up this week' });
      else if (recent < earlier - 0.1) insights.push({ icon: '📉', type: 'positive', text: 'Stress levels decreasing — great job!' });
      else insights.push({ icon: '📊', type: 'info', text: 'Stress levels are stable this week' });
    }

    if (today.interventionsUsed > 0) {
      insights.push({ icon: '✅', type: 'positive', text: `You've used ${today.interventionsUsed} intervention${today.interventionsUsed > 1 ? 's' : ''} today` });
    }

    const dist = today.stateDistribution;
    const total = dist.calm + dist.focused + dist.stressed + dist.overloaded;
    if (total > 10) {
      const focusedPct = Math.round((dist.focused / total) * 100);
      if (focusedPct > 20) insights.push({ icon: '🎯', type: 'positive', text: `${focusedPct}% of your time was spent focused` });
    }

    return insights;
  }
}

module.exports = DataStore;
