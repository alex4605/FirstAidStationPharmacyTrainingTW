"use strict";
/* 還開著 STILL OPEN — 接續下一天
   受困情境本來就是一天接一天。白班結束後可以接續：
   架上剩下的藥、留下來的幫手、昨晚睡了多少、夜裡發生的事，都帶到下一天的早上。
   夜裡沒有藥師，所以帳面沒有人記——早上的帳面一定比昨天更不準。
   資料存在這台瀏覽器裡；換一台裝置或清掉網站資料，就從第四天的狀態重新開始。 */

const CARRY_KEY = d => `stillopen.carry.${SEED}.${d}`;
const storeOK = (()=>{ try { const k='stillopen.t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; } catch(e){ return false; } })();

function buildCarry(){
  const ev = S.night ? S.night.ev : [];
  return {
    day: DAY+1, from: DAY,
    drugs: Object.fromEntries(DRUGS.map(d=>[d.id,[d.have,d.book,d.counted?1:0,d.unverified||0]])),
    sup: S.sup, fuel: S.fuel, genOn: S.genOn,
    fatigue: S.night ? S.night.fatigue : Math.min(100,S.fatigue+30),
    night: S.night ? {mode:S.night.mode, ev} : null,
    helpers: S.helpers.filter(r=>r.active).map(r=>({h:r.h, scope:r.scope, briefed:r.briefed})),
    patients: Object.fromEntries(PATIENTS.map(p=>[p.id,{asked:p.asked, harm:p.harm, events:p.events||[]}])),
    unresolved: unresolvedFollowUps().map(f=>({pid:f.src.pat.id, drug:(f.src.enName||f.src.drug.n).split(' ')[0]})),
    verdicts: Object.fromEntries(Object.keys(COMP).map(k=>[k,verdict(k)])),
  };
}
function goNextDay(){
  if (!storeOK) return;
  try { localStorage.setItem(CARRY_KEY(DAY+1), JSON.stringify(buildCarry())); } catch(e){ return; }
  location.hash = `#seed=${SEED}&day=${DAY+1}`;
  location.reload();
}

/* 早上開站前：把昨天帶過來 */
let CARRY = null;
function applyCarry(){
  if (DAY<=4) return false;
  try { CARRY = JSON.parse(localStorage.getItem(CARRY_KEY(DAY))||'null'); } catch(e){ CARRY=null; }
  if (!CARRY) return false;
  // 藥：夜班沒有藥師。夜裡用掉的沒有人記在帳上
  DRUGS.forEach(d=>{
    const c=CARRY.drugs[d.id]; if (!c) return;
    d.have=c[0]; d.book=c[1]; d.counted=!!c[2]; d.unverified=c[3]||0;
    if (d.st!=='ctrl' && d.have>0){
      const used=Math.min(d.have, Math.round(d.have*rnd(.03,.12)));
      d.have-=used; if (used>0) d.counted=false;   // 帳面沒動
    }
  });
  S.sup = {...S.sup, ...CARRY.sup};
  // 柴油：開了一整夜；偶爾夜裡有人送來一點
  S.fuel = Math.max(0, CARRY.fuel - (CARRY.genOn?rint(30,40):0) + (chance(.4)?rint(30,60):0));
  S.genOn = S.fuel>0;
  S.fatigue = CARRY.fatigue;
  // 病人：還在站裡的人，記得你問過什麼、出過什麼事
  PATIENTS.forEach(p=>{ const c=CARRY.patients[p.id]; if (!c) return;
    p.asked=c.asked; p.harm=c.harm; p.events=c.events; });
  // 留下來的幫手：昨天的授權與作業簡介還在；有人今天早上會走
  CARRY.helpers.forEach((x,i)=>{
    const stay = chance(.7) ? 1e9 : rint(90,300);
    S.helpers.push({h:x.h, scope:x.scope, active:true, briefed:x.briefed, err:0,
      joinedAt:0, leaveAt:stay, spot:null, away:0, chats:0, carried:true});
    if (stay<1e9) x.h.leaveWhy = pick(['上面的收容所要我回去顧我的家人。','站長把我調去別的站。','我撐了兩天，真的撐不住了。']);
  });
  return true;
}
/* 開站時的紀錄與昨晚的後續 */
function morningAfter(){
  if (!CARRY) return;
  log(`${dayName(DAY)}。藥局照昨天留下的樣子開設。`,'l-key');
  if (CARRY.night) CARRY.night.ev.filter(e=>e.ok==='bad').forEach(e=>log(`昨晚 ${e.t}：${e.title}——${e.txt}`,'l-bad'));
  if (CARRY.helpers.length) log(`昨天的幫手留下來了：${CARRY.helpers.map(x=>x.h.name).join('、')}。`,'l-ok');
  log('夜裡沒有藥師，用掉的藥沒有人記在帳上。今天的帳面比昨天更不準。','l-warn');
  // 昨天沒處理好的那幾筆：早上醫師會來問
  (CARRY.unresolved||[]).slice(0,2).forEach((u,i)=>{
    const p=patById[u.pid]; if (!p) return;
    S.pending.push({at:5+i*7, fu:{j:{n:'昨', pat:p, drug:{n:u.drug, id:''}, dose:'（昨天的處方）', flag:'inter', prevDay:true,
      fx:'昨晚狀況變差，到現在還沒有好轉', doneAt:null}, cause:'rx'}});
  });
}
/* 開場簡報的「昨天」那一段 */
function carryBriefHtml(){
  if (DAY<=4) return '';
  if (!CARRY) return `<div class="note warn">找不到${dayName(DAY-1)}的紀錄（換了裝置，或網站資料被清掉了）。今天從新的狀態開始。</div>`;
  const ev = CARRY.night ? CARRY.night.ev : [];
  const out = DRUGS.filter(d=>d.have<=0).map(d=>d.n.split(' ')[0]);
  return `<h2>昨天留下來的</h2>
    <div class="tblwrap"><table>
      ${ev.map(e=>`<tr><td style="white-space:nowrap">${e.t}</td><td class="verd ${e.ok==='ok'?'v0':e.ok==='mid'?'v1':'v2'}" style="text-align:left">${e.title}</td><td>${e.txt}</td></tr>`).join('')}
    </table></div>
    <ul><li>今早疲勞 <b>${Math.round(S.fatigue)}／100</b>${S.fatigue>=TIRED?'——你一開始就累了，五對要自己核對。':''}</li>
      <li>發電機油 <b>${Math.round(S.fuel)} L</b>${S.fuel<60?'——撐不過今晚。':''}</li>
      <li>留下來的幫手：${CARRY.helpers.length?CARRY.helpers.map(x=>`<b>${x.h.name}</b>（${x.h.skill}）`).join('、'):'沒有'}</li>
      ${out.length?`<li>已經歸零：<b>${out.join('、')}</b></li>`:''}
      <li>夜裡沒有藥師，用掉的藥沒有人記在帳上——<b>今天的帳面比昨天更不準</b>。</li></ul>`;
}
