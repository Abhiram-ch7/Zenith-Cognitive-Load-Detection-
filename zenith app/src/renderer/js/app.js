const path=require('path');
const KM=require(path.join(__dirname,'..','services','keystroke-monitor'));
const CE=require(path.join(__dirname,'..','engine','cognitive-engine'));
const IS=require(path.join(__dirname,'..','services','intervention-service'));
const{initScreenFlow,getUserName}=require(path.join(__dirname,'js','onboarding'));
const{initTracking,recordSnapshot,recordIntervention,renderInsights,isDemoActive,startDemo,getRecentScores}=require(path.join(__dirname,'js','insights'));
const monitor=new KM(),engine=new CE(),interventions=new IS();
let currentView='view-status',trendData=[],isMonitoring=true,ambientAudioCtx=null,ambientSource=null,musicAudioCtx=null,musicInterval=null,musicPlaying=false,lastAutoAction=0;
const $=id=>document.getElementById(id),$$=sel=>document.querySelectorAll(sel);
const personalMsgs={calm:['{name}, you\'re doing great!','Smooth sailing, {name} 🌊','Nice flow, {name}!'],focused:['{name}, you\'re in the zone! 🎯','Great focus, {name}!','Deep work mode, {name} 💪'],stressed:['{name}, maybe take a breather?','A short break might help, {name}','Let\'s slow down a bit, {name} 🍃'],overloaded:['{name}, please take a break! 🌿','Time to step away, {name}','Your mind needs rest, {name} 💙'],idle:['Waiting for you, {name}...']};

window.onAppReady=async function(name){setupNav();setupTitlebar();setupInterventionsGrid();startMonitoring();startAnalysisLoop();setupAlertBanner();
await initTracking();
trendData = getRecentScores() || [];
window._zenithUpdateUI=updateStatusUI;window._zenithUpdateTrend=updateTrendChart;window._zenithShowAlert=showAlert;
if(trendData.length > 0 && currentView === 'view-status') { drawTrendChart(); }
if(isDemoActive()){startDemo();document.body.classList.add('demo-active');}
const sn=$('setting-name');if(sn){sn.value=name;sn.addEventListener('change',async()=>{const{ipcRenderer}=require('electron');await ipcRenderer.invoke('store-set','userName',sn.value.trim());const u=$('titlebar-user');if(u)u.textContent=sn.value.trim();})}
try{const{ipcRenderer}=require('electron');
ipcRenderer.on('toggle-monitoring',(e,p)=>{isMonitoring=!p;if(isMonitoring)startMonitoring();else monitor.stop();});
ipcRenderer.on('activate-focus-mode',()=>launchIntervention('focus-mode'));
ipcRenderer.on('open-settings',()=>switchView('view-settings'));
}catch(e){}};

function setupNav(){$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>{switchView(b.dataset.view);$$('.nav-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');}));
$('btn-back-interventions')?.addEventListener('click',()=>switchView('view-status'));
$('btn-back-settings')?.addEventListener('click',()=>switchView('view-status'));}
function switchView(v){$$('.view').forEach(x=>x.classList.remove('active'));$(v)?.classList.add('active');currentView=v;$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='view-insights')renderInsights();}
function setupTitlebar(){$('btn-theme')?.addEventListener('click',()=>{const t=document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark';try{require('electron').ipcRenderer.invoke('store-set','theme',t)}catch(e){}});
$('btn-minimize')?.addEventListener('click',()=>{try{require('electron').ipcRenderer.send('minimize-window')}catch(e){}});
$('btn-close')?.addEventListener('click',()=>{try{require('electron').ipcRenderer.send('close-window')}catch(e){}});
$('btn-mini-mode')?.addEventListener('click',()=>{try{require('electron').ipcRenderer.send('toggle-mini-mode')}catch(e){}});
$('btn-exit-mini')?.addEventListener('click',()=>{try{require('electron').ipcRenderer.send('toggle-mini-mode')}catch(e){}});
try{require('electron').ipcRenderer.on('mini-mode-toggled',(e, isMini) => { document.body.classList.toggle('mini-mode', isMini); });}catch(e){}
$('btn-focus-sprint')?.addEventListener('click',()=>{ launchIntervention('focus-sprint'); });
}
function startMonitoring(){monitor.start();isMonitoring=true;}
function startAnalysisLoop(){
  setInterval(()=>{
    if(!isMonitoring || isDemoActive())return;
    const s=monitor.getSnapshot(), r=engine.analyze(s);
    updateStatusUI(r,s);updateTrendChart(r);
    recordSnapshot(r.state, r.score);
    if(r.state==='overloaded'&&(!interventions.getLastTriggerTime()||(Date.now()-interventions.getLastTriggerTime()>180000))){
      showAlert('High Cognitive Load Detected','Initiating Neural Break...');
      launchIntervention('focus-mode');
    }
  },5000);
}
function setupAlertBanner(){$('btn-alert-close')?.addEventListener('click',()=>$('alert-banner').classList.remove('show'));}
function showAlert(title,body){const b=$('alert-banner');if(!b)return;$('alert-title').textContent=title;$('alert-desc').textContent=body;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),6000);}

// ── Audio Engine ──

function updateStatusUI(result,snapshot){if(!result)return;
const state=result.state||'calm',trend=result.trend||'stable';
const cfg={calm:{emoji:'🧘'},focused:{emoji:'🎯'},stressed:{emoji:'😤'},overloaded:{emoji:'🔥'},idle:{emoji:'💤'}}[state]||{emoji:'🧘'};
const ring=$('ring-progress');if(ring){const o=534.07-(534.07*(result.score||0));ring.style.strokeDashoffset=o;}
const miniRing=$('mini-ring-progress');if(miniRing){const mo=264-(264*(result.score||0));miniRing.style.strokeDashoffset=mo;}

const gc={calm:['#63e2b8','#7b93fd'],focused:['#7b93fd','#c084fc'],stressed:['#f5a623','#ff6b6b'],overloaded:['#f06292','#ef5350'],idle:['#63e2b8','#7b93fd']};
const c=gc[state]||gc.calm;const s1=$('grad-stop-1'),s2=$('grad-stop-2');if(s1)s1.setAttribute('stop-color',c[0]);if(s2)s2.setAttribute('stop-color',c[1]);

const gt=$('glow-top'), gb=$('glow-bottom');
if(gt) gt.style.background = c[0];
if(gb) gb.style.background = c[1];

const em=$('state-emoji');if(em)em.textContent=cfg.emoji;
const lb=$('state-label');if(lb)lb.textContent=state.charAt(0).toUpperCase()+state.slice(1);
const sc=$('state-score');if(sc)sc.textContent=Math.round((result.score||0)*100)+'%';

const me=$('mini-emoji');if(me)me.textContent=cfg.emoji;
const ml=$('mini-label');if(ml)ml.textContent=state.charAt(0).toUpperCase()+state.slice(1);
const ms=$('mini-score');if(ms)ms.textContent=Math.round((result.score||0)*100)+'% Load';

const rc=$('state-ring-container');if(rc)rc.dataset.state=state;
if(snapshot&&!snapshot.insufficient_data){
  const vs=$('val-speed');if(vs)vs.textContent=snapshot.typing_speed.toFixed(1);
  const ve=$('val-errors');if(ve)ve.textContent=(snapshot.error_rate*100).toFixed(0)+'%';
  
  // Calculate Flow Probability (higher speed, low errors, moderate pauses)
  const speedScore = Math.min(1, snapshot.typing_speed / 8);
  const errorScore = 1 - Math.min(1, snapshot.error_rate * 5);
  const flowProb = Math.round((speedScore * 0.6 + errorScore * 0.4) * 100);
  const vf=$('val-flow');if(vf)vf.textContent=flowProb+'%';
  
  // Calculate Cognitive Debt (time spent in high stress / continuous minutes)
  const debt = Math.round((snapshot.continuous_minutes || 0) * (result.score || 0) * 0.5);
  const vd=$('val-debt');if(vd)vd.textContent=debt;
}
updateFactors(result.factors);
const bd=$('trend-badge');if(bd){bd.textContent=trend.charAt(0).toUpperCase()+trend.slice(1);bd.dataset.trend=trend;}
}

function drawTrendChart() {
const canvas=$('trend-canvas');if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--border-subtle').trim();ctx.lineWidth=1;
for(let i=0;i<4;i++){const y=(h/4)*i+0.5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
if(trendData.length<2)return;const step=w/(trendData.length-1);
ctx.beginPath();ctx.moveTo(0,h);trendData.forEach((v,i)=>ctx.lineTo(i*step,h-v*h));ctx.lineTo((trendData.length-1)*step,h);ctx.closePath();
const ls=trendData[trendData.length-1],grad=ctx.createLinearGradient(0,0,0,h);
if(ls>0.7){grad.addColorStop(0,'rgba(240,98,146,0.3)');grad.addColorStop(1,'rgba(240,98,146,0)');}
else if(ls>0.45){grad.addColorStop(0,'rgba(245,166,35,0.3)');grad.addColorStop(1,'rgba(245,166,35,0)');}
else{grad.addColorStop(0,'rgba(99,226,184,0.3)');grad.addColorStop(1,'rgba(99,226,184,0)');}
ctx.fillStyle=grad;ctx.fill();
ctx.beginPath();trendData.forEach((v,i)=>{if(i===0)ctx.moveTo(0,h-v*h);else ctx.lineTo(i*step,h-v*h);});
ctx.strokeStyle=ls>0.7?'#f06292':ls>0.45?'#f5a623':'#63e2b8';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
const lx=(trendData.length-1)*step,ly=h-ls*h;ctx.beginPath();ctx.arc(lx,ly,4,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();
}

function updateTrendChart(result){
  trendData.push(result.score);
  if(trendData.length>60)trendData.shift();
  drawTrendChart();
}

function updateFactors(factors){const list=$('factors-list');if(!list)return;if(!factors||!factors.length){list.innerHTML='<div class="factor-empty">No stress factors detected</div>';return;}
list.innerHTML=factors.map(f=>{const s=f.severity>0.7?'high':f.severity>0.4?'medium':'low';return`<div class="factor-item" data-severity="${s}"><span class="factor-label">${f.label}</span><span class="factor-detail">${f.detail}</span></div>`;}).join('');}

function setupInterventionsGrid(){const grid=$('interventions-grid');if(!grid)return;
grid.innerHTML=interventions.getInterventions().map(i=>`<div class="intervention-card" data-id="${i.id}"><div class="intervention-icon">${i.icon}</div><div class="intervention-label">${i.label}</div><div class="intervention-desc">${i.description}</div>${i.duration?`<div class="intervention-duration">${i.duration}s</div>`:''}</div>`).join('');
grid.querySelectorAll('.intervention-card').forEach(c=>c.addEventListener('click',()=>launchIntervention(c.dataset.id)));}

function launchIntervention(id){interventions.startIntervention(id);switchView('view-active-intervention');const el=$('intervention-active-content');if(!el)return;
switch(id){case'focus-sprint':renderFocusSprint(el);break;case'breathing':renderBreathing(el);break;case'break':renderBreakTimer(el,90);break;case'ambient':renderAmbient(el);break;case'chunk-task':renderChunkTask(el);break;case'stretch':renderStretch(el);break;case'focus-mode':renderFocusMode(el);break;case'reflect':renderReflect(el);break;case'screen-dim':renderScreenDim(el);break;case'posture':renderPosture(el);break;case'soothing-music':renderSoothingMusic(el);break;default:el.innerHTML='<p>Coming soon</p>';}}
function endIntervention(){interventions.completeIntervention();stopAmbientSound();stopSoothingMusic();switchView('view-status');$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='view-status'));try{require('electron').ipcRenderer.invoke('store-set','interventionsCompleted',(interventions.getStats().totalCompleted))}catch(e){}}
function formatTime(s){return Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');}

function renderFocusSprint(el){let r=1500;focusActive=true;
  try{require('electron').ipcRenderer.invoke('focus-mode-on');}catch(e){}
  el.innerHTML=`<div class="timer-container"><div style="font-size:40px;margin-bottom:8px">⏱️</div><div class="timer-label">Focus Sprint Active</div><div class="breathing-phase" style="color:var(--accent-primary)">✓ 25 Minute Deep Work Session</div><div class="timer-display" id="focus-timer">${formatTime(r)}</div><div class="timer-progress"><div class="timer-progress-bar" id="focus-bar" style="width:100%"></div></div><div class="intervention-controls"><button class="intervention-btn" onclick="endFocus()">End Sprint</button></div></div>`;
  const iv=setInterval(()=>{r--;const ft=$('focus-timer');if(ft)ft.textContent=formatTime(r);const fb=$('focus-bar');if(fb)fb.style.width=(r/1500*100)+'%';if(r<=0){clearInterval(iv);endFocus();}},1000);
}

function renderBreathing(el){let s=30,phases=['Breathe In','Hold','Breathe Out','Hold'],pi=0,pt=4;
el.innerHTML=`<div class="breathing-container"><div class="breathing-visual"><div class="breathing-circle outer breathing-orb"></div><div class="breathing-circle inner breathing-orb"></div></div><div class="breathing-instruction" id="breathe-phase">${phases[0]}</div><div class="breathing-phase" id="breathe-timer">${s}s remaining</div><div class="intervention-controls"><button class="intervention-btn" onclick="endIntervention()">End</button></div></div>`;
const iv=setInterval(()=>{s--;pt--;if(pt<=0){pi=(pi+1)%4;pt=4;const p=$('breathe-phase');if(p)p.textContent=phases[pi];}const t=$('breathe-timer');if(t)t.textContent=s+'s remaining';if(s<=0){clearInterval(iv);endIntervention();}},1000);}

function renderBreakTimer(el,dur){let r=dur;
el.innerHTML=`<div class="timer-container"><div class="timer-label">Take a moment. Step away.</div><div class="timer-display" id="timer-val">${formatTime(r)}</div><div class="timer-progress"><div class="timer-progress-bar" id="timer-bar" style="width:100%"></div></div><div class="intervention-controls"><button class="intervention-btn" onclick="endIntervention()">Skip</button></div></div>`;
const iv=setInterval(()=>{r--;const tv=$('timer-val');if(tv)tv.textContent=formatTime(r);const tb=$('timer-bar');if(tb)tb.style.width=(r/dur*100)+'%';if(r<=0){clearInterval(iv);endIntervention();}},1000);}

function renderAmbient(el){el.innerHTML=`<div class="ambient-container"><div style="font-size:42px;margin-bottom:4px">🎧</div><div class="ambient-label">Ambient Sounds</div><div class="breathing-phase" style="margin-bottom:12px">Layered nature soundscapes</div><div class="sound-visualizer">${Array(14).fill('<div class="sound-bar"></div>').join('')}</div><div class="ambient-controls"><button class="ambient-btn active" data-sound="rain" onclick="playAmbient('rain',this)">🌧 Rain</button><button class="ambient-btn" data-sound="ocean" onclick="playAmbient('ocean',this)">🌊 Ocean</button><button class="ambient-btn" data-sound="forest" onclick="playAmbient('forest',this)">🌿 Forest</button></div><div class="ambient-volume"><label>Volume</label><input type="range" min="0" max="100" value="60" id="ambient-vol" oninput="setAmbientVol(this.value)"></div><div class="intervention-controls"><button class="intervention-btn" onclick="endIntervention()">Stop</button></div></div>`;playAmbient('rain');}

let ambientAudio = null;
function playAmbient(type) {
  stopAmbientSound();
  const urls = {
    rain: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Rain_on_a_tin_roof.ogg',
    ocean: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Ocean_Waves_Breaking_on_Beach.ogg',
    forest: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Ambience%2C_Crex_crex%2C_summer_night.ogg'
  };
  
  ambientAudio = new Audio(urls[type]);
  ambientAudio.loop = true;
  ambientAudio.volume = 0.6;
  
  const volControl = document.getElementById('ambient-vol');
  if(volControl) ambientAudio.volume = volControl.value / 100;
  
  ambientAudio.play().catch(e => console.log('Audio play failed:', e));
  
  $$('.ambient-btn').forEach(b=>b.classList.remove('active'));
  $$(`[data-sound="${type}"]`).forEach(b=>b.classList.add('active'));
}

function setAmbientVol(v){ if(ambientAudio) ambientAudio.volume = v/100; }
function stopAmbientSound(){
  if(ambientAudio){
    ambientAudio.pause();
    ambientAudio.src = '';
    ambientAudio = null;
  }
}

function renderChunkTask(el){el.innerHTML=`<div class="chunk-container"><div class="chunk-header">📋 Break your task into smaller steps</div><div class="chunk-list">${[1,2,3].map(n=>`<div class="chunk-item"><div class="chunk-number">${n}</div><input class="chunk-input" placeholder="Step ${n}..." type="text"></div>`).join('')}</div><div class="intervention-controls"><button class="intervention-btn primary" onclick="endIntervention()">Done</button></div></div>`;}

function renderStretch(el){const st=[{icon:'🙆',name:'Neck Roll',desc:'Slowly roll your head in a circle, 5 times each direction'},{icon:'💪',name:'Shoulder Shrug',desc:'Raise shoulders to ears, hold 3s, release. Repeat 5x'},{icon:'🤲',name:'Wrist Circles',desc:'Circle your wrists 10 times each direction'}];let idx=0,t=15;
el.innerHTML=`<div class="stretch-container"><div class="stretch-icon" id="stretch-icon">${st[0].icon}</div><div class="stretch-instruction" id="stretch-name">${st[0].name}</div><div class="stretch-detail" id="stretch-desc">${st[0].desc}</div><div class="breathing-phase" id="stretch-timer">${t}s</div><div class="intervention-controls"><button class="intervention-btn" onclick="endIntervention()">Skip</button></div></div>`;
const iv=setInterval(()=>{t--;const s=$('stretch-timer');if(s)s.textContent=t+'s';if(t<=0){idx++;if(idx>=st.length){clearInterval(iv);endIntervention();return;}t=15;const si=$('stretch-icon');if(si)si.textContent=st[idx].icon;const sn=$('stretch-name');if(sn)sn.textContent=st[idx].name;const sd=$('stretch-desc');if(sd)sd.textContent=st[idx].desc;}},1000);}

let focusActive=false;
function renderFocusMode(el){let r=120;focusActive=true;
  try{require('electron').ipcRenderer.invoke('focus-mode-on');}catch(e){}
  el.innerHTML=`<div class="timer-container"><div style="font-size:40px;margin-bottom:8px">🔕</div><div class="timer-label">Focus Break Active</div><div class="breathing-phase" style="color:var(--accent-primary)">✓ All background windows minimized</div><div class="timer-display" id="focus-timer">${formatTime(r)}</div><div class="timer-progress"><div class="timer-progress-bar" id="focus-bar" style="width:100%"></div></div><div class="intervention-controls"><button class="intervention-btn" onclick="endFocus()">End Focus</button></div></div>`;
  const iv=setInterval(()=>{r--;const ft=$('focus-timer');if(ft)ft.textContent=formatTime(r);const fb=$('focus-bar');if(fb)fb.style.width=(r/120*100)+'%';if(r<=0){clearInterval(iv);endFocus();}},1000);
}
function endFocus(){focusActive=false;try{require('electron').ipcRenderer.invoke('focus-mode-off');}catch(e){}endIntervention();}

function renderReflect(el){const prompts=['What is the one thing that matters most right now?','Take a breath. How does your body feel?','Are you working on the right thing?','What would "good enough" look like for this task?'];let t=20;
el.innerHTML=`<div class="reflect-container"><div style="font-size:40px">💭</div><div class="reflect-prompt">"${prompts[Math.floor(Math.random()*prompts.length)]}"</div><div class="breathing-phase" id="reflect-timer">${t}s</div><div class="intervention-controls"><button class="intervention-btn primary" onclick="endIntervention()">Continue</button></div></div>`;
const iv=setInterval(()=>{t--;const r=$('reflect-timer');if(r)r.textContent=t+'s';if(t<=0)clearInterval(iv);},1000);}

let screenDimActive=false;
function renderScreenDim(el){let t=30;screenDimActive=true;
  try{require('electron').ipcRenderer.invoke('screen-dim-on',0.6);}catch(e){}
  el.innerHTML=`<div class="screen-dim-overlay"><div class="screen-dim-content"><div style="font-size:40px;margin-bottom:16px">🌑</div><div class="timer-label" style="color:rgba(255,255,255,0.7)">Screen Dimmed — Micro-Break</div><div class="breathing-phase" style="color:rgba(255,255,255,0.5)">Your entire screen has been dimmed</div><div class="timer-display" id="dim-timer">${formatTime(t)}</div><div class="intervention-controls" style="justify-content:center"><button class="intervention-btn" style="color:white;border-color:rgba(255,255,255,0.2)" onclick="endDim()">End</button></div></div></div>`;
  const iv=setInterval(()=>{t--;const d=$('dim-timer');if(d)d.textContent=formatTime(t);if(t<=0){clearInterval(iv);endDim();}},1000);
}
function endDim(){screenDimActive=false;try{require('electron').ipcRenderer.invoke('screen-dim-off');}catch(e){}endIntervention();}

function renderPosture(el){const ch=['Feet flat on the floor','Back straight, shoulders relaxed','Screen at eye level','Wrists in neutral position','Uncross your legs'];
el.innerHTML=`<div class="posture-container"><div style="font-size:40px">🪑</div><div class="stretch-instruction">Posture Check</div><div class="posture-checklist">${ch.map((c,i)=>`<div class="posture-item"><div class="posture-check" id="pc-${i}" onclick="this.classList.toggle('checked');this.innerHTML=this.classList.contains('checked')?'✓':''"></div><span>${c}</span></div>`).join('')}</div><div class="intervention-controls"><button class="intervention-btn primary" onclick="endIntervention()">Done</button></div></div>`;}

function renderSoothingMusic(el){el.innerHTML=`<div class="ambient-container"><div style="font-size:48px;margin-bottom:8px">🎧</div><div class="ambient-label">Lofi Focus Radio</div><div class="breathing-phase" style="margin-bottom:16px">Continuous chill beats for deep work</div><div class="sound-visualizer" style="height:70px">${Array(14).fill('<div class="sound-bar"></div>').join('')}</div><div class="ambient-controls" style="margin-top:16px"><button class="ambient-btn active" onclick="switchMusic('lofi',this)">☕ Lofi Beats</button><button class="ambient-btn" onclick="switchMusic('synth',this)">🌌 Chillwave</button><button class="ambient-btn" onclick="switchMusic('jazz',this)">🎷 Chill Jazz</button></div><div class="ambient-volume"><label>Volume</label><input type="range" min="0" max="100" value="50" id="music-vol" oninput="setMusicVol(this.value)"></div><div class="intervention-controls"><button class="intervention-btn" onclick="endIntervention()">Stop</button></div></div>`;startSoothingMusic('lofi');}

let musicAudio = null;
function startSoothingMusic(genre){
  stopSoothingMusic();
  const urls = {
    lofi: 'https://stream.zeno.fm/f3wvbbqmdg8uv', // Zeno Lofi Radio
    synth: 'https://stream.zeno.fm/0r0xa792kwzuv', // Zeno ChillSynth
    jazz: 'https://stream.zeno.fm/8xntmvw3g0quv'    // Zeno Chill Jazz
  };
  
  musicAudio = new Audio(urls[genre]);
  musicAudio.crossOrigin = 'anonymous'; // Important for streams
  musicAudio.volume = 0.5;
  
  const volControl = document.getElementById('music-vol');
  if(volControl) musicAudio.volume = volControl.value / 100;
  
  musicAudio.play().catch(e => console.log('Audio play failed:', e));
  
  $$('.ambient-btn').forEach(x=>x.classList.remove('active'));
  $$(`[onclick*="${genre}"]`).forEach(b=>b.classList.add('active'));
}

function setMusicVol(v){ if(musicAudio) musicAudio.volume = v/100; }
function stopSoothingMusic(){
  if(musicAudio){
    musicAudio.pause();
    musicAudio.src = '';
    musicAudio = null;
  }
}
function switchMusic(g,b){$$('.ambient-btn').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');startSoothingMusic(g);}

function setupAlertBanner(){$('alert-action-btn')?.addEventListener('click',()=>{hideAlert();switchView('view-interventions');$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='view-interventions'));});$('alert-dismiss-btn')?.addEventListener('click',hideAlert);}
function showAlert(result){const banner=$('alert-banner');if(!banner)return;const titles={stressed:'Elevated cognitive load detected',overloaded:'High cognitive overload detected'};const subs={stressed:'A short intervention might help',overloaded:'Consider stepping away briefly'};const icons={stressed:'⚡',overloaded:'🔥'};
const at=$('alert-title');if(at)at.textContent=titles[result.state]||'Check in with yourself';const as=$('alert-subtitle');if(as)as.textContent=subs[result.state]||'';const ai=$('alert-icon');if(ai)ai.textContent=icons[result.state]||'💡';banner.classList.add('visible');setTimeout(hideAlert,8000);}
function hideAlert(){$('alert-banner')?.classList.remove('visible');}

function endInterventionTracked(){recordIntervention();endIntervention();}

window.endIntervention=endIntervention;window.playAmbient=playAmbient;window.switchMusic=switchMusic;
document.addEventListener('DOMContentLoaded',()=>initScreenFlow());
