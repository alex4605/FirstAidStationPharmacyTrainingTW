"use strict";
/* 還開著 STILL OPEN — 聲音
   全部用 WebAudio 即時合成，沒有任何音檔：不必下載，file:// 雙擊開啟也能用。
   聲音只跟著遊戲狀態走，不另外判斷劇情：
   ・發電機在轉：低頻的引擎聲（離發電機越近越大）、日光燈管的嗡聲、通風的氣流聲
   ・地下室裡有兩百多人：一層壓低的人聲（越靠近公共空間越清楚）
   ・空襲威脅：第 2 段遠處的低頻嗡鳴，第 3 段變近、在左右之間移動
   ・打擊：爆炸、低頻的震、之後一陣碎屑落地
   ・停電：發電機減速停下、燈管聲消失；緊急照明的繼電器「喀」一聲
   ・冷鏈脫離 2–8℃：冷藏庫的警示嗶聲（走近才聽得清楚）
   瀏覽器規定要使用者先點一下才能出聲，所以第一次點擊或按鍵時才啟動。
   頂列「聲音」按鈕或 M 鍵開關，選擇記在這台瀏覽器裡。 */
const SND={ctx:null, on:true, L:{}, last:{}};
try { if (localStorage.getItem('stillopen.sound')==='0') SND.on=false; } catch(e){}

function sndInit(){
  if (SND.ctx) { if (SND.ctx.state==='suspended') SND.ctx.resume().catch(()=>{}); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if (!AC) return;
  let c; try { c=SND.ctx=new AC(); } catch(e){ return; }
  const master=SND.master=c.createGain(); master.gain.value=SND.on?.6:0;
  const comp=c.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=4;
  master.connect(comp); comp.connect(c.destination);
  // 兩秒的白噪音，所有「沙沙」「轟」的底
  const nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate), d=nb.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  SND.noise=nb;
  const noiseSrc=()=>{ const s=c.createBufferSource(); s.buffer=nb; s.loop=true; s.start(); return s; };
  const gain=(v,to)=>{ const g=c.createGain(); g.gain.value=v; g.connect(to||master); return g; };
  const L=SND.L;
  // 發電機：兩個鋸齒波疊一個八度，過低通，再用 6 Hz 的起伏做出引擎的「突突」
  L.gen=gain(0);
  { const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=240; lp.connect(L.gen);
    const am=c.createGain(); am.gain.value=.75; am.connect(lp);
    L.genOsc=[49,98.6].map((f,i)=>{ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
      const g=c.createGain(); g.gain.value=i?.35:.6; o.connect(g); g.connect(am); o.start(); return o; });
    const lfo=c.createOscillator(); lfo.frequency.value=6.2; const lg=c.createGain(); lg.gain.value=.25;
    lfo.connect(lg); lg.connect(am.gain); lfo.start(); }
  // 日光燈管：120 Hz 與它的倍頻，很小聲
  L.buzz=gain(0);
  [120,240,360].forEach((f,i)=>{ const o=c.createOscillator(); o.frequency.value=f;
    const g=c.createGain(); g.gain.value=[.5,.25,.08][i]; o.connect(g); g.connect(L.buzz); o.start(); });
  // 通風：帶通的噪音
  L.vent=gain(0);
  { const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=700; bp.Q.value=.6;
    noiseSrc().connect(bp); bp.connect(L.vent); }
  // 人聲：低沉的帶通噪音，音量由 tick 隨機起伏，聽起來像很多人在壓低聲音講話
  L.crowd=gain(0);
  { const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=380; bp.Q.value=1.4;
    const bp2=c.createBiquadFilter(); bp2.type='peaking'; bp2.frequency.value=900; bp2.gain.value=5;
    L.crowdAM=c.createGain(); L.crowdAM.gain.value=.5;
    noiseSrc().connect(bp); bp.connect(bp2); bp2.connect(L.crowdAM); L.crowdAM.connect(L.crowd); }
  // 空襲的嗡鳴：兩個差幾赫茲的鋸齒波互相拍頻，左右聲道之間慢慢移動
  L.drone=gain(0);
  { const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.connect(L.drone);
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan){ pan.connect(lp); L.dronePan=pan; }
    L.droneOsc=[86,91.5].map(f=>{ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
      o.connect(pan||lp); o.start(); return o; }); }
  // 冷藏庫警示：方波，由 tick 開關
  L.alarm=gain(0);
  { const o=c.createOscillator(); o.type='square'; o.frequency.value=1750;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=3200;
    o.connect(lp); lp.connect(L.alarm); o.start(); }
  SND.last.strikes = (typeof S!=='undefined' && S.strikes) || 0;
}
const sndT=()=>SND.ctx.currentTime;
function ramp(param,v,tc){ param.setTargetAtTime(v,sndT(),tc||.25); }

/** 一次性的聲音：噪音或振盪器，經濾波，套一個起音—衰減的包絡 */
function sndBurst({noise=true,freq=60,type='sine',f0,f1,fType='lowpass',fFrom=1200,fTo=150,dur=1,vol=.5,delay=0,pan=0}){
  const c=SND.ctx; if (!c) return;
  const t=sndT()+delay;
  const g=c.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.008);
  g.gain.exponentialRampToValueAtTime(.0005,t+dur);
  let out=g;
  if (pan && c.createStereoPanner){ const p=c.createStereoPanner(); p.pan.value=pan; g.connect(p); out=p; }
  out.connect(SND.master);
  const f=c.createBiquadFilter(); f.type=fType; f.frequency.setValueAtTime(fFrom,t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20,fTo),t+dur*.8); f.connect(g);
  let src;
  if (noise){ src=c.createBufferSource(); src.buffer=SND.noise; src.loop=true; }
  else { src=c.createOscillator(); src.type=type; src.frequency.setValueAtTime(f0||freq,t);
    if (f1) src.frequency.exponentialRampToValueAtTime(f1,t+dur*.9); }
  src.connect(f); src.start(t); src.stop(t+dur+.05);
}
function sndStrike(){
  // 爆炸：寬頻的轟、低頻的悶震，接著一陣碎屑落地（左右散開）
  sndBurst({noise:true,fFrom:2400,fTo:90,dur:3.2,vol:.9});
  sndBurst({noise:false,f0:62,f1:24,dur:1.8,vol:.95,fFrom:400,fTo:200});
  for (let i=0;i<14;i++) sndBurst({noise:true,fType:'highpass',fFrom:2600+Math.random()*2500,fTo:1800,
    dur:.05+Math.random()*.16,vol:.08+Math.random()*.16,delay:.25+Math.random()*1.9,pan:Math.random()*1.6-.8});
  for (let i=0;i<5;i++) sndBurst({noise:true,fFrom:600,fTo:120,dur:.35,vol:.18,delay:.4+Math.random()*1.4,pan:Math.random()*1.2-.6});
}
function sndRelay(){ sndBurst({noise:false,f0:150,f1:90,dur:.09,vol:.35,fFrom:900,fTo:400});
  sndBurst({noise:true,fType:'bandpass',fFrom:2500,fTo:2000,dur:.03,vol:.25}); }

function audioTick(dt, now){
  const c=SND.ctx; if (!c || c.state!=='running') return;
  const L=SND.L, mode=(typeof M!=='undefined' && M.power) ? M.power.mode : 'main';
  const powered = mode==='main' && S.genOn;
  const near=(x,z,r)=>Math.max(0,1-Math.hypot(player.pos[0]-x,player.pos[1]-z)/r);
  // 發電機與燈、通風
  if (powered){
    ramp(L.gen.gain, .035+.13*near(-12,-2.4,20), .4);
    L.genOsc[0].frequency.setTargetAtTime(49,sndT(),.6); L.genOsc[1].frequency.setTargetAtTime(98.6,sndT(),.6);
    ramp(L.buzz.gain,.0045,.3); ramp(L.vent.gain,.022,.5);
  } else {
    // 斷電：引擎減速、慢慢停
    L.genOsc[0].frequency.setTargetAtTime(14,sndT(),.7); L.genOsc[1].frequency.setTargetAtTime(28,sndT(),.7);
    ramp(L.gen.gain,0,.9); ramp(L.buzz.gain,0,.05); ramp(L.vent.gain,0,1.2);
  }
  // 人聲：每 0.3 秒換一個目標音量，靠近公共空間更清楚；停電後一陣騷動再壓低
  SND.last.cr=(SND.last.cr||0)-dt;
  if (SND.last.cr<=0){ SND.last.cr=.3;
    const base=.022+.06*near(1.5,3.5,14), stir=(mode==='cut'?2.2:1);
    ramp(L.crowdAM.gain,(.35+Math.random()*.65)*stir,.15); ramp(L.crowd.gain,base,.6); }
  // 空襲嗡鳴：依威脅段數
  const st=S.stage||1, dv = st===2?.018 : st===3?.06 : 0;
  ramp(L.drone.gain,dv,1.5);
  if (L.dronePan) L.dronePan.pan.setTargetAtTime(Math.sin(now/7000)*(st===3?.8:.4),sndT(),.5);
  L.droneOsc[1].frequency.setTargetAtTime(91.5+Math.sin(now/3100)*1.8,sndT(),.4);
  // 冷藏庫警示：脫離 2–8℃ 時，嗶—嗶—，每 1.4 秒一組
  if (S.fridge>8){
    const ph=(now/1000)%1.4, on=ph<.12||(ph>.22&&ph<.34);
    L.alarm.gain.setTargetAtTime(on ? .006+.05*near(FRIDGE[0],FRIDGE[1],12) : 0, sndT(), .004);
  } else ramp(L.alarm.gain,0,.05);
  // 事件：打擊、緊急照明亮起
  if ((S.strikes||0)>(SND.last.strikes||0)){ SND.last.strikes=S.strikes; sndStrike(); }
  if (mode==='emg' && SND.last.mode==='cut') sndRelay();
  SND.last.mode=mode;
}

function sndSet(on){
  SND.on=on;
  try { localStorage.setItem('stillopen.sound',on?'1':'0'); } catch(e){}
  const b=document.getElementById('btn-snd');
  if (b){ b.setAttribute('aria-pressed',String(on)); b.querySelector('b').textContent=on?'開':'關'; }
  if (on) sndInit();
  if (SND.master) SND.master.gain.setTargetAtTime(on?.6:0,SND.ctx.currentTime,.08);
}
(function bindSound(){
  const start=()=>{ if (SND.on) sndInit(); };
  addEventListener('pointerdown',start,{passive:true});
  addEventListener('keydown',e=>{
    // 跟 main.js 一樣：打字中（含注音、倉頡組字）、按著 Ctrl／Alt／⌘ 時不算
    const el=e.target, typing=!!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName||'') || el.isContentEditable);
    if ((e.key==='m'||e.key==='M') && !typing && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey){
      sndSet(!SND.on); e.preventDefault(); return; }
    start();
  });
  // 切到別的分頁就安靜下來
  document.addEventListener('visibilitychange',()=>{ if (!SND.ctx) return;
    if (document.hidden) SND.ctx.suspend().catch(()=>{}); else if (SND.on) SND.ctx.resume().catch(()=>{}); });
  const b=document.getElementById('btn-snd');
  if (b){ b.onclick=()=>sndSet(!SND.on); sndSet(SND.on); }
})();
