"use strict";
/* 還開著 STILL OPEN — 工作項目流程：空檔工作、數藥、調劑、替代、退回 */

/* ---------- 6. 工作項目流程 ---------- */
function pending(){ return S.jobs.filter(j=>j.status==='pending'); }
function pushJob(spec){
  const j = {...spec, n:S.nextN++, issued:S.t, status:'pending'};
  // 打亂選項順序（每張工作單一份，不改到題庫本身）
  const key = (j.kind||'')+'|'+(j.title||j.topic||j.q||j.id||j.n);
  if (j.opts) j.opts = keyedShuffle(j.opts, key);
  if (j.pts)  j.pts  = keyedShuffle(j.pts,  key);
  if (j.steps) j.steps = j.steps.map((s,i)=>({...s, opts:keyedShuffle(s.opts, key+'|'+i)}));
  if (j.kind==='rx'){
    j.drug = drugById[j.d]; j.pat = patById[j.pid];
    j.ctrl = j.ctrl || j.drug.st==='ctrl'; j.cold = j.drug.st==='cold';
    j.ledger=false; j.dual=false;
    log(`${j.by} 開立處方 #${String(j.n).padStart(2,'0')}　${j.pat.nm}　${j.enName||j.drug.n}`, j.ctrl?'l-key':(j.stat?'l-warn':''));
  } else if (j.kind==='con'){
    log(`${j.who} 到領藥窗口找你諮詢。`, 'l-con');
  } else if (j.kind==='edu'){
    j.pat = patById[j.pid]; j.picked = [];
    log(`${j.pat.nm} 的用藥諮詢：${j.topic}`, 'l-con');
  } else if (j.kind==='emt'){
    j.step = 0; j.res = [];
    log(`※ ${j.title}　—　醫護都在別處，你是最近的人，而你持有 EMT-2。`, 'l-bad');
  } else if (j.kind==='ass'){
    j.picked = [];
    log(`${j.who} 來請你幫忙：${j.title}`, 'l-con');
  } else if (j.kind==='logi'){
    j.picked=[]; j.why=''; j.rec=false; j.book=false;
    // 來調的人不一定帶了書面需求清單。沒有清單就調出去，帳與責任都會落在你這一端
    if (j.mode==='take'){ j.hasList=chance(.45); j.askedList=false;
      j.listItems=sample(ASK_ITEMS.filter(x=>!x.sup), rint(2,4)).map(x=>x.n); }
    log(`※ 車道口：${j.c.f} 到了。`, 'l-key');
    say(j.c.who, j.mode==='give'? j.c.give : j.c.take, 6800);
  } else if (j.kind==='scav'){
    j.ch=[]; j.cnt=[]; j.rec=false;
    log(`${j.from.who} 抱回來一箱藥（${j.from.where}），放在領藥窗口：${j.rows.length} 項待清點。`, 'l-key');
    say(j.from.who, j.from.say, 6400);
  } else if (j.kind==='idn'){
    j.picked=[];
    log(`待辨識區：${j.from} 送來的 ${j.items.length} 項品項需要比對後才能上架。`, 'l-warn');
  } else if (j.kind==='crowd'){
    j.picked=[]; j.pts=j.pts.slice();
    log(`※ 領藥窗口：${j.title}`, 'l-bad');
    say(j.who, j.intro.replace(/<[^>]+>/g,' ').split('。')[0]+'。', 6400);
  } else if (j.kind==='lang'){
    j.picked=[];
    j.pts=j.pts.slice();
    log(`領藥窗口來了一位講${j.flagTxt}的人，溝通有困難。`, 'l-con');
  } else if (j.kind==='emt2'){
    log(`${j.who} 在${zoneById[j.zone].name}叫住你：${j.title}`, 'l-con');
  } else if (j.kind==='cbr'){
    j.step = 0; j.res = [];
    log(`※※ ${j.title}　—　人還在除污區外面。`, 'l-bad');
  } else if (j.kind==='walk'){
    log(j.sub==='bed' ? `${j.who}：「藥師，#${String(j.src.n).padStart(2,'0')} 我要給了，你過來一起核對一下？」` : '該記錄冷藏溫度了（冷藏庫前的紀錄表）。', 'l-key');
  } else if (j.kind==='wq'){
    log(`${j.who} 在窗口多問了一句。`, 'l-con');
  } else if (j.kind==='fu'){
    log(`※ ${j.who} 回來找你：#${String(j.src.n).padStart(2,'0')} ${j.src.pat.nm} 的事。`, 'l-bad');
  } else if (j.kind==='help'){
    j.stage='meet'; j.scope=[]; j.verified=null; j.briefed=false;
    log(`避難民眾 ${j.h.name} 走到領藥窗口：「${j.h.say.slice(0,18)}…」`, 'l-key');
  }
  S.jobs.push(j);
  if (S.sel==null || pending().length===1) S.sel = j.n;
  if (S.autopause && S.running && (j.kind==='emt' || j.kind==='emt2' || j.kind==='cbr' || j.kind==='help' || j.kind==='logi' || j.kind==='lang' || j.stat || j.kind==='con' || j.kind==='fu')){
    S.running = false; syncSpeed();
    if (MOBILE()) setTab('act');
  }
  dirty.q = dirty.detail = true;
  return j;
}
/* ---------- 空檔工作 ----------
   盤點、製冰、備藥包不必一口氣做完。你在等人、在等窗口、在等別人回話的時候做，
   一有工作進來就自動停下，之後從斷點繼續。 */
const BGJOBS = {
  count:{n:'藥品盤點與效期查核', min:16, hint:'指引伍、三：由護理人員或藥師（或指定人員）清查一次庫存與效期',
    done:(by)=>doStocktake(by)},
  ice:{n:'預製冰塊與保冷袋', min:10, hint:'在冷鏈出事之前先準備，出事時可立即投入',
    done:(by)=>{ S.iceReady=true;
      log('保冷袋備妥。冷鏈若中斷可立即投入，多撐約 90 分鐘。','l-cold');
      mark('P5',true,'事前預製冰塊與保冷袋'); }},
  pack:{n:'預先分裝夜間備藥包', min:20, hint:'夜班沒有藥師。現在分裝貼標，晚上護理師就不必從瓶子裡數藥',
    done:(by)=>{ S.packReady=true;
      log('留觀十床的夜間備藥包已分裝貼標。','l-ok');
      narrate('十個小袋子按床號排好，每一個上面都寫著藥名、劑量、時間。你不會在場，但這些字會在。');
      mark('P8',true,'提前完成夜間備藥包分裝與貼標'); }},
  tidy:{n:'整理處方籃與紀錄歸檔', min:8, hint:'把已完成的紙本歸位，降低交接時找不到東西的機會',
    done:(by)=>{ S.tidy=true; log('處方籃與紀錄已歸檔。','l-ok');
      mark('P3',true,'紙本處方與紀錄完成歸檔'); }},
};
function startBg(id){
  const b=BGJOBS[id];
  if (S.bg && S.bg.id===id) return;
  let mult=1;
  const h=activeWith(id==='pack'?'pack':'count');
  if (h) mult = h.briefed?0.55:0.75;
  S.bg={id, name:b.n, remain:b.min*mult, total:b.min*mult, helper:h?h.h.name:null};
  log(`開始空檔工作：${b.n}${h?`（${h.h.name}一起）`:''}`);
  if (!S.over && $('modal').hidden && !S.running){ S.running=true; syncSpeed(); }
  dirty.bg=true;
}
function stopBg(){ if(!S.bg) return; log(`暫停空檔工作：${S.bg.name}（已完成 ${Math.round((1-S.bg.remain/S.bg.total)*100)}%）`);
  S.bgPaused=S.bg; S.bg=null; dirty.bg=true; }
function tickBg(dt){
  if (!S.bg) return;
  if (S.task) return;                       // 手上有正事就先放著
  S.bg.remain -= dt;
  if (S.bg.remain<=0){ const b=BGJOBS[S.bg.id]; const hw=S.bg.helper; S.bg=null; S.bgPaused=null; b.done(hw); }
  dirty.bg=true;
}
function renderBg(){
  const el=$('bgbar');
  if (!S.bg){
    const p=S.bgPaused;
    put('bgbar', `<span class="bgl">空檔工作</span>
      <span class="bgt">${p?`${p.name}　已完成 ${Math.round((1-p.remain/p.total)*100)}%，尚未繼續`:'目前沒有。等人、等窗口、等回話的時候可以做這些：'}</span>
      <span class="bgb">${choreHelpers().map(r=>
        `<button class="sbtn hb" data-chore="${r.h.id}" title="把雜事交給 ${r.h.name} 獨立完成">交給 ${r.h.name}</button>`).join('')}
        ${Object.keys(BGJOBS).map(k=>{
        const dn = (k==='count'&&S.counted)||(k==='ice'&&S.iceReady)||(k==='pack'&&S.packReady)||(k==='tidy'&&S.tidy);
        return `<button class="sbtn" data-bg="${k}" ${dn?'disabled style="opacity:.35"':''}
          title="${BGJOBS[k].hint}">${dn?'✓ ':''}${BGJOBS[k].n}</button>`;}).join('')}</span>`);
    el.className=''; return;
  }
  const pct=Math.max(0,Math.min(100,(1-S.bg.remain/S.bg.total)*100));
  put('bgbar', `<span class="bgl">空檔工作</span>
    <span class="bgt">${S.bg.name}${S.bg.helper?`　·　${S.bg.helper} 一起做`:''}
      ${S.task?'<b class="hold">　—　手上有正事，已自動暫停</b>':`　·　剩 ${S.bg.remain.toFixed(0)} 分`}</span>
    <span class="bgp"><i style="width:${pct.toFixed(0)}%"></i></span>
    <span class="bgb"><button class="sbtn" data-bg="stop">放下</button></span>`);
  el.className = S.task?'held':'run';
}

function startWork(name, min, then){
  if (min<=0){ if (then) then(); dirty.detail=true; return; }   // 不佔時間的工作直接完成
  // 手上的事被突發事件打斷：先做插進來的，做完再回到原本那一件（不然原本那件的收尾——例如「回到藥局」——會消失）
  if (S.task){ (S.taskStack=S.taskStack||[]).push(S.task); log(`暫停「${S.task.n}」，先處理「${name}」。`); }
  S.task={n:name,remain:min,total:min,then}; dirty.detail=true;
  // 你一旦動手，時間就要走。否則「新事件自動暫停」會讓進度條停在原地不動。
  if (!S.over && $('modal').hidden && !S.running){ S.running=true; syncSpeed(); }
}

function dispTime(j){
  // 數藥與數支本身就是那件工作，數完即交付，不再空轉倒數。
  // 只有「沒有空針要跑到別的區去找」這種實際上真的要走路的事，才留時間。
  if (needsCount(j)) return (j.drug.f==='針劑' && !S.sup.sharp) ? 2 : 0;
  let m = j.drug.f==='藥水'?2.5 : 2;
  if (j.pat.child && j.drug.f!=='藥水') m += 2;
  if (j.ctrl) m += 2;
  if (j.cold) m += 1.5;
  if (S.fatigue>60) m *= 1.25;
  if (justServed(j.pat)) m = Math.max(1, m-1);   // 同一個人剛配過一張：藥袋、標籤、交付一起
  const h = activeWith('dispense') || activeWith('pack');
  if (h) m *= h.briefed?0.62:0.78;   // 有人幫忙就快，但沒做過作業簡介的人幫得比較有限
  return m;
}
/* ---------- 數藥 ----------
   口服固體要真的數。罐裝就是數顆；排裝是「幾排又幾顆」，而每一排有幾顆不一定。 */
function needsCount(j){
  if (j.drug.f==='口服' && j.drug.pk) return true;
  return !!vialOf(j);          // 針劑／霧化／輸液：數支數
}
function submitCount(j, total, strips, loose){
  const sig=sigOf(j), d=j.drug;
  const right = total===sig.total;
  const blister = d.pk.type==='blister';
  const packRight = !blister || (strips*d.pk.per+loose===total && loose<d.pk.per);
  j.counted={total, strips, loose, want:sig.total, right, packRight};
  if (right && packRight){
    mark('P2', true, `#${j.n} ${d.n.split(' ')[0]} 數量正確（${sig.per}顆 × ${sig.perDay}次 × ${sig.days}日 = ${sig.total}）`);
  } else if (!right){
    mark('P2', false, `#${j.n} 數量錯誤：給了 ${total}，應為 ${sig.total}（${sig.per}顆 × ${sig.perDay}次 × ${sig.days}日）`);
    log(`※ #${String(j.n).padStart(2,'0')} ${d.n.split(' ')[0]} 數量錯誤：${total} 顆，應為 ${sig.total} 顆。`,'l-bad');
  } else {
    mark('P2', false, `#${j.n} 排裝換算錯誤：${strips} 排又 ${loose} 顆 ≠ ${total}`);
    log(`※ #${String(j.n).padStart(2,'0')} 排裝換算不符。`,'l-warn');
  }
  doDispense(j, j._annotate, total);
}
/* 針劑的數量核對。這一題的答案常常不是 1。 */
function submitVial(j, got, vl){
  const d=j.drug, right = got===vl.need;
  j.counted={total:got, want:vl.need, right, packRight:true, vial:true, unit:vl.unit};
  const how=`${vl.amt}${vl.u} ÷ 一支 ${vl.per}${vl.u}`
    + (vl.days>0?` × ${vl.perDay}次 × ${vl.days}日`:(vl.doses>1?` × ${vl.doses} 次`:''))
    + ` = ${vl.need} ${vl.unit}`;
  if (right){
    mark('P2', true, `#${j.n} ${d.n.split(' ')[0]} 取量正確（${how}）`);
  } else {
    mark('P2', false, `#${j.n} 取量錯誤：拿了 ${got} ${vl.unit}，應為 ${vl.need} ${vl.unit}（${how}）`);
    if (got<vl.need){
      log(`※ #${String(j.n).padStart(2,'0')} ${d.n.split(' ')[0]} 只拿了 ${got} ${vl.unit}，`
        +`一支只有 ${vl.per}${vl.u}，處方要 ${vl.amt}${vl.u}——劑量不夠。`,'l-bad');
    } else {
      log(`※ #${String(j.n).padStart(2,'0')} ${d.n.split(' ')[0]} 多拿了 ${got-vl.need} ${vl.unit}。`
        +(d.st==='ctrl'?'管制藥品的數量必須與簿冊一致。':''),'l-warn');
      if (d.st==='ctrl') mark('P3', false, `#${j.n} 管制藥品取出量與處方不符（多取 ${got-vl.need} ${vl.unit}）`);
    }
  }
  doDispense(j, j._annotate, got);
}
function doDispense(j, annotate, units){
  if (!inZone(player.pos,'pharm')){ log('調劑必須在藥局的獨立作業空間內完成。','l-warn'); return; }
  // 口服固體要先數藥
  if (needsCount(j) && !j.counted){ j._annotate=annotate; j.counting=true; dirty.detail=true;
    reveal('.counttop'); return; }
  const n = units || 1;
  if (j.drug.have < n){
    const nm=j.drug.n.split(' ')[0], wasBlind=!j.drug.counted;
    if (wasBlind){
      // 帳面有、架上沒有——這就是不盤點的代價（同一張只記一次）
      log(`架上找不到那麼多 ${nm}。帳面是 ${j.drug.book}，實際只有 ${j.drug.have}。`,'l-bad');
      say('你', `${nm} 不夠。帳面跟實際對不起來。`, 4200);
      j.drug.book = j.drug.have; j.drug.counted = true;
      if (!j.short) mark('P4', false, `#${j.n} 調劑時才發現 ${nm} 帳面與實際不符`);
    } else {
      // 你早就知道架上有多少：這不是帳的問題，是真的不夠
      log(`架上只有 ${j.drug.have} ${j.drug.u} ${nm}，這張需要 ${n} ${j.drug.u}。`,'l-warn');
    }
    j.short = n;
    j.counting=false; j.counted=null; j.cnt=null; dirty.stock=dirty.detail=true; return;
  }
  // 交付前的標籤核對（手寫或代貼的標籤）
  if (!j.labelDone && labelApplies(j)){ j.labeling={annotate, units}; j.label=makeLabel(j, units);
    dirty.detail=true; reveal('.f-label'); return; }
  if (j.ctrl && !j.ledger){ S.ctrlSkipped++;
    mark('P3',false,`#${j.n} ${j.drug.n} 未完成逐筆登記即取出`);
    log(`※ 管制藥品 ${j.drug.n} 未登記即取出。`,'l-bad'); }
  startWork(`調劑：${j.drug.n}`, dispTime(j)+(annotate?2:0), ()=>{
    j.drug.have = Math.max(0,j.drug.have-n);
    j.drug.book = Math.max(0,j.drug.book-n);
    j.status='done'; j.doneAt=S.t; j.annotated=!!annotate; S.dispensed++;
    j.pat.given.push({d:j.drug.id,t:S.t});
    if (j.flag && j.insisted && annotate){
      // 你問了、對方堅持、你配了並且寫下來——這是藥師能做到的全部，責任已經移轉
      mark('P1',true,`#${j.n} 已提出疑慮（${REASON_N[j.flag]}），開立者堅持原處方，配發並完整註記`);
      mark('P7',true,`#${j.n} 疑慮、對方回覆與最終決定都留下了紀錄`);
      harm(j,'annotated');
      log(`#${String(j.n).padStart(2,'0')} 依 ${j.by} 堅持配發，疑慮已註記。後果不在你這一端。`,'l-warn');
    } else if (j.flag){ harm(j,'rx');
      mark('P1',false,`#${j.n} ${j.pat.nm}：${REASON_N[j.flag]} 未被攔截`
        + (j.insisted?'（你問過了，對方堅持——但你沒有把疑慮寫下來）':''));
      if (['dose','route','ped','sig'].includes(j.flag)) mark('P2',false,`#${j.n} 劑型或劑量問題流出藥局`);
      log(`※ 給藥事件：#${j.n} ${j.pat.nm} ${j.drug.n} — ${REASON_N[j.flag]}`,'l-bad');
    } else {
      mark('P1',true,`#${j.n} ${j.drug.n} 核對後調劑`);
      if (j.pat.child) mark('P2',true,`#${j.n} 兒童劑型處理正確`);
      log(`完成調劑 #${String(j.n).padStart(2,'0')} ${j.pat.nm} ${j.drug.n}`,'l-ok');
    }
    // 沒有辨識就上架的外來品項：含量可能不是你以為的那個
    if (j.drug.unverified>0 && !j.flag && chance(.38)){
      harm(j,'unverified');
      mark('P2', false, `#${j.n} 取到未經辨識的外來品項，含量與本站慣用規格不同`);
      mark('P4', false, `未辨識即上架的後果出現在 ${j.pat.nm} 身上`);
      log(`※ #${String(j.n).padStart(2,'0')} 這一支是外援送來的，含量跟我們慣用的不一樣——`
        +`而沒有人比對過。`,'l-bad');
      j.drug.unverified=Math.max(0,j.drug.unverified-1);
    }
    // 耗材的缺口不會讓你配不出藥，但會改變交出去的東西長什麼樣
    if (!S.sup.label && !S.supWarn.label){ S.supWarn.label=1;
      mark('P2',false,'藥袋與標籤紙用盡，標籤改為手寫（品名劑量易誤讀）');
      log('※ 標籤紙用完了。從這一張開始，藥袋上的字是你手寫的。','l-warn'); }
    if (!S.sup.oral && j.pat.child && j.drug.f==='藥水' && !S.supWarn.oral){ S.supWarn.oral=1;
      mark('P2',false,'無口服注射器與量藥杯，兒童藥水無法精確計量');
      log('※ 沒有量藥杯。你只能跟家屬說「大概到這裡」。','l-bad'); }
    startPickup(j);   // 有人會走過來拿
    // 幫手的失誤：未經作業簡介、或被授權超出其範圍的人參與調劑
    const hp = activeWith('dispense');
    if (hp && !j.flag){
      const risky = hp.h.risky.includes('dispense');
      const chance = risky ? 0.45 : (hp.briefed ? 0.03 : 0.18);
      if (rng() < chance){
        hp.err++; harm(j,'helper');
        const what = risky ? '把外觀相近的品項拿錯' : '拿到同名不同劑量的品項';
        log(`※ ${hp.h.name} 在協助調劑時${what}，你在交付前沒有再核對一次。`,'l-bad');
        mark('P10', false, `${hp.h.name} 協助調劑時發生錯誤（${risky?'超出授權範圍':hp.briefed?'已做作業簡介，仍須交付前再核對':'未完成作業簡介'}）`);
        mark('P1', false, `#${j.n} 經幫手之手的品項未於交付前再核對`);
      }
    }
    if (j.cold && S.fridge>8) mark('P5',false,`#${j.n} 於冷鏈異常期間仍配發冷藏品項`);
    if (j.ctrl && j.ledger){ S.ctrlLedger.push({t:clock(S.t),d:j.drug.n,p:j.pat.nm,dual:j.dual});
      mark('P3',true,`#${j.n} ${j.drug.n} 已逐筆登記${j.dual?'、雙人核對':'（無雙人核對）'}`); }
    if (needsBedside(j)) queueBedside(j);     // 高警訊藥品：要走到床邊再核對一次
    if (j.labelBad) harm(j,'label');          // 標籤寫錯，病人照標籤吃
    else maybeWindowQ(j);                     // 來拿藥的人多問一句
    dirty.q=dirty.stock=dirty.detail=true;
  });
}
/* 相近的退回理由：切點不同但攔截是對的，不該當成判斷錯誤。 */
const NEAR = {
  dose:['ped','renal'], ped:['dose','old'], renal:['dose','inter'],
  old:['ped','inter','dose'], inter:['old','renal'], sig:['dose'],
  route:['sig'], dup:['inter'], stock:['cold'], cold:['stock'], ctrl:[], ident:[],
};

/* 找開立者確認——真正的藥師第一個會做的事，介於「配」與「退回」之間。
   它不會讓你贏，它只是讓你在做決定之前多知道一件事。 */
/* 替代品項的候選清單：同分類、同劑型、以及這張處方真正該換的那一個，
   混在一起依品名排序——所以看清單看不出哪一個是「答案」。
   不用亂數：同一個種子、同一張處方，清單永遠一樣。 */
function subList(j){
  const has=x=>(x.counted?x.have:x.book)>0 && x.id!==j.drug.id;
  const m=new Map();
  DRUGS.filter(x=>x.cat===j.drug.cat && has(x)).forEach(x=>m.set(x.id,x));
  DRUGS.filter(x=>x.f===j.drug.f && x.cat!==j.drug.cat && has(x)).slice(0,6).forEach(x=>m.set(x.id,x));
  if (j.altD && drugById[j.altD] && j.altD!==j.drug.id) m.set(j.altD, drugById[j.altD]);
  return [...m.values()].sort((a,b)=>a.n.localeCompare(b.n)).slice(0,16);
}
function doAsk(j){
  if (S.commsDown>S.t){ log('無線電中斷中，聯絡不上開立者。','l-warn'); return; }
  startWork(`向 ${j.by} 確認 #${String(j.n).padStart(2,'0')}`, T.ask, ()=>{
    j.askAt=S.t; j.asked=(j.asked||0)+1;
    const busyMci = S.t>S_MCI.t-6 && S.t<S_MCI.t+34;
    if (busyMci || chance(.18)){
      j.askRes={v:'away', txt:`${j.by} 在處置區，一時叫不回來。你得自己決定。`};
      log(`${j.by} 現在離不開處置區。#${String(j.n).padStart(2,'0')} 還是你的決定。`,'l-warn');
    } else if (j.flag){
      if (chance(.7)){
        j.askRes={v:'fix', txt:`${j.by}：「……你講得對，是我寫錯了。我改一張給你。」`};
        mark('P1', true, `#${j.n} 主動向開立者確認並促成更正（${REASON_N[j.flag]}）`);
        mark('P7', true, `#${j.n} 以確認代替退回，沒有把給藥流程整個中斷`);
        S.blocked++; j.status='returned'; j.doneAt=S.t; j.viaAsk=true;
        j.reason=j.flag; j.txt='經電話／當面確認後，由開立者自行更正。';
        S.decisions.push({t:clock(S.t),rx:j.n,pat:j.pat.nm,drug:j.drug.n,
          reason:REASON_N[j.flag],txt:'向開立者確認後更正',right:true,hadFlag:true,asked:true});
        S.pending.push({at:S.t+rnd(8,14), src:j, fix:true});
        log(`${j.by} 同意更正 #${String(j.n).padStart(2,'0')}，修正處方稍後送到。`,'l-ok');
        noticePattern(j.by);
      } else {
        j.askRes={v:'hold', txt:`${j.by}：「我知道你的顧慮，但我還是要這樣開。」`
          +`<br><span style="color:var(--ink-faint)">他堅持。你可以照配並把疑慮寫下來，也可以正式退回——兩條路都要留下紀錄。</span>`};
        j.insisted=true;
        mark('P7', true, `#${j.n} 已向開立者提出疑慮（對方仍堅持原處方）`);
        log(`${j.by} 堅持 #${String(j.n).padStart(2,'0')} 原樣開立。`,'l-warn');
      }
    } else {
      j.askRes={v:'ok', txt:`${j.by}：「沒錯，就是這樣開，你配吧。」`};
      j.confirmed=true;
      log(`${j.by} 確認 #${String(j.n).padStart(2,'0')} 無誤。`,'l-key');
    }
    dirty.q=dirty.detail=true;
  });
}
/* 你開始看出規律：今天有問題的處方，幾乎都是同一批人開的。 */
function noticePattern(who){
  S.byBad[who]=(S.byBad[who]||0)+1;
  if (S.byBad[who]===2 && !S.noticed[who]){
    S.noticed[who]=true;
    const d=DOC[who];
    narrate(`第二張了。今天有問題的處方，好像都集中在同一批人身上。`);
    if (d) log(`※ ${who}（${d.sp}）今天第二次。${d.tell}`,'l-key');
  }
}
/* 改用替代品項。缺貨時這是正解；原品項好好的還硬要換，只是多一次轉錄的機會出錯。 */
function doSubstitute(j, altId, verbal, txt){
  const alt = drugById[altId];
  if (!alt){ log('沒有可用的同類替代品項。','l-warn'); return; }
  const stock = j.drug.counted?j.drug.have:j.drug.book;
  const right = j.altD===altId;
  startWork(`替代品項與換算：#${String(j.n).padStart(2,'0')} → ${alt.n.split(' ')[0]}`, T.sub, ()=>{
    j.status='done'; j.doneAt=S.t; j.subTo=alt.n; j.subOk=right;
    alt.have=Math.max(0,alt.have-1); alt.book=Math.max(0,alt.book-1);
    S.dispensed++; j.pat.given.push({d:altId,t:S.t});
    if (!verbal){
      mark('P3',false,`#${j.n} 未取得口頭醫囑即更換品項為 ${alt.n.split(' ')[0]}`);
      mark('P8',false,`#${j.n} 品項更換未留下可追溯的紀錄`);
      log(`※ #${String(j.n).padStart(2,'0')} 自行更換品項，沒有醫囑也沒有紀錄。`,'l-bad');
    } else {
      mark('P8',true,`#${j.n} 口頭醫囑已記錄並請開立者補簽`);
    }
    if (j.flag && right){
      S.blocked++; mark('P1',true,`#${j.n} 攔截並直接給出可用的替代品項（${REASON_N[j.flag]}）`);
      mark('P7',true,`#${j.n} 替代建議正確：${alt.n.split(' ')[0]}`);
      log(`#${String(j.n).padStart(2,'0')} 改用 ${alt.n.split(' ')[0]}，問題解決且沒有中斷給藥。`,'l-ok');
      noticePattern(j.by);
    } else if (j.flag){
      mark('P2',false,`#${j.n} 察覺有問題，但換成 ${alt.n.split(' ')[0]} 並沒有解決（${REASON_N[j.flag]}）`);
      log(`※ #${String(j.n).padStart(2,'0')} 換了品項，但原本的問題還在。`,'l-bad');
      harm(j,'sub');
    } else if (stock<=0){
      mark('P4',true,`#${j.n} 原品項缺貨，以同類替代並完成換算`);
      log(`#${String(j.n).padStart(2,'0')} 原品項缺貨，改用 ${alt.n.split(' ')[0]}。`,'l-ok');
    } else {
      mark('P7',false,`#${j.n} 原品項有庫存且處方無誤，仍更換品項（多一次轉錄風險）`);
      log(`#${String(j.n).padStart(2,'0')} 換了品項——但原本那張並沒有問題。`,'l-warn');
    }
    if (txt) j.subTxt=txt;
    dirty.q=dirty.detail=dirty.stock=true;
  });
}
/* 先給第一劑，其餘暫緩。數量不夠時這是穩住病人的做法；
   問題不在數量的時候，先給一劑一樣會傷到人。 */
function doPartial(j){
  const stock = j.drug.counted?j.drug.have:j.drug.book;
  startWork(`先給第一劑：#${String(j.n).padStart(2,'0')}`, T.partial, ()=>{
    j.partial=true; j.status='done'; j.doneAt=S.t; j.partialOnly=true;
    j.drug.have=Math.max(0,j.drug.have-1); j.drug.book=Math.max(0,j.drug.book-1);
    j.pat.given.push({d:j.drug.id,t:S.t});
    const okCase = j.flag==='stock' || (!j.flag && (j.short || (stock>0 && stock<=3)));
    if (okCase){
      mark('P4',true,`#${j.n} 數量不足，先給第一劑穩住病人，其餘列入待補`);
      log(`#${String(j.n).padStart(2,'0')} 先給第一劑，其餘待補。`,'l-ok');
    } else if (j.flag){
      harm(j,'partial', j.ctrl?2:1);
      mark('P1',false,`#${j.n} 問題不在數量（${REASON_N[j.flag]}），先給一劑仍然把問題給了出去`);
      log(`※ #${String(j.n).padStart(2,'0')} 先給了第一劑——但這張的問題不是數量。`,'l-bad');
      noticePattern(j.by);
    } else {
      mark('P7',false,`#${j.n} 處方無誤卻只給一劑，其餘延後`);
      log(`#${String(j.n).padStart(2,'0')} 只給了第一劑。這張本來可以一次配完。`,'l-warn');
    }
    S.pending.push({at:S.t+rnd(20,34), src:j, remind:true});
    dirty.q=dirty.detail=dirty.stock=true;
  });
}
function doReturn(j, reason, txt){
  startWork(`退回並溝通：#${j.n}`, T.ret, ()=>{
    j.status='returned'; j.doneAt=S.t; j.reason=reason; j.txt=txt; S.returned++;
    startReturnVisit(j);
    // 處方本身沒錯，但架上真的不夠：以「庫存不足」退回並給替代建議，是對的處置
    const shortOK = !j.flag && j.short && j.drug.have < j.short && reason==='stock';
    S.decisions.push({t:clock(S.t),rx:j.n,pat:j.pat.nm,drug:j.drug.n,
      reason:REASON_N[reason],txt,right:j.flag===reason||shortOK,hadFlag:!!j.flag||shortOK});
    if (shortOK){
      mark('P4',true,`#${j.n} 庫存不足以配完整張，以庫存理由退回`);
      if (txt) mark('P7',true,`#${j.n} 庫存不足退回並附替代建議`); else mark('P7',false,`#${j.n} 庫存不足退回但未提供替代建議`);
      log(`退回 #${String(j.n).padStart(2,'0')} — 庫存不足。${j.by} 會依你的建議調整。`,'l-ok');
      S.pending.push({at:S.t+rnd(10,18), src:j, fix:true});
    } else if (j.flag && j.flag===reason){
      S.blocked++;
      mark('P1',true,`#${j.n} 攔截：${REASON_N[reason]}`);
      if (txt) mark('P7',true,`#${j.n} 退回並附替代建議`); else mark('P7',false,`#${j.n} 退回但未提供替代建議`);
      log(`攔截 #${String(j.n).padStart(2,'0')} — ${REASON_N[reason]}。已回報 ${j.by}。`,'l-ok');
      noticePattern(j.by);
      if (j.altD) S.pending.push({at:S.t+rnd(10,18), src:j, fix:true});
    } else if (j.flag && (NEAR[j.flag]||[]).includes(reason)){
      // 攔對了，只是切點不同——這不是判斷錯誤
      S.blocked++;
      mark('P1',true,`#${j.n} 攔截正確（你寫 ${REASON_N[reason]}，實際切點是 ${REASON_N[j.flag]}）`);
      mark('P7',false,`#${j.n} 退回理由的切點與實際不同，開立者可能不知道要改哪裡`);
      log(`攔截 #${String(j.n).padStart(2,'0')} — ${j.by} 看懂了你的意思，但你寫的理由不是他要改的那一點。`,'l-warn');
      noticePattern(j.by);
      if (j.altD) S.pending.push({at:S.t+rnd(12,20), src:j, fix:true});
    } else if (j.flag){
      mark('P1',false,`#${j.n} 察覺有問題但理由判斷錯誤（實為 ${REASON_N[j.flag]}）`);
      log(`退回 #${String(j.n).padStart(2,'0')} — ${j.by} 不同意你的理由，處方將原樣送回。`,'l-warn');
      S.pending.push({at:S.t+rnd(12,20), src:j, reissue:true});
    } else {
      S.wrongBlock++;
      mark('P7',false,`#${j.n} 退回一張無誤的處方，延誤 ${j.pat.nm} 的給藥`
        + (j.confirmed?'（而且你已經問過，對方確認過無誤）':''));
      log(`退回 #${String(j.n).padStart(2,'0')} — ${j.by}：「${j.confirmed?'我剛剛不是說過沒問題嗎？':'這張沒有問題，請儘速配發。'}」`,'l-warn');
      S.pending.push({at:S.t+rnd(8,14), src:j, reissue:true});
    }
    dirty.q=dirty.detail=true;
  });
}
function answerConsult(j, i){
  const o = j.opts[i];
  startWork(`回覆 ${j.who} 的諮詢`, T.con, ()=>{
    j.status='done'; j.doneAt=S.t; j.picked=i;
    if (o.v==='good'){ S.conGood++; mark('P7',true,`${j.who}：${j.q.slice(0,18)}… 回覆正確`);
      log(`回覆 ${j.who} 的諮詢 — 正確。`,'l-ok'); }
    else if (o.v==='mid'){ mark('P7',false,`${j.who} 的諮詢回覆不完整`);
      log(`回覆 ${j.who} 的諮詢 — 方向對但不完整。`,'l-warn'); }
    else { S.conBad++; mark('P7',false,`${j.who}：回覆錯誤`);
      log(`回覆 ${j.who} 的諮詢 — 錯誤。`,'l-bad');
      if (o.effect && FOLLOWUP[o.effect]) S.pending.push({at:S.t+rnd(20,30), follow:o.effect}); }
    if (j.needCount) mark('P4', S.counted && o.v==='good', S.counted?'能依盤點結果回答庫存評估':'未盤點即回答庫存評估');
    dirty.q=dirty.detail=true;
  });
}
function answerEdu(j){
  const good = j.picked.filter(i=>j.pts[i].ok).length;
  const bad  = j.picked.filter(i=>!j.pts[i].ok).length;
  startWork(`用藥諮詢與指導：${j.topic}`, T.edu, ()=>{
    j.status='done'; j.doneAt=S.t; j.score=[good,bad];
    j.pat.educated.push(j.topic);
    if (good>=j.need && bad===0){ S.eduGood++;
      mark('P6',true,`${j.pat.nm}：${j.topic}（${good} 個重點皆正確）`);
      log(`完成用藥指導：${j.pat.nm}　${j.topic}`,'l-ok'); }
    else { S.eduBad++;
      mark('P6',false,`${j.pat.nm}：${j.topic}（正確 ${good}／錯誤 ${bad}）`);
      log(`用藥指導完成，但衛教內容有誤或不完整。`,'l-warn'); }
    dirty.q=dirty.detail=true;
  });
}
function answerEmt(j, i){
  const st = j.steps[j.step], o = st.opts[i];
  j.res.push({q:st.q, t:o.t, v:o.v, fb:o.fb});
  if (o.v==='good'){ S.emtGood++; mark('P9',true,`${j.title}／${st.q}：處置正確`); }
  else if (o.v==='mid'){ mark('P9',false,`${j.title}／${st.q}：處置不理想`); }
  else { S.emtBad++; mark('P9',false,`${j.title}／${st.q}：處置錯誤`);
    if (o.pen){ S.scope++; mark(o.pen,false,`${j.title}：${o.pen==='P9'?'超出 EMT-2 執業範圍':'未依規定程序'}`); } }
  j.step++;
  if (j.step>=j.steps.length){
    j.status='done'; j.doneAt=S.t;
    const g = j.res.filter(r=>r.v==='good').length;
    log(`${j.title} 處置結束（${g}／${j.steps.length} 步驟正確）。返回藥局。`, g===j.steps.length?'l-ok':'l-warn');
    S.fatigue = Math.min(100,S.fatigue+14);
    startWork('返回藥局', T.back, ()=>{ player.pos=[BENCH[0],BENCH[1]+2.5]; player.yaw=Math.PI; });
  }
  dirty.q=dirty.detail=true;
  reveal('.step');
}
