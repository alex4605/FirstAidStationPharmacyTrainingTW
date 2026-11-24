"use strict";
/* 還開著 STILL OPEN — 介面繪製 */

/* ---------- 13. 介面 ---------- */
const dirty={top:true,q:true,stock:true,detail:true,log:true,helpers:true,bg:true,speech:true};
const $=id=>document.getElementById(id);
const cache={};
function put(id,html){ if(cache[id]===html) return false; cache[id]=html; $(id).innerHTML=html; return true; }
/* 手機的面板比螢幕長。換到下一個互動階段時要把控制項捲進視線——
   不然按了「調劑並交付」，數藥台開在畫面外，會以為什麼都沒發生。 */
function reveal(sel){
  if (!MOBILE()) return;
  uiClock=0; flushUI();
  requestAnimationFrame(()=>{
    const d=$('detail'), t=d&&d.querySelector(sel);
    if (!t) return;
    const dr=d.getBoundingClientRect(), tr=t.getBoundingClientRect();
    if (tr.top < dr.top+8 || tr.bottom > dr.bottom-8) d.scrollTop += tr.top - dr.top - 10;
  });
}
let uiClock=0, holdAt=0;
/* 按下的瞬間先別重繪，免得 DOM 在手指離開前就被換掉。
   但這個「按住」是有時限的：手機上 pointerup／pointercancel 有時根本不會送到
   （webview 手勢接走了），只用事件收尾會把整個介面永久凍住——看起來就是按了沒反應。 */
addEventListener('pointerdown',()=>{holdAt=performance.now();},true);
['pointerup','pointercancel','pointerleave','touchend','touchcancel','mouseup','blur']
  .forEach(ev=>addEventListener(ev,()=>{holdAt=0;},true));
const uiHeld=()=>holdAt>0 && performance.now()-holdAt<420;
function flushUI(){
  const now=performance.now(); if (now-uiClock<210) return; uiClock=now;
  if (dirty.top){ renderTop(); dirty.top=false; }
  if (dirty.q){ renderQueue(); dirty.q=false; }
  if (dirty.stock){ renderShelf(); dirty.stock=false; }
  if (dirty.helpers){ renderHelpers(); dirty.helpers=false; }
  const ae=document.activeElement;
  // 只擋住「正在輸入」的元素；勾選框必須讓它重繪，否則按鈕不會解鎖。
  const busy=uiHeld()||(ae&&(ae.tagName==='SELECT'||ae.tagName==='TEXTAREA'
    ||(ae.tagName==='INPUT'&&ae.type!=='checkbox'))&&$('detail').contains(ae));
  if (dirty.detail&&!busy){ renderDetail(); dirty.detail=false; }
  if (dirty.log){ renderLog(); dirty.log=false; }
  if (dirty.speech){ renderSpeech(); dirty.speech=false; }
  if (dirty.bg||S.bg){ renderBg(); dirty.bg=false; }
  renderTabs();
}
function renderSpeech(){
  const el=$('speech');
  if (!speech.cur){ el.hidden=true; return; }
  const r=speech.cur.who ? (SPEAK_COL[speech.cur.who]||'out') : 'nar';
  el.className='r-'+r; el.hidden=false;
  $('sp-who').textContent=speech.cur.who?speech.cur.who+'：':'';
  $('sp-tx').textContent=speech.cur.text;
}
function renderTop(){
  $('clock').textContent=clock(S.t);
  const f=$('g-fridge'); f.textContent=S.fridge.toFixed(1)+'℃';
  f.className=S.fridge>12?'crit':S.fridge>8?'hot':'';
  const fu=$('g-fuel'); fu.textContent=Math.round(S.fuel)+'L';
  fu.className=S.fuel<20?'crit':S.fuel<60?'hot':'';
  $('g-queue').textContent=pending().length;
  const d=$('expodots').children;
  for (let i=0;i<4;i++) d[i].className=i<S.stage?('on'+(S.stage===4?' s4':'')):'';
  const hf=$('hud-fridge').querySelector('b');
  hf.textContent=S.fridge.toFixed(1)+'℃';
  hf.className=S.fridge>12?'crit':S.fridge>8?'hot':'';
  $('fridge-sub').textContent = MOBILE()
    ? `油 ${Math.round(S.fuel)}L · Ins ${drugById.ins.have} · TT ${drugById.tt.have}`
    : `Insulin ${drugById.ins.have} · TT ${drugById.tt.have} · Oxytocin ${drugById.oxy.have}`;
}
const qFilter={kind:'all', pendOnly:false};
const KN={walk:['巡視','walk'],fu:['後續','fu'],rx:['RX','rx'],con:['CON','con'],edu:['EDU','edu'],emt:['EMT','emt'],emt2:['EMT','emt'],logi:['物流','logi'],lang:['語言','lang'],
  ass:['ASS','ass'],cbr:['CBRNE','cbr'],help:['幫手','help'],crowd:['現場','crowd'],idn:['辨識','idn']};
function renderHelpers(){
  const hm=$('hmeta');
  hm.textContent = S.helpers.length? `${S.helpers.length} 人・已簡介 ${S.briefed}` : '尚無';
  hm.className = S.overAuth?'hot':'';
  const act=S.helpers.filter(r=>r.active).length;
  hm.textContent = S.helpers.length? `在站 ${act} 人・已簡介 ${S.briefed}` : '尚無';
  put('helpers', S.helpers.length ? S.helpers.map(r=>{
    const over=r.scope.filter(s=>r.h.risky.includes(s));
    const busy = !r.active ? `${clock(r.leftAt)} 離開　${r.h.leaveWhy||''}`
      : r.away>0 ? `暫時離開（約 ${Math.ceil(r.away)} 分）`
      : r.job ? `正在調劑 #${String(r.job.j.n).padStart(2,'0')}（剩 ${Math.max(0,r.job.remain).toFixed(0)} 分）`
      : r.edu ? `正在做衛教：${r.edu.j.topic}（剩 ${Math.max(0,r.edu.remain).toFixed(0)} 分）`
      : r.chore ? `${BGJOBS[r.chore.id].n}（剩 ${Math.max(0,r.chore.remain).toFixed(0)} 分）` : null;
    const left = r.active && r.leaveAt<1e8 ? `　·　約待到 ${clock(r.leaveAt)}` : '';
    return `<div class="hrow${r.active?'':' gone'}">
      <span class="hd" style="background:#${r.h.col.toString(16).padStart(6,'0')}${r.active?'':';opacity:.35'}">${r.h.name[0]}</span>
      <span class="hn">${r.h.name}${r.h.lang?`<i class="lgt">${r.h.lang}</i>`:''}<small>${busy||r.h.skill+left}</small></span>
      <span class="hs">${r.scope.map(s=>SCOPES[s].n).join('・')||'未授權'}
        <b class="${!r.active?'idle':over.length?'no':(r.briefed?'':'idle')}">${!r.active?'已離開'
          :over.length?'授權超出範圍':(r.briefed?'已作業簡介':'未作業簡介')}</b></span></div>`;
  }).join('') : `<div style="padding:11px 12px;color:var(--ink-faint);font-size:11.5px">
    地下室裡有兩百多個避難的人。有些人以前做過這一行。<br>他們會自己走過來。</div>`);
}
function renderQueue(){
  // 過濾列：工作變多之後，你需要能只看某一類
  const counts={}; let pend=0;
  S.jobs.forEach(j=>{ const k=j.kind==='emt2'?'emt':j.kind;
    counts[k]=counts[k]||{all:0,p:0}; counts[k].all++;
    if (j.status==='pending'){ counts[k].p++; pend++; } });
  const FK=[['all','全部'],['walk','巡視'],['fu','後續'],['rx','處方'],['con','諮詢'],['edu','衛教'],['emt','EMT'],
    ['ass','支援'],['logi','物流'],['idn','辨識'],['lang','語言'],['crowd','現場'],['cbr','CBRNE'],['help','幫手']];
  put('qfilter', FK.map(([k,n])=>{
    if (k==='all') return `<button class="qf" data-qf="all" aria-pressed="${qFilter.kind==='all'}">全部<b>${pend}</b></button>`;
    const c=counts[k]; if(!c) return '';
    return `<button class="qf ${c.p?'':'zero'}" data-qf="${k}" aria-pressed="${qFilter.kind===k}">${n}<b>${c.p}</b></button>`;
  }).join('') + `<button class="qf" data-qf="__pend" aria-pressed="${qFilter.pendOnly}">只看待處理</button>`);
  const list=S.jobs.filter(j=>{
    const k=j.kind==='emt2'?'emt':j.kind;
    if (qFilter.kind!=='all' && k!==qFilter.kind) return false;
    if (qFilter.pendOnly && j.status!=='pending') return false;
    return true;
  }).sort((a,b)=>{
    const sa=a.status==='pending'?0:1, sb=b.status==='pending'?0:1;
    if (sa!==sb) return sa-sb;
    if (sa===0) return (b.kind==='emt'?2:b.stat?1:0)-(a.kind==='emt'?2:a.stat?1:0) || a.issued-b.issued;
    return b.doneAt-a.doneAt;
  });
  const p=pending().length;
  const q=$('qmeta'); q.textContent=`${p} 項待處理`; q.className=p>=4?'hot':'';
  put('joblist', list.map(j=>{
    const age=Math.round(S.t-j.issued), k=KN[j.kind];
    const kd=`<span class="kind ${k[1]}">${k[0]}</span>`;
    let title='', sub='', who='', chips='';
    if (j.kind==='rx'){
      title=rxName(j); sub=j.dose; who=j.by;
      const fm=RX_FMT[rxFormat(j)].chip;
      chips=[fm?`<span class="chip fmt">${fm}</span>`:'', j.ctrl?'<span class="chip c">管制</span>':'', j.cold?'<span class="chip cold">冷藏</span>':'',
        j.bag?`<span class=chip>藥袋 ${j.bagK}/${j.bagN}</span>`:'',
        j.stat&&j.status==='pending'?'<span class="chip stat">STAT</span>':'',
        j.raised?'<span class="chip ret">幫手攔下</span>':'',
        j.taken&&j.status==='pending'?`<span class="chip">${j.taken.h.name}配製中</span>`:'',
        j.byHelper&&j.status==='done'?`<span class="chip">${j.byHelper}配</span>`:'',
        j.status==='done'?(j.flag?'<span class="chip err">給藥事件</span>':'<span class="chip done">已調劑</span>'):'',
        j.status==='returned'?'<span class="chip ret">已退回</span>':''].join('');
    } else if (j.kind==='walk'){
      title=j.title; sub=placeName(j.zone); who=j.sub==='bed'?j.who:'';
      if (j.status!=='pending') chips=`<span class="chip ${j.status==='done'?'done':'err'}">${j.status==='done'?'已完成':'沒做到'}</span>`;
      else chips=`<span class="chip">剩 ${Math.max(0,Math.round(j.due-S.t))} 分</span>`;
    } else if (j.kind==='fu'){
      title=`#${String(j.src.n).padStart(2,'0')} ${j.src.pat.nm} 的後續`; sub=j.role; who=j.who;
      if (j.status==='done'){ const v=j.opts[j.picked].v;
        chips=`<span class="chip ${v==='good'?'done':v==='mid'?'ret':'err'}">${v==='good'?'已處理':v==='mid'?'紀錄未跟上':'處理不當'}</span>`; }
    } else if (j.kind==='con'){
      title=j.q.length>26?j.q.slice(0,26)+'…':j.q; sub=j.role; who=j.who;
      if (j.status==='done'){ const v=j.opts[j.picked].v;
        chips=`<span class="chip ${v==='good'?'done':v==='mid'?'ret':'err'}">${v==='good'?'回覆正確':v==='mid'?'不完整':'回覆錯誤'}</span>`; }
    } else if (j.kind==='edu'){
      title=j.topic; sub='用藥諮詢與指導'; who=j.pat.nm;
      chips=[j.taken&&j.status==='pending'?`<span class="chip">${j.taken.h.name}衛教中</span>`:'',
        j.byHelper&&j.status==='done'?`<span class="chip">${j.byHelper}</span>`:'',
        j.status==='done'?`<span class="chip ${j.score[1]===0&&j.score[0]>=j.need?'done':'err'}">正確 ${j.score[0]}／錯誤 ${j.score[1]}</span>`:''].join('');
    } else if (j.kind==='ass'){
      title=j.title; sub='支援性作業（非本職，但你幫得上忙）'; who=j.who;
      if (j.status==='done') chips=`<span class="chip ${j.score[1]===0&&j.score[0]>=j.need?'done':'err'}">正確 ${j.score[0]}／錯誤 ${j.score[1]}</span>`;
    } else if (j.kind==='logi'){
      title=j.c.f; sub=j.mode==='give'?'物流到訪　·　來補給':'物流到訪　·　來徵調'; who=j.c.who;
      if (j.status==='done') chips=`<span class="chip ${j.recAt?'done':'ret'}">${
        j.mode==='give'?'已接收':'已處理徵調'}${j.recAt?'・有紀錄':'・無紀錄'}</span>`;
    } else if (j.kind==='idn'){
      title=`${j.items.length} 項不熟悉的包裝`; sub=`待辨識區　·　${j.from}`; who=j.who;
      if (j.status==='done') chips=`<span class="chip ${j.skipped?'err':'done'}">${j.skipped?'未辨識即上架':'已辨識上架'}</span>`;
    } else if (j.kind==='crowd'){
      title=j.title; sub='領藥窗口　·　現場狀況'; who=j.who;
      chips=[j.helperTook&&j.status==='pending'?`<span class="chip">${j.helperTook}已到場</span>`:'',
        j.status==='done'?`<span class="chip ${j.score[2]?'err':(j.score[1]===0&&j.score[0]>=j.need?'done':'ret')}">${
          j.score[2]?'以藥處理情緒':(j.score[1]===0&&j.score[0]>=j.need?'處理適當':'不完整')}</span>`:''].join('');
    } else if (j.kind==='lang'){
      title=j.nm||'語言不通的病人'; sub=`領藥窗口　·　${j.flagTxt}`; who=j.who;
      if (j.status==='done') chips=`<span class="chip ${j.score&&j.score[2]?'err':
        (j.score&&j.score[1]===0&&j.score[0]>=j.need?'done':'ret')}">${j.score&&j.score[2]?'涉及身分推測':
        (j.score&&j.score[1]===0&&j.score[0]>=j.need?'完整':'不完整')}</span>`;
    } else if (j.kind==='emt2'){
      title=j.title; sub='EMT-2 支援　·　'+zoneById[j.zone].name; who=j.who;
      if (j.status==='done'){ const v=j.opts[j.picked].v;
        chips=`<span class="chip ${v==='good'?'done':v==='mid'?'ret':'err'}">${v==='good'?'處置正確':v==='mid'?'不完整':'處置錯誤'}</span>`; }
    } else if (j.kind==='help'){
      title=`${j.h.name}（${j.h.tag}）`; sub='有人走過來說想幫忙'; who='避難民眾';
      if (j.status==='done') chips=j.declined?'<span class="chip ret">已婉拒</span>'
        :`<span class="chip ${(j.scope||[]).some(s=>j.h.risky.includes(s))?'err':'done'}">${(j.scope||[]).length?'已授權':'未授權'}</span>`;
    } else {
      title=j.title;
      sub=`${j.kind==='cbr'?'CBRNE 應變':'EMT-2 現場處置'}　步驟 ${Math.min(j.step+1,j.steps.length)}／${j.steps.length}`;
      who=zoneById[j.zone]?zoneById[j.zone].name:'';
      if (j.status==='done'){ const g=j.res.filter(r=>r.v==='good').length;
        chips=`<span class="chip ${g===j.steps.length?'done':'err'}">${g}／${j.steps.length}</span>`; }
    }
    const pat = j.kind==='rx' ? `${j.pat.age}歲${j.pat.sex}・${j.pat.wt}kg・${j.pat.dx}`
      : j.kind==='edu' ? `${j.pat.age}歲${j.pat.sex}・${j.pat.dx}`
      : j.kind==='con' ? (j.ctx||'')
      : j.kind==='fu' ? j.q.slice(0,34)+'…'
      : j.kind==='walk' ? (j.sub==='bed'?`${j.src.dose}`:'每兩小時一次')
      : j.kind==='ass' ? j.ask.slice(0,38)+'…'
      : j.kind==='logi' ? (j.mode==='give'?j.c.give:j.c.take).slice(0,34)+'…'
      : j.kind==='idn' ? j.items.map(x=>x.brand.split('（')[0]).join('、').slice(0,34)+'…'
      : j.kind==='crowd' ? j.intro.replace(/<[^>]+>/g,' ').slice(0,34)+'…'
      : j.kind==='lang' ? `${j.age}歲${j.sex}・${j.dx}`
      : j.kind==='emt2' ? `「${j.ask.slice(0,30)}…」`
      : j.kind==='help' ? `「${j.h.say.slice(0,26)}…」`
      : j.intro.slice(0,34)+'…';
    return `<button class="job k-${j.kind} ${j.status!=='pending'?'done':''}"
      data-j="${j.n}" aria-selected="${S.sel===j.n}">
      <span class="j-h"><b>${kd}#${String(j.n).padStart(2,'0')}${j.kind==='rx'?'　'+j.pat.nm:''}</b><span>${who}</span></span>
      <span class="j-t">${title}${chips}</span><span class="j-s">${sub}</span>
      <span class="j-p">${pat}</span>
      ${j.status==='pending'?`<span class="age ${age>25?'late':''}">等待 ${age} 分</span>`:''}
    </button>`;
  }).join('') || `<div style="padding:14px;color:var(--ink-faint)">${
    qFilter.kind==='all'&&!qFilter.pendOnly?'尚無工作項目。':'這個篩選下沒有項目。'}</div>`);
}
const shelfUI = {open:{}, q:'', lowOnly:false, collapsed:false};
Object.keys(CATS).forEach(k=>shelfUI.open[k]=true);
function renderShelf(){
  const qtyOf = d => d.counted ? d.have : d.book;      // 沒盤點就只能看帳面
  const low = DRUGS.filter(d=>qtyOf(d)>0 && qtyOf(d)/d.q<.3).length;
  const out = DRUGS.filter(d=>qtyOf(d)<=0).length;
  const sm=$('stockmeta');
  sm.textContent = out?`${out} 項歸零・${low} 項偏低`:(low?`${low} 項低於三成`:'7 日儲備');
  sm.className = out?'hot':'';
  const badge=$('stock-badge');
  badge.textContent = out?`${out}空`:(low?`${low}低`:DRUGS.length);
  badge.className = 'rn'+((out||low)?' hot':'');
  // 選到的處方品項會被highlight，並自動展開所在分類
  const selJ = S.jobs.find(x=>x.n===S.sel);
  const hi = selJ && selJ.kind==='rx' ? selJ.drug.id : null;
  if (hi && shelfUI.q==='') shelfUI.open[drugById[hi].cat] = true;
  const q = shelfUI.q.trim().toLowerCase();
  const match = d => !q || (d.n+' '+CATS[d.cat].n+' '+d.f+' '+(d.note||'')).toLowerCase().includes(q);
  const keep = d => match(d) && (!shelfUI.lowOnly || d.have/d.q<.3);
  let html='', shown=0;
  for (const ck of Object.keys(CATS)){
    const list = DRUGS.filter(d=>d.cat===ck && keep(d));
    if (!list.length) continue;
    shown += list.length;
    const gl = list.filter(d=>qtyOf(d)>0 && qtyOf(d)/d.q<.3).length;
    const go = list.filter(d=>qtyOf(d)<=0).length;
    const openG = q ? true : shelfUI.open[ck];
    html += `<button class="dgrp" data-grp="${ck}" aria-expanded="${openG}">
      <i style="background:${CATS[ck].c}"></i><span class="gn">${CATS[ck].n}</span>
      <span class="gc">${list.length}${go?`　<b style="color:var(--bad)">${go}空</b>`:''}${gl?`　<b>${gl}低</b>`:''}</span>
      <span class="gx">${openG?'▾':'▸'}</span></button>`;
    if (!openG) continue;
    html += list.map(d=>{
      const v=qtyOf(d), r=v/d.q, cls=v<=0?'out':(r<.3?'low':'');
      const tags=[d.st==='cold'?'冷藏':'', d.st==='ctrl'?'管制':'',
        d.pk?(d.pk.type==='blister'?`排裝 ${d.pk.per}／排`:'罐裝'):''].filter(Boolean).join('・');
      return `<div class="drow ${cls} ${d.counted?'':'unc'} ${d.id===hi?'hi':''}"
        title="${d.n}｜${CATS[d.cat].n}・${d.f}${tags?'・'+tags:''}${d.note?'・'+d.note:''}｜${d.counted?'實際':'帳面'} ${v} / 七日儲備 ${d.q} ${d.u}${d.counted?'':'（尚未盤點，帳面未必準）'}">
        <i style="background:${CATS[d.cat].c}"></i>
        <span class="dn">${d.n}<small>${d.f}${tags?'・'+tags:''}${d.note?'・'+d.note:''}</small></span>
        <span class="dq"><b>${v}</b>/${d.q}</span></div>`;
    }).join('');
  }
  if (!shown) html = `<div class="dempty">沒有符合「${shelfUI.q}」的品項。</div>`;
  put('shelf', html);
  // 換到另一張處方時，把該品項捲到看得見的地方（只做一次，不打斷你自己的捲動）
  if (hi && hi!==shelfUI.lastHi){
    shelfUI.lastHi = hi;
    const el = $('shelf').querySelector('.drow.hi');
    if (el) el.scrollIntoView({block:'center'});
  } else if (!hi) shelfUI.lastHi = null;
}
function renderLog(){
  const el=$('log');
  if (put('log', S.log.slice(-80).map(l=>`<div class="${l.c}"><b>${l.t}</b>${l.m}</div>`).join('')))
    el.scrollTop=el.scrollHeight;
}
function renderDetail(){
  if (S.task){
    const pct=Math.max(0,Math.min(100,(1-S.task.remain/S.task.total)*100));
    if (put('detail',`<div class="pane"><h2>作業中</h2><div class="sub">${S.task.n}</div>
      <div class="note">剩餘 <b>${Math.max(0,S.task.remain).toFixed(1)}</b> 分鐘
        <div style="height:5px;background:#0c1012;border:1px solid var(--line);margin-top:8px">
          <i style="display:block;height:100%;width:${pct.toFixed(0)}%;background:var(--amber)"></i></div></div>
      ${S.running?'<div class="note warn">每一項工作都要時間。趕，就是錯誤的來源。</div>'
        :`<div class="note warn"><b>時間是停的，作業不會前進。</b>
          <div class="btnrow" style="margin-top:8px"><button class="pbtn" data-cmd="resume">繼續</button></div></div>`}
      </div>`)){
      const r=$('detail').querySelector('[data-cmd="resume"]');
      if (r) r.onclick=()=>setSpeed(S.speed||1);
    }
    return;
  }
  const j=S.jobs.find(x=>x.n===S.sel);
  if (!j){ put('detail', idlePane()); return; }
  if (j.kind==='rx') return renderRx(j);
  if (j.kind==='con') return renderCon(j);
  if (j.kind==='edu') return renderEdu(j);
  if (j.kind==='emt'||j.kind==='cbr') return renderEmt(j);
  if (j.kind==='ass') return renderAss(j);
  if (j.kind==='emt2') return renderEmt2(j);
  if (j.kind==='logi') return renderLogi(j);
  if (j.kind==='lang') return renderLang(j);
  if (j.kind==='crowd') return renderCrowd(j);
  if (j.kind==='idn') return renderIdn(j);
  if (j.kind==='help') return renderHelp(j);
  if (j.kind==='fu') return renderFu(j);
  if (j.kind==='walk') return renderWalk(j);
}

/* 諮詢與 EMT-2 求援共用同一種版型：情境 → 單選 → 回饋。
   以前是兩份幾乎一樣的程式碼，現在只有一份。 */
function renderChoiceJob(j, cfg){
  const done=j.status==='done';
  let h=`<div class="pane"><h2>${cfg.title}</h2><div class="sub">${cfg.sub}</div>
    <div class="paper" data-t="${cfg.paper}">${cfg.rows}</div>${cfg.pre||''}`;
  if (done){
    const o=j.opts[j.picked];
    h+=`<div class="note ${o.v==='good'?'ok':o.v==='mid'?'warn':''}"
      style="${o.v==='bad'?'border-left-color:var(--bad)':''}">
      <b>${cfg.doneLabel}</b><br>${o.t}<br><br>${o.fb}</div></div>`;
    put('detail',h); return;
  }
  h+=`<div class="acts">${j.opts.map((o,i)=>
    `<button class="opt" data-choice="${i}"><b>${o.t}</b></button>`).join('')}</div>
    <div class="note">${cfg.foot}</div></div>`;
  if (put('detail',h)) $('detail').querySelectorAll('[data-choice]').forEach(btn=>
    btn.onclick=()=>cfg.submit(j, +btn.dataset.choice));
}
function renderCon(j){
  renderChoiceJob(j, {
    title:`諮詢 #${String(j.n).padStart(2,'0')}`,
    sub:`${j.who}（${j.role}）· ${clock(j.issued)}${j.status==='done'?'　·　已回覆':'　·　人在領藥窗口等你'}`,
    paper:'諮詢',
    rows:`<div class="prow"><span>來源</span><b>${j.who}</b></div>
      <div class="prow"><span>問題</span><b class="big" style="font-size:12.5px;line-height:1.5">${j.q}</b></div>
      ${j.ctx?`<div class="prow"><span>你手上的資訊</span><b style="color:var(--ink-dim)">${j.ctx}</b></div>`:''}`,
    pre: j.needCount?`<div class="note ${S.counted?'ok':'warn'}">${S.counted
      ?'你今天已完成盤點，可以給出清單。':'你今天還沒盤點——沒有盤點的人只能給印象，不能給清單。'}</div>`:'',
    doneLabel:'你的回覆', foot:`回覆需要 ${T.con} 分鐘。這段時間佇列不會停。`,
    submit:answerConsult});
}
function renderEmt2(j){
  renderChoiceJob(j, {
    title:j.title,
    sub:`EMT-2 支援　·　${j.who}　·　${zoneById[j.zone].name}　·　${clock(j.issued)}`,
    paper:'求援',
    rows:`<div class="prow"><span>${j.who}</span><b style="color:var(--ink-dim);font-weight:400">「${j.ask}」</b></div>`,
    doneLabel:'你的回應',
    foot:`你持有 EMT-2：評估、給氧、基本氣道、CPR 與 AED、止血固定、建立靜脈路徑與輸液都在範圍內。
      但「別人抽好的藥」不能直接接手就打，調整輸液速率與給藥仍需醫囑。<br>
      <span style="color:var(--ink-faint)">答應了就要離開藥局幾分鐘。佇列目前 ${pending().length} 項。</span>`,
    submit:answerEmt2});
}

function renderChecklistJob(j, cfg){
  const done=j.status==='done';
  let h=`<div class="pane"><h2>${cfg.title}</h2>
    <div class="sub">${cfg.sub}</div>
    <div class="paper" data-t="${cfg.paper}">${cfg.rows}</div>
    ${cfg.pre||''}`;
  if (done){
    const bad=j.score[1], extra=cfg.doneExtra?cfg.doneExtra(j):'';
    h+=`<div class="note ${bad===0&&j.score[0]>=j.need?'ok':'warn'}"
      style="${(j.score[2]||0)?'border-left-color:var(--bad)':''}">
      ${cfg.doneLabel||'正確做法'} <b>${j.score[0]}</b>　${cfg.badLabel||'錯誤做法'} <b>${bad}</b>${
        (j.score[2]||0)?`　·　<b style="color:var(--bad)">其中 ${j.score[2]} 項涉及身分推測</b>`:''}<br>
      ${j.picked.map(i=>`${j.pts[i].ok?'✓':'✗'} ${j.pts[i].t}`).join('<br>')}</div>
      <div class="note">完整的正確做法：<br>${j.pts.filter(p=>p.ok).map(p=>'・'+p.t).join('<br>')}</div>${extra}</div>`;
    put('detail',h); return;
  }
  h+=`<div class="note">${cfg.hint}</div>
    <div class="acts">${j.pts.map((p,i)=>
      `<label class="chk ${j.picked.includes(i)?'on':''}"><input type="checkbox" data-ck="${i}" ${j.picked.includes(i)?'checked':''}>
        <span>${p.t}</span></label>`).join('')}</div>
    ${cfg.gate && !atPlace(cfg.gate) ? `<div class="note warn">${j.pat.nm} 在${placeName(cfg.gate)}。用藥指導要當面做——走到床邊，才能完成。</div><div class="acts">${walkBtn(cfg.gate)}</div>` : ''}
    <div class="btnrow"><button class="pbtn" data-cmd="ckgo" ${j.picked.length>=j.need&&!(cfg.gate&&!atPlace(cfg.gate))?'':'disabled'}
      style="${j.picked.length>=j.need&&!(cfg.gate&&!atPlace(cfg.gate))?'':'opacity:.4;cursor:not-allowed'}">${cfg.go}</button></div></div>`;
  if (put('detail',h)){
    $('detail').querySelector('[data-cmd="ckgo"]').onclick=()=>{
      if (j.picked.length>=j.need && !(cfg.gate && !atPlace(cfg.gate))) cfg.submit(j); };
  }
}
function renderEdu(j){
  renderChecklistJob(j, {
    title:`用藥指導 #${String(j.n).padStart(2,'0')}`,
    sub:`${j.pat.nm}　${j.pat.age}歲${j.pat.sex}　· ${j.topic}`, paper:'衛教',
    rows:`<div class="prow"><span>對象</span><b>${j.pat.nm}　${j.pat.dx}</b></div>
      <div class="prow"><span>情境</span><b style="color:var(--ink-dim);font-weight:400">${j.ask}</b></div>`,
    hint:`選出你要強調的重點（至少 ${j.need} 項）。<b>選到錯誤的衛教內容會扣分</b>——說錯比沒說更糟。`,
    gate: eduPlace(j),
    doneLabel:'正確重點', badLabel:'錯誤內容', go:'完成用藥指導', submit:answerEdu});
}
function renderAss(j){
  const helper=activeWith('draw')||activeWith('pack');
  renderChecklistJob(j, {
    title:j.title, sub:`支援性作業　·　${j.who} 請託　·　${clock(j.issued)}`, paper:'支援',
    rows:`<div class="prow"><span>情境</span><b style="color:var(--ink-dim);font-weight:400">${j.ask}</b></div>`,
    pre: helper?`<div class="note ok">${helper.h.name} 可以協助，作業時間縮短。</div>`:'',
    hint:`選出你要做的項目（至少 ${j.need} 項）。<b>做錯的項目會扣分</b>——幫忙幫錯比不幫更麻煩。`,
    doneLabel:'正確做法', badLabel:'錯誤做法', go:'開始作業', submit:answerAssist});
}
/* 站內剛好有人的語言對得上的時候，那是今天最實在的一件事。
   幫手是陸續到的，所以每次打開這張單子都重新看一次現場有誰。
   只有在你還沒開始勾選之前會加進清單，加進去之後就固定住。 */
function tryTranslator(j){
  if (j.helperTr || (j.picked&&j.picked.length)) return;
  const want = j.tr||[];
  const tr = S.helpers.find(x=>x.active && !x.away && x.h.lang && want.includes(x.h.lang));
  if (!tr) return;
  j.helperTr = tr.h.name; j.trLang = tr.h.lang;
  j.pts = [{t:`請站內的 ${tr.h.name}（會講${tr.h.lang}）協助通譯，並請通譯者與病人各複誦一次`,ok:true}]
    .concat(j.pts);
  log(`${tr.h.name} 會講${tr.h.lang}——${tr.h.ta}可以幫這一位。`,'l-key');
  dirty.detail=true;
}
function renderLang(j){
  if (j.status==='pending') tryTranslator(j);
  renderChecklistJob(j, {
    title:`${j.nm}　<span style="font-size:11px;color:var(--ink-faint)">${j.flagTxt}</span>`,
    sub:`${j.who}　·　${j.age}歲${j.sex}　${j.wt} kg　·　領藥窗口　·　${clock(j.issued)}`, paper:'領藥窗口',
    rows:`<div class="prow"><span>情況</span><b style="color:var(--ink-dim);font-weight:400">${j.intro}</b></div>
      <div class="prow"><span>診斷</span><b>${j.dx}</b></div>`,
    pre: (j.helperTr?`<div class="note ok"><b>${j.helperTr}</b> 會講${j.trLang}。
      人就在站內——這一題你不必自己猜。</div>`:'')
      + (j.intro2?`<div class="note warn">有人在問他是哪邊的人。<b>依醫療需求施救、不因身分區別，是不可協商的原則。</b>
      你的紀錄會被看見，也會被引用。</div>`:''),
    hint:`這一題從頭到尾都在你的桌子上。語言不通不會改變你要回答的三個問題：
      <b>對方吃過什麼、對什麼過敏、你能不能安全地給出下一劑。</b><br>
      選出你要採取的做法（至少 ${j.need} 項）。`,
    doneLabel:'正確做法', badLabel:'不當做法', go:'開始',
    doneExtra:jj=>jj.coda?`<div class="note" style="border-left-color:var(--amber)">${jj.coda}</div>`:'',
    submit:answerLang});
}

function renderLogi(j){
  const c=j.c, give=j.mode==='give', done=j.status==='done';
  let h=`<div class="pane"><h2>${c.f}</h2>
    <div class="sub">${c.who}　·　車道口　·　${clock(j.issued)}　·　${give?'補給到站':'前來徵調'}</div>
    <div class="paper" data-t="${give?'補給':'徵調'}"><div class="prow"><span>${c.who}</span>
      <b style="color:var(--ink-dim);font-weight:400">「${give?c.give:c.take}」</b></div></div>`;
  if (done){
    h+=`<div class="note ${give?(j.credible?'ok':'warn'):''}">
      ${give ? (j.got&&j.got.length?`收到：<b>${j.got.join('、')}</b>${j.credible?'':'<br>因為沒有盤點，只能領到標準包，數量明顯偏低。'}`:'你沒有提出任何品項。車走了。')
             : (j.gave&&j.gave.length?`調出：<b>${j.gave.join('、')}</b>
                 ${j.listAt?'<br>依對方的書面需求清單辦理。':'<br><b style="color:var(--warn)">沒有需求清單。</b>'}
                 ${j.recAt?'<br>已完成移轉紀錄與雙方簽收。':'<br><b style="color:var(--warn)">未辦理移轉紀錄。</b>'}
                 ${j.picked&&j.picked.some(id=>drugById[id]&&drugById[id].st==='ctrl')
                   ? (j.bookAt?'<br>管制藥品已逐筆登記於簿冊。':'<br><b style="color:var(--bad)">管制藥品未登記簿冊。</b>'):''}`
               :'你拒絕了這次徵調。')}
      ${j.whyAt?`<br><br>你的理由：${j.whyAt}`:''}</div></div>`;
    put('detail',h); return;
  }
  h+=`<div class="note ${S.counted?'ok':'warn'}">${S.counted
    ? '你今天盤點過，說得出每一項的實際數量——這是你在這張桌子上唯一的籌碼。'
    : '<b>你今天還沒盤點。</b>你講不出數量，對方只能照標準包給你；被徵調時你也不知道自己讓出去的是不是最後一批。'}</div>
    <div class="note">${give?`勾選你要請求的品項（最多 ${ASK_MAX} 項）。說得出理由與數量的人，拿到的比較多。`
      :'勾選你<b>同意調出</b>的品項。全部不勾＝拒絕，但拒絕也要給理由。耗材類不在徵調範圍。'}
      <br><span style="color:var(--ink-faint)">已勾 <b>${j.picked.length}</b>${give?` / ${ASK_MAX}`:''} 項</span></div>
    ${ASK_GROUPS.map(g=>{
      const items=ASK_ITEMS.filter(it=>it.g===g && (give || !it.sup));
      if (!items.length) return '';
      return `<div class="askg">${g}</div><div class="acts">${items.map(it=>{
        const d=drugById[it.id], v=d?(d.counted?d.have:d.book):null;
        const sk=SUP_KEY[it.id], short=sk&&!S.sup[sk];
        const on=j.picked.includes(it.id);
        const full=!on && give && j.picked.length>=ASK_MAX;
        return `<label class="chk ${on?'on':''}${full?' dim':''}">
          <input type="checkbox" data-lg="${it.id}" ${on?'checked':''} ${full?'disabled':''}>
          <span><b>${it.n}</b>${it.ctrl?' <span class="chip c">管制</span>':''}${it.sup?' <span class="chip">耗材</span>':''}
          <small>${it.why}${d?`　·　目前${d.counted?'實際':'帳面'} ${v} ${it.u}${v<=0?'　<b style="color:var(--bad)">已歸零</b>':(v/d.q<.3?'　<b style="color:var(--warn)">低於三成</b>':'')}`
            :(sk?(short?'　·　<b style="color:var(--bad)">目前不足</b>':'　·　目前夠用'):'')}</small></span></label>`;
      }).join('')}</div>`;}).join('')}
    ${!give?`
      <div class="note ${(j.hasList||j.askedList)?'ok':'warn'}">
        <b>對方的書面需求清單</b><br>${(j.hasList||j.askedList)
          ? `已取得。上面寫的是：${(j.listItems||[]).join('、')}。<br>
             <span style="color:var(--ink-faint)">有清單，你才知道自己讓出去的是不是他們真正需要的，也才有依據保留本站的量。</span>`
          : `${j.who||c.who} 沒有帶，只說「上面交代的」「你就給一點」。<br>
             <span style="color:var(--ink-faint)">沒有清單的調撥，日後對不上的時候，說不清楚的是你。</span>`}
        ${(j.hasList||j.askedList)?'':`<div class="btnrow" style="margin-top:8px">
          <button class="gbtn" data-cmd="lglist">要求對方補一張需求清單（${T.reqList} 分鐘）</button></div>`}
      </div>
      <label class="chk ${j.rec?'on':''}" style="margin-top:6px"><input type="checkbox" id="lg-rec" ${j.rec?'checked':''}>
        <span><b>辦理移轉紀錄與雙方簽收</b><small>調撥沒有這一步，帳就永遠對不起來</small></span></label>
      ${j.picked.some(id=>drugById[id]&&drugById[id].st==='ctrl')?`
      <label class="chk ${j.book?'on':''}"><input type="checkbox" id="lg-book" ${j.book?'checked':''}>
        <span><b>於管制藥品簿冊逐筆登記移轉</b><small>品項、數量、批號、去向單位、雙方姓名與時間${
          S.sup.book?'':'　<b style="color:var(--warn)">（簿冊只剩最後幾頁）</b>'}</small></span></label>`:''}`:''}
    <div class="field"><label>${give?'你的請求理由與數量依據':'同意或拒絕的理由'}</label>
      <textarea id="lg-why" placeholder="${give?'例：Insulin 全站剩 2 支，站內有 2 名胰島素依賴者與 1 名高血鉀，請求補 10 支。'
        :'例：TXA 可調出三分之一；Morphine 為本站最主要的強效止痛，且今日已有 1 名重傷，無法調出。'}">${j.why||''}</textarea></div>
    <div class="btnrow"><button class="pbtn" data-cmd="lggo">${give?'提出請求':'回覆對方'}</button></div></div>`;
  if (put('detail',h)){
    // j 是單一真相來源：勾選狀態由 onchange 維護，送出時不要再從 DOM 回讀覆蓋
    $('detail').querySelector('[data-cmd="lggo"]').onclick=()=>{
      const w=$('lg-why'); if (w) j.why=esc((w.value||'').trim());
      answerLogi(j); };
    const lb=$('detail').querySelector('[data-cmd="lglist"]');
    if (lb) lb.onclick=()=>{
      const w=$('lg-why'); if (w) j.why=esc((w.value||'').trim());
      startWork(`要求 ${j.c.f} 補一張書面需求清單`, T.reqList, ()=>{
        j.askedList=true;
        mark('P14', true, `${j.c.f} 徵調：要求對方提出書面需求清單後才進行調撥`);
        log(`${j.c.f} 補了一張需求清單過來。`,'l-ok');
        say(j.c.who, '好，我寫給你。上面缺的就是這幾樣。', 5200);
        dirty.detail=true; }); };
  }
}
function renderHelp(j){
  const h=j.h;
  let head=`<div class="pane"><h2>${h.name}　<span style="font-size:11px;color:var(--ink-faint)">${h.age} 歲</span></h2>
    <div class="sub">${h.tag}　·　${clock(j.issued)}　·　領藥窗口</div>
    <div class="paper" data-t="自述"><div class="prow"><span>${h.ta}說</span>
      <b style="color:var(--ink-dim);font-weight:400">「${h.say}」</b></div>
      <div class="prow"><span>你注意到</span><b style="color:var(--ink-faint);font-weight:400">${h.quirk||'—'}</b></div>
      ${h.lang?`<div class="prow"><span>順帶一提</span><b style="color:var(--cold);font-weight:400">${h.ta}會講${h.lang}——今天可能用得上。</b></div>`:''}
      <div class="prow"><span>能待多久</span><b style="color:var(--ink-faint);font-weight:400">${
        h.stayMin>=999?'說可以待到白班結束。':`說大概 ${Math.round(h.stayMin/60*10)/10} 小時。「${h.leaveWhy}」`}</b></div></div>`;
  if (j.status==='done'){
    head += j.declined
      ? `<div class="note">你婉拒了${h.ta}的協助。<br><br>${h.verifyTxt}</div></div>`
      : `<div class="note ${(j.scope||[]).some(s=>h.risky.includes(s))?'':'ok'}"
           style="${(j.scope||[]).some(s=>h.risky.includes(s))?'border-left-color:var(--bad)':''}">
          <b>查核</b>　${j.verified==='doc'?'已查驗證件與經歷':'僅聽其自述'}<br>${h.verifyTxt}<br><br>
          <b>授權範圍</b>　${(j.scope||[]).map(s=>SCOPES[s].n).join('、')||'不授權任何項目'}<br>
          <b>作業簡介</b>　${j.briefed?'已完成':'未做'}</div></div>`;
    put('detail',head); return;
  }
  if (j.stage==='meet'){
    head+=`<div class="note">指引伍、一與行政區說明要求：<b>確認新進醫事人員之職業類別與有效執照，以及作業簡介</b>。
      口說無憑不是懷疑人，是流程。</div>
      <div class="acts">
        <button class="opt" data-hv="doc"><b>請${h.ta}出示證件，並追問經歷細節</b><span>${T.verify} 分鐘。你會知道${h.ta}到底是誰。</span></button>
        <button class="opt" data-hv="trust"><b>人手不夠，先讓${h.ta}上工再說</b><span>${T.verifyFast} 分鐘。省下的時間，可能要用別的東西付。</span></button>
        <button class="opt" data-hv="no"><b>婉拒</b><span>你不需要為任何人的好意負責，但你少了一雙手。</span></button>
      </div></div>`;
    if (put('detail',head)) $('detail').querySelectorAll('[data-hv]').forEach(b=>b.onclick=()=>{
      if (b.dataset.hv==='no') helperDecline(j); else helperVerify(j,b.dataset.hv); });
    return;
  }
  if (j.stage==='scope'){
    head+=`<div class="note ${j.verified==='doc'?(h.verify==='good'?'ok':'warn'):'warn'}"
      style="${j.verified==='doc'&&h.verify==='bad'?'border-left-color:var(--bad)':''}">
      <b>查核結果</b><br>${j.verified==='doc'?h.verifyTxt:'你沒有查核。你只知道對方自稱是什麼。'}</div>
      <div class="note">勾選你要授權的項目。<b>授權超出對方資格或能力的項目會直接記入 P10</b>，而且${h.ta}真的會去做。</div>
      <div class="scopegrid">${Object.keys(SCOPES).map(s=>{
        const risky=h.risky.includes(s);
        return `<label class="scopeitem ${risky?'risky':''} ${j.scope.includes(s)?'on':''}">
          <input type="checkbox" data-sc="${s}" ${j.scope.includes(s)?'checked':''}>
          <span><b>${SCOPES[s].n}</b><small>${SCOPES[s].d}</small></span></label>`;}).join('')}</div>
      <div class="btnrow"><button class="pbtn" id="scgo">確認授權範圍</button>
        <button class="gbtn" id="scno">還是婉拒</button></div></div>`;
    if (put('detail',head)){
      $('scgo').onclick=()=>helperAuthorize(j);
      $('scno').onclick=()=>helperDecline(j);
    }
    return;
  }
  // brief
  head+=`<div class="note ok"><b>${h.name} 已加入。</b>授權範圍：${j.scope.map(s=>SCOPES[s].n).join('、')||'無'}</div>
    <div class="note">指引要求的最後一步是<b>作業簡介與共識討論</b>：動線、品項在哪一層架上、標示規則、
      以及最重要的那一句——<b>遇到不確定就停下來問我</b>。${h.needBrief?`<br><br>${h.ta}對本站的品項與流程還不熟。這 ${T.brief} 分鐘不是客套。`:''}</div>
    <div class="acts">
      <button class="opt" data-hb="1"><b>做作業簡介（${T.brief} 分鐘）</b><span>花掉的時間，會從${h.ta}之後幫你省下的時間裡拿回來。</span></button>
      <button class="opt" data-hb="0"><b>先讓${h.ta}上工，邊做邊教</b><span>佇列還在長高。你現在沒有 ${T.brief} 分鐘。</span></button>
    </div></div>`;
  if (put('detail',head)) $('detail').querySelectorAll('[data-hb]').forEach(b=>b.onclick=()=>
    helperBrief(j, b.dataset.hb==='1'));
}
function stepper(key, val, wide, slim){
  return `<span class="stp">${slim?'':`<button data-st="${key}" data-v="-10">−10</button>`}
    <button data-st="${key}" data-v="-1">−</button>
    <input type="text" inputmode="numeric" data-set="${key}" value="${val}" class="${wide?'w':''}">
    <button data-st="${key}" data-v="1">＋</button>
    ${slim?'':`<button data-st="${key}" data-v="10">＋10</button>`}</span>`;
}
function renderRx(j){
  const p=j.pat, age=Math.round(S.t-j.issued);
  const stock=j.drug.counted?j.drug.have:j.drug.book, sure=j.drug.counted;
  const given=p.given.filter(g=>g.d===j.drug.id).length, pend=j.status==='pending';
  const five=[['對病人',p.nm],['對藥品',rxName(j).split(' ')[0]],
    ['對劑量',(j.dose.match(/[\d.]+\s*(mg|IU|g|mL|µg)/i)||['？'])[0]],
    ['對途徑',(j.dose.match(/\b(PO|IV|IM|SC|NG|neb|霧化|外用)\b/i)||['—'])[0]],
    ['對時間',(j.dose.match(/\b(qd|bid|tid|qid|q\d+h|stat|hs|prn)\b/i)||['—'])[0]]];
  let h=`<div class="pane"><h2>處方 #${String(j.n).padStart(2,'0')}</h2>
    <div class="sub">${j.by} 開立於 ${clock(j.issued)}${pend?`　·　已等待 ${age} 分鐘`:`　·　${j.status==='done'?'已調劑':'已退回'}`}</div>
    ${rxPaper(j)}
    <div class="five">${five.map(f=>`<div><span>${f[0]}</span><b>${f[1]}</b></div>`).join('')}</div>
    <div class="pcard"><div class="ph"><b>藥局病人紀錄</b><span class="tagbox t${p.tag}">T${p.tag}</span></div>
      <div class="kv"><span>體重</span><b>${p.wt} kg${p.child?'（兒童）':''}</b></div>
      <div class="kv"><span>過敏史</span><b class="${p.allergy?'alert':''}">${p.allergy||'無紀錄'}</b></div>
      <div class="kv"><span>長期用藥</span><b>${p.hx.length?p.hx.join('、'):'無紀錄'}</b></div>${
        p.asked ? `<div class="kv"><span>${p.child?'家屬說':'病人說'}</span><b class="${p.ask.length?'told':''}">${p.ask.length?p.ask.join('<br>'):'沒有其他在吃的藥，也沒有特別要說的'}</b></div>`
        : `<div class="kv"><span>詢問</span><b><button class="sbtn" data-cmd="askpt">問${p.child?'家屬':'病人'}（${T.askPt} 分鐘）</button>
            <small style="display:block;color:var(--ink-faint)">紀錄上只有已知的事。在吃什麼、上次幾點吃、有沒有在餵母奶——沒問過的不會寫在這裡。</small></b></div>`}
      <div class="kv"><span>本站已給</span><b>${p.given.length?p.given.map(g=>drugById[g.d].n.split(' ')[0]+' '+clock(g.t)).join('、'):'尚未給藥'}</b></div>
      <div class="kv"><span>已衛教</span><b>${p.educated.length?p.educated.join('、'):'無'}</b></div>${
        (p.events||[]).length?`<div class="kv"><span>事件</span><b class="alert">${p.events.map(e=>e.t+' '+e.txt).join('、')}</b></div>`:''}</div>
    <div class="note ${stock<=0?'warn':''}">
      ${sure?'實際庫存':'<b style="color:var(--warn)">帳面</b>庫存'}　<b>${stock} / 七日儲備 ${j.drug.q} ${j.drug.u}</b>${j.drug.note?'　·　'+j.drug.note:''}
      ${sure?'':'<br><span style="color:var(--ink-faint)">第四天了，這個數字還沒有人核對過。架上不一定有這麼多。</span>'}
      ${j.drug.pk?`<br>包裝：${j.drug.pk.type==='blister'?`排裝，每排 ${j.drug.pk.per} 顆`:'罐裝，散裝計數'}`:''}
      ${given?`<br>此病人今日已給同品項 <b>${given}</b> 次`:''}</div>
    ${j.cold?`<div class="note cold">冷藏品項。冷藏庫目前 <b>${S.fridge.toFixed(1)}℃</b>${S.fridge>8?'　—　已脫離 2–8℃，效價存疑。':'　—　冷鏈正常。'}</div>`:''}
    ${j.ctrl?`<div class="note ctrl">管制藥品。須上鎖存放、逐筆登記、雙人核對。目前登記 ${S.ctrlLedger.length} 筆。</div>`:''}
    ${j.raised?`<div class="note warn"><b>${j.raisedBy} 把這張攔下來了。</b><br>
      理由是：「${j.why?j.why.split('。')[0]+'。':'我覺得有問題，我不敢配。'}」<br>
      這是作業簡介換來的——對方知道遇到不確定就停下來問你。最後要怎麼處理，還是你的決定。</div>`:''}
    ${j.taken&&j.status==='pending'?`<div class="note">${j.taken.h.name} 正在配這一張。你也可以自己接手。</div>`:''}
    ${j.byHelper?`<div class="note">這張是 <b>${j.byHelper}</b> 獨立完成的。</div>`:''}
    ${j.askRes?`<div class="note ${j.askRes.v==='fix'?'ok':j.askRes.v==='ok'?'':'warn'}">
      <b>你問過了。</b>　${clock(j.askAt)}<br>${j.askRes.txt}</div>`:''}
    ${j.partial?`<div class="note warn"><b>已先給第一劑。</b>其餘暫緩，等確認。</div>`:''}`;
  if (!pend){
    h+=`<div class="note">${j.status==='done'
      ? (j.flag?`此處方帶著問題流出藥局：<b style="color:var(--bad)">${REASON_N[j.flag]}</b><br>${j.why||''}`
          :'已完成調劑與給藥指導。')
        + (j.counted?`<br><br>${j.counted.vial?'取量':'數藥'}：給了 <b>${j.counted.total}</b> ${j.counted.unit||'顆'}${
            j.counted.right&&j.counted.packRight
            ?'（正確）':`，<b style="color:var(--bad)">應為 ${j.counted.want} ${j.counted.unit||'顆'}</b>`}`:'')
      : `已退回，理由：<b>${REASON_N[j.reason]}</b>${j.txt?'<br>'+j.txt:''}`}</div></div>`;
    put('detail',h); return;
  }
  // 數藥台
  if (j.counting){
    const d=j.drug, vl=vialOf(j);
    const c=j.cnt=j.cnt||{total:0,strips:0,loose:0};
    if (vl){
      /* 針劑／霧化／輸液：數的是支數。
         最容易出事的不是算錯，是伸手就拿一支。 */
      h+=`<div class="note"><b>取藥。</b>處方寫的是<b>劑量</b>，不是支數——一支裝多少，要你自己看。</div>
        <div class="counttop">
          <div><span>處方一次</span><b>${vl.amt}</b>${vl.u}</div>
          <div><span>一支裝</span><b>${vl.per}</b>${vl.u}</div>
          <div><span>次數</span><b>${vl.days>0?`${vl.perDay}次 × ${vl.days}日`:(vl.doses>1?`${vl.doses} 次`:'單次')}</b></div>
          <div class="pkg"><span>品項</span><b>${d.n}</b></div>
        </div>
        <div class="field"><label>你從架上（或冰箱）拿了幾${vl.unit}</label>
          <div class="cntrow">${stepper('total',c.total,true)}<span class="cu">${vl.unit}</span>
            ${c.total>0?`<span class="cnttotal">＝ <b>${Math.round(c.total*vl.per*1000)/1000}</b> ${vl.u}</span>`:''}
          </div></div>
        ${d.st==='ctrl'?`<div class="note ctrl">管制藥品：取出的支數必須與簿冊登記一致，空瓶（安瓿）要留存。</div>`:''}
        <div class="btnrow">
          <button class="pbtn" data-cmd="cntgo">取好了，交付</button>
          <button class="gbtn" data-cmd="cntno">取消</button></div></div>`;
      if (put('detail',h)){
        $('detail').querySelectorAll('[data-st]').forEach(btn=>btn.onclick=()=>{
          const k=btn.dataset.st, v=+btn.dataset.v;
          c[k]=Math.max(0,(c[k]||0)+v); dirty.detail=true; uiClock=0; flushUI(); });
        $('detail').querySelectorAll('[data-set]').forEach(inp=>inp.oninput=()=>{
          c[inp.dataset.set]=Math.max(0,parseInt(inp.value||'0',10)||0); });
        const q=cc=>$('detail').querySelector(`[data-cmd="${cc}"]`);
        q('cntgo').onclick=()=>{ if (c.total<=0) return;
          j.counting=false; submitVial(j, c.total, vl); };
        q('cntno').onclick=()=>{ j.counting=false; j.cnt=null; dirty.detail=true; };
      }
      return;
    }
    const sig=sigOf(j), bl=d.pk.type==='blister';
    h+=`<div class="note"><b>數藥。</b>處方寫的是用法，不是數量——數量要你自己算。</div>
      <div class="counttop">
        <div><span>每次</span><b>${sig.per}</b>顆</div>
        <div><span>每日</span><b>${sig.perDay}</b>次</div>
        <div><span>天數</span><b>${sig.stat?'單次':sig.days+' 日'}</b></div>
        <div class="pkg"><span>包裝</span><b>${bl?`排裝　${d.pk.per} 顆／排`:'罐裝　散裝計數'}</b></div>
      </div>
      ${bl?`<div class="field"><label>從藥排取出</label>
        <div class="cntrow"><span class="cl">整排</span>${stepper('strips',c.strips,false,true)}
          <span class="cu">排 × ${d.pk.per}</span></div>
        <div class="cntrow" style="margin-top:5px"><span class="cl">另取</span>${stepper('loose',c.loose,false,true)}
          <span class="cu">顆</span>
          <span class="cnttotal">＝ <b>${c.strips*d.pk.per+c.loose}</b> 顆</span></div></div>`
      :`<div class="field"><label>數出的顆數</label>
        <div class="cntrow">${stepper('total',c.total,true)}<span class="cu">顆</span></div></div>`}
      <div class="btnrow">
        <button class="pbtn" data-cmd="cntgo">數好了，交付</button>
        <button class="gbtn" data-cmd="cntno">取消</button></div></div>`;
    if (put('detail',h)){
      $('detail').querySelectorAll('[data-st]').forEach(btn=>btn.onclick=()=>{
        const k=btn.dataset.st, v=+btn.dataset.v;
        c[k]=Math.max(0,(c[k]||0)+v); dirty.detail=true; uiClock=0; flushUI();
      });
      $('detail').querySelectorAll('[data-set]').forEach(inp=>inp.oninput=()=>{
        c[inp.dataset.set]=Math.max(0,parseInt(inp.value||'0',10)||0); });
      const q=cc=>$('detail').querySelector(`[data-cmd="${cc}"]`);
      q('cntgo').onclick=()=>{
        const tot = bl ? c.strips*d.pk.per+c.loose : c.total;
        if (tot<=0) return;
        j.counting=false; submitCount(j, tot, c.strips, c.loose);
      };
      q('cntno').onclick=()=>{ j.counting=false; j.cnt=null; dirty.detail=true; };
    }
    return;
  }
  const can=S.atBench&&stock>0;
  // 試過一次才知道整張配不出來：這時只剩先給一劑、替代、或以庫存不足退回
  const shortNow = j.short && j.drug.have < j.short;
  if (shortNow) h+=`<div class="note warn"><b>架上只有 ${j.drug.have} ${j.drug.u}，這張需要 ${j.short} ${j.drug.u}。</b>
    整張配不出來。可以先給第一劑、改用替代品項，或以「庫存不足」退回並附上建議。</div>`;
  h+=`<div class="acts">
    ${!S.atBench?walkBtn('pharm','走回調劑檯'):''}
    ${j.ctrl?`<label class="chk ${j.ledger?'on':''}"><input type="checkbox" id="cl-led" ${j.ledger?'checked':''}>
      <span><b>逐筆登記於管制藥品簿冊</b><small>${S.sup.book?'品項、數量、病人、時間、簽章'
        :'<b style="color:var(--warn)">簿冊只剩最後幾頁</b>——再寫下去就得寫在便條紙上，那不算登記'}</small></span></label>
      <label class="chk ${j.dual?'on':''}"><input type="checkbox" id="cl-dual" ${j.dual?'checked':''}>
      <span><b>雙人核對</b><small>${S.t>344&&S.t<400?'此刻護理師均在處置中，找不到第二人。':'請一名護理師到場共同核對。'}</small></span></label>`:''}
    <button class="act" data-cmd="disp" ${can&&!shortNow?'':'disabled'}><span class="an">調劑並交付
      <span class="aw">${shortNow?'庫存不足以配完整張':can?(needsCount(j)?(j.drug.f==='口服'?'先數顆數，數好即交付':'先數支數，數好即交付')
  :`${dispTime(j).toFixed(0)} 分鐘${j.pat.child?'・含磨粉分裝':''}`):(stock<=0?'庫存為 0':'必須在藥局內作業')}</span></span><span class="ac">執行</span></button>
    <button class="act warnb" data-cmd="ann" ${can&&!shortNow?'':'disabled'}><span class="an">調劑並註記疑慮
      <span class="aw">配出去，但把疑慮寫下來</span></span><span class="ac">執行</span></button>
    <button class="act" data-cmd="ask" ${S.commsDown>S.t?'disabled':''}><span class="an">向 ${j.by} 確認
      <span class="aw">${S.commsDown>S.t?'無線電中斷中，聯絡不上':T.ask+' 分鐘・不退回，先問清楚'}</span></span><span class="ac">詢問</span></button>
    <button class="act" data-cmd="subs"><span class="an">改用替代品項並取得口頭醫囑
      <span class="aw">${T.sub} 分鐘・需自行選品項，並請開立者 24 小時內補簽</span></span><span class="ac">替代</span></button>
    <button class="act" data-cmd="part" ${can?'':'disabled'}><span class="an">先給第一劑，其餘暫緩待確認
      <span class="aw">折衷做法。用對地方是穩住病人，用錯地方是把問題延後</span></span><span class="ac">折衷</span></button>
    <button class="act" data-cmd="ret"><span class="an">退回並向開立者說明
      <span class="aw">${T.ret} 分鐘・需選擇理由</span></span><span class="ac">退回</span></button></div>
    <div class="field" id="subbox" hidden><label>改用哪一個品項</label>
      <select id="subsel">${subList(j)
          .map(x=>`<option value="${x.id}">${x.n}　·　${x.f}　·　餘 ${x.counted?x.have:x.book} ${x.u}</option>`).join('')
          || '<option value="">目前沒有可用的替代品項</option>'}</select>
      <label class="chk" style="margin-top:9px"><input type="checkbox" id="sub-vo">
        <span><b>已取得口頭醫囑並記錄</b><small>品項、劑量、時間、雙方姓名，並請開立者 24 小時內補簽</small></span></label>
      <label style="margin-top:9px">給開立者與護理端的說明</label>
      <textarea id="subtxt" placeholder="例：原品項缺貨，已與開立者確認改用同類替代並換算劑量，請於病歷補簽。"></textarea>
      <div class="btnrow" style="margin-top:9px"><button class="pbtn" id="subgo">確認替代</button>
        <button class="gbtn" id="subno">取消</button></div></div>
    <div class="field" id="retbox" hidden><label>退回理由</label>
      <select id="retreason">${REASONS.map(x=>`<option value="${x.id}">${x.n}　—　${x.d}</option>`).join('')}</select>
      <label style="margin-top:9px">替代建議</label>
      <textarea id="rettxt" placeholder="例：建議改用 Acetaminophen 120mg/5mL 兒童藥水，20kg 依 10–15 mg/kg 給 8–12 mL。"></textarea>
      <div class="btnrow" style="margin-top:9px"><button class="pbtn" id="retgo">確認退回</button>
        <button class="gbtn" id="retno">取消</button></div></div></div>`;
  if (put('detail',h)){
    const q=c=>$('detail').querySelector(`[data-cmd="${c}"]`);
    q('askpt')&&(q('askpt').onclick=()=>askPatient(p));
    q('disp')&&(q('disp').onclick=()=>doDispense(j,false));
    q('ann')&&(q('ann').onclick=()=>doDispense(j,true));
    q('ask')&&(q('ask').onclick=()=>doAsk(j));
    q('part')&&(q('part').onclick=()=>doPartial(j));
    q('subs')&&(q('subs').onclick=()=>{ $('subbox').hidden=false; $('retbox').hidden=true;
      if (MOBILE()) reveal('#subbox'); else $('subbox').scrollIntoView({block:'nearest'}); });
    $('subno')&&($('subno').onclick=()=>{ $('subbox').hidden=true; });
    $('subgo')&&($('subgo').onclick=()=>doSubstitute(j, $('subsel').value,
      $('sub-vo').checked, esc($('subtxt').value.trim())));
    q('ret')&&(q('ret').onclick=()=>{ $('retbox').hidden=false; $('subbox').hidden=true;
      if (MOBILE()) reveal('#retbox'); else $('retbox').scrollIntoView({block:'nearest'}); });
    $('retno')&&($('retno').onclick=()=>{ $('retbox').hidden=true; });
    $('retgo')&&($('retgo').onclick=()=>doReturn(j,$('retreason').value,esc($('rettxt').value.trim())));
  }
}
function renderEmt(j){
  const done=j.status==='done';
  const isCbr = j.kind==='cbr';
  let h=`<div class="pane"><h2>${j.title}</h2>
    <div class="sub">${isCbr?'CBRNE 應變':'EMT-2 現場處置'}　·　${zoneById[j.zone]?zoneById[j.zone].name:''}　·　${clock(j.issued)}</div>
    <div class="note emt" ${isCbr?'style="border-left-color:var(--k-cbr)"':''}>${j.intro}</div>
    <div class="step">${j.steps.map((_,i)=>`<i class="${i<j.step?'on':''}"></i>`).join('')}
      <span>步驟 ${Math.min(j.step+1,j.steps.length)} ／ ${j.steps.length}</span></div>`;
  if (done){
    h+=j.res.map(r=>`<div class="note ${r.v==='good'?'ok':r.v==='mid'?'warn':''}"
      style="${r.v==='bad'?'border-left-color:var(--bad)':''}"><b>${r.q}</b><br>
      ${r.v==='good'?'✓':r.v==='mid'?'△':'✗'} ${r.t}<br><br>${r.fb}</div>`).join('')+'</div>';
    put('detail',h); return;
  }
  const st=j.steps[j.step];
  const prev=j.res.length?`<div class="note ${j.res[j.res.length-1].v==='good'?'ok':'warn'}"
    style="${j.res[j.res.length-1].v==='bad'?'border-left-color:var(--bad)':''}">${j.res[j.res.length-1].fb}</div>`:'';
  h+=prev+`<div class="paper" data-t="現場"><div class="prow"><span>狀況</span><b>${st.q}</b></div></div>
    <div class="acts">${st.opts.map((o,i)=>`<button class="opt" data-emt="${i}"><b>${o.t}</b></button>`).join('')}</div>
    ${isCbr
      ? `<div class="note" style="border-left-color:var(--k-cbr)">你手上有的：Atropine 1mg/1ml <b>${drugById.atr.have}</b> 支、
          Diazepam <b>${drugById.diaz.have}</b> 支（管制）、Midazolam <b>${drugById.mida.have}</b> 支（管制）。
          <b>本站庫備清單沒有 Pralidoxime（2-PAM），也沒有碘化鉀。</b></div>`
      : `<div class="note">你持有 EMT-2：可執行評估、給氧、基本氣道、CPR 與 AED、止血固定、<b>建立靜脈路徑與輸液</b>。
          進階氣道與未經醫囑或線上醫療指導的藥物給予不在範圍內。</div>`}</div>`;
  if (put('detail',h)) $('detail').querySelectorAll('[data-emt]').forEach(b=>
    b.onclick=()=>isCbr?answerCbrne(j,+b.dataset.emt):answerEmt(j,+b.dataset.emt));
}
function idlePane(){
  const p=pending().length;
  return `<div class="pane"><h2 style="font-family:var(--serif);font-weight:600">調劑檯</h2>
    <div class="sub">藥局・4 坪・獨立作業空間・白班藥師 1 人（EMT-2）</div>
    <div class="note">${p?`佇列有 <b>${p}</b> 項工作。點選左側任一項開始。`:'目前沒有待處理的工作。可以趁現在盤點。'}</div>
    <div class="acts">
      ${Object.keys(BGJOBS).map(k=>{
        const dn=(k==='count'&&S.counted)||(k==='ice'&&S.iceReady)||(k==='pack'&&S.packReady)||(k==='tidy'&&S.tidy);
        return `<button class="act" data-cmd="bgstart" data-bgid="${k}" ${dn?'disabled':''}>
          <span class="an">${dn?'✓ ':''}${BGJOBS[k].n}
          <span class="aw">${BGJOBS[k].min} 分鐘・空檔工作，有事會自動放下</span></span>
          <span class="ac">${dn?'已完成':'開始'}</span></button>`;}).join('')}
      <button class="act" data-cmd="rest"><span class="an">短暫休息
        <span class="aw">${T.rest} 分鐘・疲勞 ${Math.round(S.fatigue)}／100，超過 60 調劑會變慢</span></span><span class="ac">執行</span></button></div>
    <div class="note" style="margin-top:10px">空檔工作不必一口氣做完。你在等人、等窗口、等別人回話的時候它會繼續，
      一有工作進來就自動放下，之後從斷點接回去——畫面下方那一列就是它。</div>
    <div class="note" style="margin-top:12px"><b>五對</b>　對病人・對藥品・對劑量・對途徑・對時間<br>
      <span style="color:var(--ink-faint)">你不決定誰先救。你決定的是這張處方能不能配得出來、配得對不對，以及配得出來多久。</span></div></div>`;
}
