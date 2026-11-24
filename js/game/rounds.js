"use strict";
/* 還開著 STILL OPEN — 問病人、走出藥局
   藥局紀錄上只有已知的事；其餘要開口問。
   有些事一定要走出去做：高警訊藥品的床邊核對、冷藏溫度的定時紀錄、留觀床邊的用藥指導。
   走路要時間，而你不在調劑檯前的時候，佇列會在背後長高。 */

/* ---------- 問病人 ---------- */
function askPatient(p){
  startWork(`詢問${p.child?'家屬':'病人'}：${p.nm}`, T.askPt, ()=>{
    p.asked=true;
    if (p.ask.length) p.ask.forEach(t=>log(`${p.nm}：${t}`,'l-key'));
    else log(`${p.nm}：沒有其他在吃的藥，也沒有特別要說的。`);
    dirty.detail=true;
  });
}

/* ---------- 走路 ---------- */
// 地下室裡走一趟：繞過擔架、柱子與排隊的人。約 7 個單位一分鐘，最少一分鐘
const SPOT = {
  pharm:[BENCH[0],BENCH[1]+2.5], fridge:[FRIDGE[0]+1.2,FRIDGE[1]],
};
const spotOf = id => SPOT[id] || zc(zoneById[id]);
const placeName = id => id==='fridge' ? '冷藏庫' : id==='pharm' ? '調劑檯' : zoneById[id].name;
function walkMins(to){ const d=Math.hypot(to[0]-player.pos[0], to[1]-player.pos[1]); return Math.max(1, Math.round(d/7)); }
const atPlace = id => id==='fridge'
  ? Math.hypot(player.pos[0]-SPOT.fridge[0], player.pos[1]-SPOT.fridge[1])<3.2
  : inZone(player.pos, id);
function goTo(id, then){
  if (atPlace(id)){ if (then) then(); return; }
  const to=spotOf(id), from=player.pos.slice(), m=walkMins(to);
  startWork(`走到${placeName(id)}`, m, ()=>{ player.pos=to.slice(); dirty.detail=true; if (then) then(); });
  S.task.walk={from, to};
}
/* 3D：走路的那幾分鐘，人真的在走 */
function walkStep(){
  const w=S.task && S.task.walk; if (!w) return;
  const k=Math.max(0,Math.min(1,1-S.task.remain/S.task.total));
  player.pos=[w.from[0]+(w.to[0]-w.from[0])*k, w.from[1]+(w.to[1]-w.from[1])*k];
  player.yaw=Math.atan2(w.to[0]-w.from[0], w.to[1]-w.from[1]);
}
const walkBtn = (id, label) => `<button class="act" data-walk="${id}"><span class="an">${label||'走到'+placeName(id)}
  <span class="aw">約 ${walkMins(spotOf(id))} 分鐘・離開調劑檯，這段時間不能調劑</span></span><span class="ac">前往</span></button>`;

/* ---------- 床邊核對 ---------- */
// 高警訊藥品：配出去之後，在床邊和護理師一起再核對一次（也是管制藥品的雙人核對）
const HIGH_ALERT = ['ins','cacl','mgso4','amio','nabic','d50','mor','fent','mida','diaz','prop'];
function needsBedside(j){ return HIGH_ALERT.includes(j.drug.id) && zoneOfPat(j.pat)!=='pub' && !(j.ctrl && j.dual); }
function queueBedside(j){
  const z=zoneOfPat(j.pat);
  pushJob({kind:'walk', sub:'bed', t:S.t, src:j, zone:z, due:S.t+25,
    title:`床邊核對：${j.pat.nm} ${j.drug.n.split(' ')[0]}`, who:pick(NURSES)});
}
/* ---------- 冷藏溫度 ---------- */
// 每兩小時要有人到冷藏庫前看溫度計、寫進紀錄表。面板上的數字是電子讀數；紀錄表是你的責任
function queueTempRound(){
  pushJob({kind:'walk', sub:'temp', t:S.t, zone:'fridge', due:S.t+40,
    title:'冷藏溫度記錄', who:'冷藏溫度紀錄表'});
}
function tickRounds(){
  if (S.t >= (S.nextTemp||120)){ S.nextTemp=(S.nextTemp||120)+120; if (S.t<700) queueTempRound(); }
  for (const j of S.jobs){
    if (j.kind!=='walk' || j.status!=='pending' || S.t<j.due) continue;
    j.status='missed'; j.doneAt=S.t;
    if (j.sub==='bed'){
      const s=j.src;
      mark(s.ctrl?'P3':'P2', false, `#${s.n} ${s.drug.n.split(' ')[0]}：給藥前沒有床邊核對${s.ctrl?'（雙人核對缺一人）':''}`);
      log(`${j.who} 沒等到你，自己給了 #${String(s.n).padStart(2,'0')} ${s.drug.n.split(' ')[0]}。床邊沒有第二個人核對。`,'l-warn');
    } else {
      mark('P5', false, `${clock(j.issued)} 那一次冷藏溫度沒有記錄`);
      log('冷藏溫度紀錄表空了一格。','l-warn');
    }
    dirty.q=dirty.detail=true;
  }
}
function doWalkAction(j){
  if (j.sub==='bed'){
    startWork(`床邊核對：${j.src.pat.nm}`, T.bed, ()=>{
      j.status='done'; j.doneAt=S.t; const s=j.src;
      if (s.ctrl){ s.dual=true; const e=S.ctrlLedger.find(x=>x.p===s.pat.nm && x.d===s.drug.n && !x.dual); if (e) e.dual=true;
        mark('P3', true, `#${s.n} ${s.drug.n.split(' ')[0]}：床邊雙人核對`); }
      else mark('P2', true, `#${s.n} ${s.drug.n.split(' ')[0]}：高警訊藥品床邊核對`);
      log(`和 ${j.who} 在床邊核對 #${String(s.n).padStart(2,'0')}：病人、藥名、劑量、途徑、時間。`,'l-ok');
      dirty.q=dirty.detail=true; });
  } else {
    startWork('記錄冷藏溫度', T.temp, ()=>{
      j.status='done'; j.doneAt=S.t; (S.tempLog=S.tempLog||[]).push({t:clock(S.t), v:S.fridge});
      mark('P5', true, `${clock(S.t)} 記錄冷藏溫度 ${S.fridge.toFixed(1)}℃`);
      log(`冷藏庫 ${S.fridge.toFixed(1)}℃，已寫進紀錄表。${S.fridge>8?'超出 2–8℃！':''}`, S.fridge>8?'l-bad':'l-cold');
      dirty.q=dirty.detail=true; });
  }
}
function renderWalk(j){
  const here=atPlace(j.zone), left=Math.max(0,Math.round(j.due-S.t));
  const s=j.src;
  let h=`<div class="pane"><h2>${j.title}</h2>
    <div class="sub">${placeName(j.zone)}　·　${clock(j.issued)}${j.status==='pending'?`　·　還有 ${left} 分鐘`:''}</div>`;
  if (j.sub==='bed') h+=`<div class="paper" data-t="床邊"><div class="prow"><span>病人</span><b>${s.pat.nm}　${s.pat.age}歲${s.pat.sex}</b></div>
      <div class="prow"><span>品項</span><b class="big">${s.drug.n}</b></div><div class="prow"><span>用法</span><b>${s.dose}</b></div>
      <div class="prow"><span>護理師</span><b>${j.who}</b></div></div>
    <div class="note">高警訊藥品配出去之後，要在床邊和給藥的護理師一起再核對一次${s.ctrl?'——這也是管制藥品的<b>雙人核對</b>':''}。
      ${j.who} 會等你 ${left} 分鐘；等不到，她會自己給。</div>`;
  else h+=`<div class="note cold">冷藏溫度要每兩小時有人到冷藏庫前看溫度計、寫進紀錄表。
      面板上的數字是電子讀數；紀錄表上的那一格，是之後所有人判斷這批藥能不能用的依據。</div>
    ${S.tempLog&&S.tempLog.length?`<div class="note">已記錄：${S.tempLog.map(x=>x.t+' '+x.v.toFixed(1)+'℃').join('、')}</div>`:''}`;
  if (j.status!=='pending'){
    h+=`<div class="note ${j.status==='done'?'ok':'warn'}">${j.status==='done'?'已完成。':'沒有做到——時間過了。'}</div></div>`;
    put('detail',h); return;
  }
  h+=`<div class="acts">${here
    ? `<button class="act" data-cmd="walkdo"><span class="an">${j.sub==='bed'?'和護理師床邊核對':'看溫度計，寫進紀錄表'}
        <span class="aw">${j.sub==='bed'?T.bed:T.temp} 分鐘</span></span><span class="ac">執行</span></button>`
    : walkBtn(j.zone)}
    ${here?walkBtn('pharm','走回調劑檯'):''}</div></div>`;
  if (put('detail',h)){
    const d=$('detail').querySelector('[data-cmd="walkdo"]'); if (d) d.onclick=()=>doWalkAction(j);
  }
}
/* 留觀與診療區的病人：用藥指導要走到床邊做 */
function eduPlace(j){ const z=zoneOfPat(j.pat); return z==='pub' ? null : z; }
