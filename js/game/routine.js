"use strict";
/* 還開著 STILL OPEN — 例行處方裡的變化
   大部分的處方是對的。一天裡真正的變化，在交付的那一刻：
   手寫的標籤要再對一次、同一個人的幾張藥一起看、來拿藥的人在窗口多問一句。
   處方的錯誤率不因此改變。 */

/* 不動主亂數的隨機：同一個種子、同一張處方，結果永遠一樣 */
function keyedRand(key){
  let h=2166136261; const s=RUNKEY+'#'+key;
  for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  h=Math.imul(h^h>>>15,2246822507); h=Math.imul(h^h>>>13,3266489909); h^=h>>>16;
  return (h>>>0)/4294967296;
}

/* ---------- 標籤核對 ----------
   標籤紙用完時每一張都手寫；平常也有三成是手寫的（標籤機卡紙、幫手代貼）。
   手寫的標籤，四張裡大約有一張會寫錯一格。 */
function labelApplies(j){
  if (j.kind!=='rx' || !['口服','藥水'].includes(j.drug.f)) return false;
  return !S.sup.label || keyedRand('lbl'+j.n) < .3 || !!activeWith('pack');
}
function makeLabel(j, units){
  const p=j.pat, d=j.drug;
  const sig = d.f==='口服' ? sigOf(j) : null;
  let name=p.nm, freq=sig ? `每次 ${sig.per} 顆，一天 ${sig.perDay} 次${sig.days?`，${sig.days} 天`:''}` : j.dose,
      qty = units ? `${units} ${d.u}` : '1 瓶';
  const r=keyedRand('lble'+j.n), errP = !S.sup.label ? .3 : .22;
  let err=null;
  if (r<errP){
    const kinds = sig && sig.perDay ? ['freq','name','qty'] : ['name','qty'];
    err = kinds[Math.floor(keyedRand('lblk'+j.n)*kinds.length)];
    if (err==='freq') freq=`每次 ${sig.per} 顆，一天 ${sig.perDay>=3?sig.perDay-1:sig.perDay+1} 次${sig.days?`，${sig.days} 天`:''}`;
    if (err==='name'){ const o=PATIENTS.filter(x=>x.id!==p.id); name=o[Math.floor(keyedRand('lbln'+j.n)*o.length)].nm; }
    if (err==='qty') qty = units ? `${units+(units>4?2:1)} ${d.u}` : '2 瓶';
  }
  return {name, drug:(j.enName||d.n), freq, qty, err, hand:!S.sup.label || keyedRand('lblh'+j.n)<.5};
}
const LABEL_ERR = {freq:'用法次數', name:'病人姓名', qty:'數量'};
function labelPane(j){
  const L=j.label;
  return `<div class="paper f-label" data-t="${L.hand?'手寫標籤':'藥袋標籤'}">
      <div class="prow"><span>姓名</span><b>${L.name}</b></div>
      <div class="prow"><span>品名</span><b>${L.drug}</b></div>
      <div class="prow"><span>用法</span><b>${L.freq}</b></div>
      <div class="prow"><span>數量</span><b>${L.qty}</b></div></div>
    <div class="note">交付前最後一次核對：標籤上的每一格，都要跟上面的處方箋一致。</div>
    <div class="btnrow"><button class="pbtn" data-cmd="lbok">標籤無誤，交付</button>
      <button class="gbtn" data-cmd="lbfix">標籤有錯，重寫（1 分鐘）</button></div>`;
}
function labelDecide(j, fix){
  const L=j.label, {annotate, units}=j.labeling;
  const go=()=>{ j.labelDone=true; j.labeling=null; doDispense(j, annotate, units); };
  if (!fix){
    if (L.err){ j.labelBad=true;
      mark('P2', false, `#${j.n} 標籤的${LABEL_ERR[L.err]}寫錯了，沒有在交付前發現`); }
    go(); return;
  }
  startWork(`重寫標籤：#${String(j.n).padStart(2,'0')}`, 1, ()=>{
    if (L.err){ mark('P2', true, `#${j.n} 交付前發現標籤的${LABEL_ERR[L.err]}寫錯，重寫`);
      log(`#${String(j.n).padStart(2,'0')} 標籤上的${LABEL_ERR[L.err]}寫錯了，已重寫。`,'l-ok'); }
    else log(`#${String(j.n).padStart(2,'0')} 的標籤其實沒有錯。重寫了一次。`);
    go(); });
}

/* ---------- 窗口一問 ---------- */
function maybeWindowQ(j){
  const q=WINDOW_Q[j.drug.id]; S.wqUsed=S.wqUsed||{};
  if (!q || S.wqUsed[j.drug.id] || j.flag || keyedRand('wq'+j.n) > .45) return;
  S.wqUsed[j.drug.id]=1;
  S.pending.push({at:S.t+3+keyedRand('wqt'+j.n)*6, wq:{j}});
}
function spawnWindowQ(c){
  const j=c.j, p=j.pat, q=WINDOW_Q[j.drug.id];
  const who = p.child ? `${p.nm} 的家屬` : zoneOfPat(p)==='pub' ? p.nm : `${p.nm} 的家屬`;
  pushJob({kind:'wq', t:S.t, who, role:'領藥窗口', q:q.q, opts:q.opts, src:j});
}
function answerWq(j, i){
  const o=j.opts[i];
  startWork(`回答窗口的問題`, 1, ()=>{
    j.status='done'; j.doneAt=S.t; j.picked=i;
    const dn=j.src.drug.n.split(' ')[0];
    if (o.v==='good'){ mark('P6', true, `窗口交付 ${dn} 時回答正確`); log(`回答 ${j.who}：${dn} 的問題。`,'l-ok'); }
    else { mark('P6', false, `窗口交付 ${dn} 時的回答${o.v==='mid'?'不完整':'有誤'}`);
      log(`回答 ${j.who} 的問題——${o.v==='mid'?'不完整':'說錯了'}。`, o.v==='mid'?'l-warn':'l-bad'); }
    dirty.q=dirty.detail=true;
  });
}
function renderWq(j){
  renderChoiceJob(j, {
    title:`窗口一問 #${String(j.n).padStart(2,'0')}`,
    sub:`${j.who}　·　領藥窗口　·　${clock(j.issued)}`,
    paper:'窗口',
    rows:`<div class="prow"><span>${j.who}</span><b class="big" style="font-size:12.5px;line-height:1.5">「${j.q}」</b></div>
      <div class="prow"><span>剛拿到</span><b style="color:var(--ink-dim)">${j.src.drug.n}　${j.src.dose}</b></div>`,
    doneLabel:'你的回答', foot:'回答只要一分鐘，但他會照你說的去做。', submit:answerWq});
}

/* ---------- 同一位病人的幾張 ----------
   一起配、一起交付：少走一趟、少拿一次，也一起看有沒有互相打架。 */
function samePatientPending(j){
  return S.jobs.filter(x=>x.kind==='rx' && x.status==='pending' && x.n!==j.n && x.pid===j.pid && !(j.bag && x.bag===j.bag));
}
function justServed(p){ const g=p.given[p.given.length-1]; return g && S.t-g.t<6; }
