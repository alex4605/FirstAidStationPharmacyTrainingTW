"use strict";
/* 還開著 STILL OPEN — 對話框、版面、事件繫結與啟動 */

/* ---------- 14. 對話框與繫結 ---------- */
function openModal(html,mount){
  $('sheet').innerHTML=html; $('modal').hidden=false;
  S.wasRunning=S.running; S.running=false; syncSpeed();
  if (mount) mount();
  $('sheet').scrollTop=0;
}
function closeModal(resume){
  $('modal').hidden=true;
  if (resume!==false && S.wasRunning && !S.over) S.running=true;
  syncSpeed();
}
function syncSpeed(){
  const map={sp0:0,sp1:1,sp2:2,sp4:4,sp8:8};
  for (const id in map) $(id).setAttribute('aria-pressed',
    (S.running?(S.speed===map[id]&&map[id]!==0):id==='sp0')?'true':'false');
}
function setSpeed(v){ if(v===0) S.running=false; else { S.speed=v; if(!S.over) S.running=true; } syncSpeed(); }
/* 版面斷點：由 layoutClass() 實際量出來，不靠 media query——
   宿主給的版面視窗寬度可能跟螢幕差好幾倍，media query 會整個不成立。 */
const MOBILE = ()=>document.documentElement.classList.contains('narrow');
function layoutClass(){
  const de=document.documentElement;
  const vw = de.clientWidth || window.innerWidth || 0;
  const sw = (window.screen && window.screen.width) || 0;
  const coarse = (window.matchMedia && (matchMedia('(hover:none)').matches
    || matchMedia('(pointer:coarse)').matches)) || ('ontouchstart' in window);
  // 版面視窗比實際螢幕寬 1.6 倍以上，表示宿主沒有套 viewport——以螢幕寬度為準
  let w = vw;
  if (coarse && sw>0 && vw>0 && vw/sw>=1.6) w = sw;
  if (!w) w = 1200;
  const narrow = w<=960;
  const was = de.className;
  de.classList.toggle('narrow', narrow);
  de.classList.toggle('tiny', narrow && w<=430);
  de.classList.toggle('land', narrow && (de.clientHeight||0) < vw);
  // 筆電寬度（1280–1560）：頂列會擠成兩行，把次要的字收起來
  de.classList.toggle('compact', !narrow && w<1560);
  return de.className!==was;
}
function setTab(t){
  S.tab=t; document.body.dataset.tab=t;
  document.querySelectorAll('#tabs button').forEach(b=>
    b.setAttribute('aria-pressed', b.dataset.tab===t?'true':'false'));
  if (renderer) onResize();
}
function renderTabs(){
  const p=pending().length;
  const w=$('tb-work'); if (w) w.textContent=p||'';
  const st=$('tb-stock');
  if (st){ const out=DRUGS.filter(d=>(d.counted?d.have:d.book)<=0).length;
    st.textContent=out?out:''; st.style.color=out?'var(--bad)':''; }
  document.body.classList.toggle('busy', !!S.task);
}
function bind(){
  document.body.dataset.tab='work';
  $('tabs').addEventListener('click',e=>{
    const t=e.target.closest('[data-tab]'); if(!t) return; setTab(t.dataset.tab); });
  $('btn-more').onclick=()=>{
    const on=!document.body.classList.contains('more');
    document.body.classList.toggle('more',on);
    $('btn-more').setAttribute('aria-pressed',on?'true':'false'); };
  document.addEventListener('click',e=>{           // 點空白處收起「⋯」
    if (!e.target.closest('#moreset') && !e.target.closest('#btn-more'))
      document.body.classList.remove('more'); }, true);
  [['sp0',0],['sp1',1],['sp2',2],['sp4',4],['sp8',8]].forEach(([id,v])=>$(id).onclick=()=>setSpeed(v));
  $('seedv').textContent=SEED;
  $('btn-seed').onclick=()=>{
    const url=location.href.split('#')[0]+'#seed='+SEED;   // file:// 的 origin 是 "null"，不能拿來拼網址
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(()=>{});
    log(`本場種子 ${SEED}。同一個種子會生出同一批幫手與同一組事件——連結已複製，可讓整班跑同一場。`,'l-key');
    narrate(`種子 ${SEED}。這一場的人與事，換一個種子就不一樣了。`);
  };
  $('btn-doc').onclick=openDoc;
  $('btn-aar').onclick=()=>{ if(!S.over) openHandover(); else endGame(); };
  $('btn-auto').onclick=()=>{ S.autopause=!S.autopause;
    $('btn-auto').setAttribute('aria-pressed',S.autopause?'true':'false');
    log(S.autopause?'新事件自動暫停：開':'新事件自動暫停：關'); };
  $('btn-bench').onclick=()=>{ player.pos=[BENCH[0],BENCH[1]+2.5]; player.yaw=Math.PI; player.wide=false;
    log('回到調劑檯。'); };
  // 藥品架側欄
  $('stock-rail').onclick=()=>{ shelfUI.collapsed=!shelfUI.collapsed;
    $('stock').classList.toggle('closed',shelfUI.collapsed);
    $('stock-rail').setAttribute('aria-expanded',shelfUI.collapsed?'false':'true');
    onResize(); };
  $('stock-find').oninput=e=>{ shelfUI.q=e.target.value; dirty.stock=true; };
  $('stock-all').onclick=()=>{ Object.keys(CATS).forEach(k=>shelfUI.open[k]=true); dirty.stock=true; };
  $('stock-none').onclick=()=>{ Object.keys(CATS).forEach(k=>shelfUI.open[k]=false); dirty.stock=true; };
  $('stock-lowonly').onchange=e=>{ shelfUI.lowOnly=e.target.checked; dirty.stock=true; };
  $('shelf').addEventListener('click',e=>{
    const g=e.target.closest('[data-grp]'); if(!g) return;
    shelfUI.open[g.dataset.grp]=!shelfUI.open[g.dataset.grp]; dirty.stock=true; uiClock=0; flushUI(); });
  // 右欄的勾選框統一由這一個委派處理。面板重繪不會影響它，
  // 也就不會再發生「重繪把剛勾好的狀態吃掉」這種事。
  $('detail').addEventListener('change', e=>{
    const t=e.target, j=S.jobs.find(x=>x.n===S.sel); if (!j) return;
    const mark=(el,on)=>{ const l=el.closest('.chk')||el.closest('.scopeitem'); if(l) l.classList.toggle('on',on); };
    if (t.dataset.lg!=null){
      const id=t.dataset.lg, k=j.picked.indexOf(id);
      if (t.checked&&k<0){ if (j.mode==='give'&&j.picked.length>=ASK_MAX){ t.checked=false; return; } j.picked.push(id); }
      else if (!t.checked&&k>=0) j.picked.splice(k,1);
      mark(t,t.checked); dirty.detail=true; return;
    }
    if (t.id==='lg-rec'){ j.rec=t.checked; mark(t,t.checked); return; }
    if (t.id==='lg-book'){ j.book=t.checked; mark(t,t.checked); return; }
    if (t.dataset.ck!=null){
      const i=+t.dataset.ck, k=j.picked.indexOf(i);
      if (t.checked&&k<0) j.picked.push(i); else if(!t.checked&&k>=0) j.picked.splice(k,1);
      mark(t,t.checked);
      const g=$('detail').querySelector('[data-cmd="ckgo"]');
      if (g){ const ok=j.picked.length>=j.need;
        g.disabled=!ok; g.style.opacity=ok?'1':'.4'; g.style.cursor=ok?'pointer':'not-allowed'; }
      return;
    }
    if (t.dataset.sc!=null){
      const sc=t.dataset.sc, k=j.scope.indexOf(sc);
      if (t.checked&&k<0) j.scope.push(sc); else if(!t.checked&&k>=0) j.scope.splice(k,1);
      mark(t,t.checked); return;
    }
    if (t.id==='cl-led'){ j.ledger=t.checked; mark(t,t.checked); return; }
    if (t.id==='cl-dual'){
      if (t.checked && S.t>S_MCI.t-2 && S.t<S_MCI.t+40){
        log('現場找不到第二位可核對的人員。','l-warn'); t.checked=false; return; }
      j.dual=t.checked; mark(t,t.checked); return;
    }
  });
  $('qfilter').addEventListener('click',e=>{
    const f=e.target.closest('[data-qf]'); if(!f) return;
    if (f.dataset.qf==='__pend') qFilter.pendOnly=!qFilter.pendOnly;
    else qFilter.kind=f.dataset.qf;
    dirty.q=true; uiClock=0; flushUI();
  });
  document.addEventListener('click',e=>{
    const jb=e.target.closest('[data-j]');
    if (jb){ S.sel=+jb.dataset.j; dirty.q=dirty.detail=dirty.stock=true;
      if (MOBILE()) setTab('act');                 // 手機：點了工作就直接帶你到處置面板
      return; }
    const c=e.target.closest('[data-cmd]'); if (!c) return;
    const cmd=c.dataset.cmd;
    if (cmd==='bgstart') startBg(c.dataset.bgid);
    if (cmd==='rest') startWork('短暫休息',T.rest,()=>{ S.fatigue=Math.max(0,S.fatigue-30);
      log('短暫休息結束。','l-ok'); narrate('你坐了十分鐘。腰還是痠，但視野清楚了一點。'); });
  });
  $('bgbar').addEventListener('click',e=>{
    const ch=e.target.closest('[data-chore]');
    if (ch){
      const rec=S.helpers.find(r=>r.h.id===ch.dataset.chore); if(!rec) return;
      const avail=Object.keys(BGJOBS).filter(k=>
        !((k==='count'&&S.counted)||(k==='ice'&&S.iceReady)||(k==='pack'&&S.packReady)||(k==='tidy'&&S.tidy)));
      openModal(`<h1>交辦給 ${rec.h.name}</h1>
        <p class="kicker">${rec.h.skill}　·　授權範圍：${rec.scope.map(x=>SCOPES[x].n).join('、')||'無'}
          ${rec.briefed?'　·　已完成作業簡介':'　·　<b>未做作業簡介</b>'}</p>
        <div class="note">交出去的雜事${rec.h.ta}會自己做完，不佔用你的時間。
          但<b>${rec.h.ta}做出來的結果你不會在旁邊看著</b>——尤其是盤點，數字錯了比沒數更危險。</div>
        ${avail.length?avail.map(k=>{
          const fit=rec.h.ok.includes(k==='pack'?'pack':'count');
          return `<button class="opt ${fit?'':'bad'}" data-give="${k}">
            <b>${BGJOBS[k].n}</b><span>${BGJOBS[k].hint}　·　
            ${fit?'在能力範圍內':'<b style="color:var(--bad)">這不是對方熟的事</b>'}</span></button>`;}).join('')
          :'<p>目前沒有待辦的雜事。</p>'}
        <div class="btnrow"><button class="gbtn" id="gcancel">算了，我自己來</button></div>`,
        ()=>{ $('sheet').querySelectorAll('[data-give]').forEach(x=>x.onclick=()=>{
              assignChore(rec, x.dataset.give); closeModal(); });
          $('gcancel').onclick=()=>closeModal(); });
      return;
    }
    const b=e.target.closest('[data-bg]'); if(!b||b.disabled) return;
    if (b.dataset.bg==='stop') stopBg(); else startBg(b.dataset.bg);
    dirty.bg=true; uiClock=0; flushUI();
  });
  const MOVE_KEYS=['w','a','s','d','q','e'];
  const typing=el=>!!el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT'||el.isContentEditable);
  const kd=(e,v)=>{ const k=(e.key||'').toLowerCase();
    // 放開按鍵一律要收到，否則人會一直走；按下則要先確認不是在打字、不是瀏覽器快捷鍵
    if (!v){ if (MOVE_KEYS.includes(k)) player.keys[k]=false; return; }
    if (e.ctrlKey||e.metaKey||e.altKey||e.isComposing||typing(e.target)) return;
    const modalOpen=!$('modal').hidden;
    if (MOVE_KEYS.includes(k)){ if (!modalOpen){ player.keys[k]=true; e.preventDefault(); } return; }
    if (modalOpen) return;                       // 對話框開著時，空白鍵不能讓背後的時間偷跑
    if (k==='v'){ player.wide=!player.wide; e.preventDefault(); }
    if (k===' ' && e.target.tagName!=='BUTTON'){ setSpeed(S.running?0:(S.speed||1)); e.preventDefault(); } };
  window.addEventListener('keydown',e=>kd(e,true));
  window.addEventListener('keyup',e=>kd(e,false));
  // 視窗失焦時收不到 keyup：把按住的方向鍵全部放開
  window.addEventListener('blur',()=>{ for (const k in player.keys) player.keys[k]=false; });
  // 對話框點一下就換下一句（給讀得快的人；讀得慢的人就讓它自己走）
  $('speech').onclick=()=>{ speech.until=0; uiClock=0; flushUI(); };
  document.querySelectorAll('#dpad button').forEach(b=>{
    const d=b.dataset.d;
    const on=ev=>{ev.preventDefault();player.keys[d]=true;}, off=ev=>{ev.preventDefault();player.keys[d]=false;};
    b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off);
    b.addEventListener('pointerleave',off); b.addEventListener('pointercancel',off);
  });
}
function start(){
  layoutClass();
  // 第四天了，耗材不是只有藥會少。哪幾樣短缺由種子決定
  ['sharp','label','oral','book'].forEach(k=>{ if (chance(.34)) S.sup[k]=false; });
  // 沒有 WebGL（舊裝置、省電模式、three.js 沒載到）時，站內平面圖看不到，但值班照常進行
  try { init3D(); }
  catch(e){
    console.error(e); renderer=null;
    const st=$('stage'); st.classList.add('no3d');
    $('scene').hidden=true;
    st.insertAdjacentHTML('afterbegin','<div class="no3d-note">這台裝置無法顯示站內 3D 場景。<br>調劑、諮詢與所有決策不受影響。</div>');
  }
  bind(); syncSpeed();
  log('急救站設置參考指引（114 年衛部醫字第 1141669299 號）第一類急救站。');
  Object.keys(SUP_SHORT).forEach(k=>{ if (!S.sup[k]) log('※ '+SUP_SHORT[k],'l-warn'); });
  renderTop(); renderQueue(); renderHelpers(); renderShelf(); renderDetail(); renderLog();
  requestAnimationFrame(loop);
  openBrief();
}
start();
