// Zenith — Insights & Tracking Module
const path=require('path');
const DS=require(path.join(__dirname,'..','..','services','data-store'));
const{ipcRenderer}=require('electron');
let dataStore=null,demoMode=false,demoInterval=null,activeApp='Unknown';

async function initTracking(){
  // DataStore now uses plain JSON file — no electron-store needed
  try {
    dataStore = new DS();
    console.log('[Zenith] DataStore initialized. Today data:', JSON.stringify({
      avg: dataStore.getToday().avgScore,
      apps: Object.keys(dataStore.getToday().apps).length,
      hours: Object.keys(dataStore.getToday().hourlyStress).length,
    }));
  } catch(e) {
    console.error('[Zenith] DataStore init failed:', e);
  }

  // Read demo mode from main process store
  try { demoMode = await ipcRenderer.invoke('store-get','demoMode') || false; } catch(e){}

  const demoEl=document.getElementById('setting-demo');
  if(demoEl){
    demoEl.checked = demoMode;
    demoEl.addEventListener('change', async ()=>{
      demoMode = demoEl.checked;
      await ipcRenderer.invoke('store-set','demoMode', demoMode);
      document.body.classList.toggle('demo-active', demoMode);
      const di = document.getElementById('demo-indicator');
      if(di) di.classList.toggle('visible', demoMode);
      if(demoMode && !demoInterval) startDemo();
      if(!demoMode && demoInterval){ clearInterval(demoInterval); demoInterval=null; }
    });
  }

  // Set initial demo state
  if(demoMode) {
    document.body.classList.add('demo-active');
    const di = document.getElementById('demo-indicator');
    if(di) di.classList.add('visible');
  }

  document.getElementById('btn-back-insights')?.addEventListener('click',()=>{
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-status')?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='view-status'));
  });

  setInterval(pollActiveWindow, 15000);
  pollActiveWindow();
  return { dataStore, isDemoMode:()=>demoMode };
}

async function pollActiveWindow(){
  try{ activeApp = await ipcRenderer.invoke('get-active-window') || 'Unknown'; }catch(e){ activeApp='Unknown'; }
  const el = document.getElementById('active-app-name');
  if(el) el.textContent = activeApp;
}

function recordSnapshot(state, score){
  if(dataStore) dataStore.recordSnapshot(state, score, activeApp);
}

function recordIntervention(){
  if(dataStore) dataStore.recordIntervention();
}

function renderInsights(){
  if(!dataStore){ console.warn('[Zenith] No dataStore'); return; }
  const today = dataStore.getToday();
  const week = dataStore.getWeek();
  const insights = dataStore.getInsights();

  console.log('[Zenith] Rendering insights:', {
    avgScore: today.avgScore,
    hours: Object.keys(today.hourlyStress).length,
    apps: Object.keys(today.apps).length,
    weekDays: week.filter(d=>d.avgScore>0).length,
    insights: insights.length
  });

  // Summary cards
  const sm = document.getElementById('insights-summary');
  if(sm){
    const dist = today.stateDistribution;
    const total = dist.calm + dist.focused + dist.stressed + dist.overloaded || 1;
    sm.innerHTML = `
      <div class="summary-card"><div class="summary-value">${today.totalMinutes}</div><div class="summary-label">Minutes</div></div>
      <div class="summary-card"><div class="summary-value">${Math.round(today.avgScore*100)}%</div><div class="summary-label">Avg Load</div></div>
      <div class="summary-card"><div class="summary-value">${Math.round((dist.focused/total)*100)}%</div><div class="summary-label">Focused</div></div>
      <div class="summary-card"><div class="summary-value">${today.interventionsUsed}</div><div class="summary-label">Interventions</div></div>`;
  }

  // Hourly stress chart
  const hc = document.getElementById('hourly-chart');
  if(hc){
    const ctx = hc.getContext('2d');
    const w = hc.width, h = hc.height;
    ctx.clearRect(0, 0, w, h);
    const hours = Object.entries(today.hourlyStress).sort((a,b) => a[0].localeCompare(b[0]));
    if(hours.length > 0){
      const bw = Math.min(20, w / 24 - 2);
      hours.forEach(([hr, d]) => {
        const avg = (typeof d === 'object') ? (d.total / d.count) : d;
        const hi = parseInt(hr);
        if(isNaN(hi) || isNaN(avg)) return;
        const x = hi * (w/24) + 2;
        const bh = Math.max(3, avg * h * 0.85);
        const color = avg > 0.7 ? '#f06292' : avg > 0.45 ? '#f5a623' : '#63e2b8';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, h - bh, bw, bh, [3,3,0,0]);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(String(hi), x + bw/2, h - bh - 4);
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet — keep using Zenith!', w/2, h/2);
    }
  }

  // Apps list
  const al = document.getElementById('apps-list');
  if(al){
    const apps = Object.entries(today.apps).sort((a,b) => b[1] - a[1]).slice(0, 6);
    if(apps.length > 0){
      al.innerHTML = apps.map(([name, count]) => {
        return `<div class="app-item"><span class="app-name">${name}</span><span class="app-time">${count} checks</span></div>`;
      }).join('');
    } else {
      al.innerHTML = '<div class="factor-empty">No apps tracked yet</div>';
    }
  }

  // AI Insight cards
  const ic = document.getElementById('insights-cards');
  if(ic){
    if(insights.length > 0){
      ic.innerHTML = insights.map(i => `<div class="insight-card" data-type="${i.type}"><span class="insight-card-icon">${i.icon}</span><span class="insight-card-text">${i.text}</span></div>`).join('');
    } else {
      ic.innerHTML = '<div class="factor-empty">Keep using Zenith to generate insights</div>';
    }
  }

  // Weekly chart
  const wc = document.getElementById('weekly-chart');
  if(wc){
    const ctx = wc.getContext('2d');
    const w = wc.width, h = wc.height;
    ctx.clearRect(0, 0, w, h);
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const bw = w / 7 - 8;
    week.forEach((d, i) => {
      const x = i * (w/7) + 4;
      const avg = d.avgScore || 0;
      const bh = Math.max(2, avg * h * 0.8);
      const color = avg > 0.7 ? '#f06292' : avg > 0.45 ? '#f5a623' : avg > 0 ? '#63e2b8' : 'rgba(255,255,255,0.05)';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, h - bh - 14, bw, bh, [4,4,0,0]);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px Inter';
      ctx.textAlign = 'center';
      const dd = new Date(); dd.setDate(dd.getDate() - (6 - i));
      ctx.fillText(dayNames[dd.getDay()], x + bw/2, h - 2);
    });
  }
}

function startDemo(){
  const CE = require(path.join(__dirname,'..','..','engine','cognitive-engine'));
  const engine = new CE(); engine.reset();
  const phases = [
    {ts:0.10, dur:5, spd:5.5, err:0.03, pse:0.12},
    {ts:0.35, dur:5, spd:4,   err:0.08, pse:0.25},
    {ts:0.58, dur:6, spd:2.5, err:0.18, pse:0.45},
    {ts:0.82, dur:6, spd:1.5, err:0.28, pse:0.70},
    {ts:0.40, dur:4, spd:3.5, err:0.10, pse:0.30},
    {ts:0.08, dur:5, spd:6,   err:0.02, pse:0.10}
  ];
  let pi=0, tp=0, tk=0;
  if(demoInterval) clearInterval(demoInterval);
  demoInterval = setInterval(() => {
    if(!demoMode) return;
    tk++; tp++;
    if(tp > phases[pi].dur){ pi = (pi+1) % phases.length; tp = 0; }
    const p = phases[pi];
    const tgt = p.ts + (Math.random()-0.5)*0.06;
    engine.smoothedScore = engine.smoothedScore*0.5 + tgt*0.5;
    const snap = {
      typing_speed: p.spd + (Math.random()-0.5)*1.5,
      avg_pause: p.pse + (Math.random()-0.5)*0.08,
      error_rate: Math.max(0, p.err + (Math.random()-0.5)*0.04),
      continuous_minutes: tk*0.15,
      insufficient_data: false,
      max_pause: p.pse*2.5 + Math.random()*0.3,
      min_pause: 0.03 + Math.random()*0.02,
      pause_variance: p.pse*0.8 + Math.random()*0.1,
      key_count: Math.round(p.spd*10 + Math.random()*10),
      burst_typing: 60 - p.ts*40 + Math.random()*10,
      long_pause_count: Math.floor(p.ts*6),
      pause_ratio: 0.6 - p.ts*0.4,
      context_switches: Math.floor(p.ts*10)
    };
    const r = engine.analyze(snap);
    if(window._zenithUpdateUI) window._zenithUpdateUI(r, snap);
    if(window._zenithUpdateTrend) window._zenithUpdateTrend(r);
    recordSnapshot(r.state||'calm', r.score||0);

    if(r.state==='overloaded' && tp===2 && window._zenithShowAlert) {
      window._zenithShowAlert('High Cognitive Load Detected', 'Initiating Neural Break...');
    } else if(r.state==='stressed' && tp===2 && window._zenithShowAlert) {
      window._zenithShowAlert('Elevated Stress', 'Consider a short break.');
    }
  }, 2000);
}

function isDemoActive(){ return demoMode; }
function getActiveApp(){ return activeApp; }
function getRecentScores(){
  if(!dataStore) return [];
  return dataStore.getToday().snapshots.slice(-60).map(s => s.score);
}

module.exports = { initTracking, recordSnapshot, recordIntervention, renderInsights, isDemoActive, getActiveApp, startDemo, getRecentScores };
