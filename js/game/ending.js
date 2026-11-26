"use strict";
/* 還開著 STILL OPEN — 20:00 交班、夜間與 AAR */

/* ---------- 9. 20:00：你走不了 ---------- */
const WAKE = [
  {id:'ctrl', n:'任何管制藥品的領用'},
  {id:'cold', n:'冷藏庫溫度異常'},
  {id:'ped',  n:'兒童的任何給藥'},
  {id:'new',  n:'新的醫囑或新收治的傷患'},
  {id:'doubt',n:'任何人對藥品有疑義'},
  {id:'none', n:'不要叫我，除非有人快死了'},
];
function openHandover(){
  S.running=false; S.over=true;
  const q=pending().length;
  const nightHelper = S.helpers.find(x=>x.active && x.scope.includes('night'));
  const packHelper  = S.helpers.find(x=>x.active && x.scope.includes('pack'));
  openModal(`<h1>20:00</h1>
    <p class="kicker">依指引附表：夜班藥師編制 0 人 · 二班輪值 20:00–08:00</p>
    <div class="note warn">你不會下班。外面的路在監視之下，你住的地方在三條街外，而且這是${dayName(DAY)}。
      <b>你今晚睡在這裡。</b>問題從「怎麼交班」變成「你要怎麼撐過今晚，還能有明天早上」。</div>
    ${q?`<div class="note">佇列還有 <b>${q} 項</b>未處理。</div>`:'<div class="note ok">佇列已清空。</div>'}
    <div class="note">目前疲勞 <b>${Math.round(S.fatigue)}／100</b>。
      ${nightHelper?`<b>${nightHelper.h.name}</b> 已被授權夜間值守${nightHelper.briefed?'（已完成作業簡介）':'（<b style="color:var(--warn)">未做作業簡介</b>）'}。`
        :'沒有任何人被授權夜間值守。'}</div>

    <h2>你今晚怎麼過</h2>
    <button class="opt" data-m="awake"><b>整夜自己守著</b>
      <span>所有事都經過你。代價是明天早上你會帶著滿格疲勞開始白班——而指引要求的是人員輪替，不是硬撐。</span></button>
    <button class="opt" data-m="split"><b>分段睡 4 小時，設定叫醒條件</b>
      <span>你睡在庫備品區的行軍床上。符合條件的事會把你叫起來，其餘由現場自行處理。</span></button>
    <button class="opt" data-m="delegate"><b>完整交代後，睡滿</b>
      <span>把整夜交給現場與你授權的人。你明天才有判斷力——前提是你今天留下的東西夠清楚。</span></button>

    <h2>你留下什麼</h2>
    <label class="chk"><input type="checkbox" id="h1" ${packHelper?'checked':''}>
      <span><b>預先分裝備藥包並貼標</b>
      <small>留觀 10 床的常用口服藥依床號分裝、標示藥名劑量時間。${packHelper?`<b style="color:var(--ok)">${packHelper.h.name} 已完成大部分分裝。</b>`:''}</small></span></label>
    <label class="chk"><input type="checkbox" id="h2"><span><b>書面給藥指示與禁忌一覽</b>
      <small>含兒童體重換算表、傷患06 Warfarin 禁 NSAID、傷患10 Penicillin 過敏、傷患09 鼻胃管不可磨粉之品項。</small></span></label>
    <label class="chk"><input type="checkbox" id="h3"><span><b>管制藥品清點與交接簽章</b>
      <small>目前登記 ${S.ctrlLedger.length} 筆${S.ctrlSkipped?`，另有 ${S.ctrlSkipped} 次未登記即取出`:''}。</small></span></label>

    <h2>什麼事要把你叫起來</h2>
    <div class="scopegrid" id="wakebox">${WAKE.map(w=>
      `<label class="scopeitem"><input type="checkbox" data-w="${w.id}"><span>${w.n}</span></label>`).join('')}</div>
    <div class="field"><label>給夜班的一句話</label>
      <textarea id="hnote" placeholder="例：傷患04（6歲20kg）所有退燒止痛一律用藥水，成人錠不要動。傷患06 禁 NSAID。冷藏庫每小時記錄溫度，超過 8℃ 立刻叫我。"></textarea></div>
    <div class="btnrow"><button class="pbtn" id="hdone" disabled style="opacity:.4">先選擇你今晚怎麼過</button></div>`,
    ()=>{
      let mode=null;
      const sh=$('sheet');
      sh.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
        mode=b.dataset.m;
        sh.querySelectorAll('.opt').forEach(x=>x.classList.remove('good'));
        b.classList.add('good');
        const d=$('hdone'); d.disabled=false; d.style.opacity='1'; d.textContent='就這樣過今晚';
      });
      sh.querySelectorAll('.chk').forEach(l=>{ const cb=l.querySelector('input');
        l.classList.toggle('on',cb.checked);
        cb.onchange=()=>l.classList.toggle('on',cb.checked); });
      sh.querySelectorAll('.scopeitem').forEach(l=>{ const cb=l.querySelector('input');
        cb.onchange=()=>l.classList.toggle('on',cb.checked); });
      $('hdone').onclick=()=>{
        if (!mode) return;
        const wake=[...sh.querySelectorAll('[data-w]')].filter(c=>c.checked).map(c=>c.dataset.w);
        S.handover={pack:$('h1').checked,orders:$('h2').checked,ctrl:$('h3').checked,note:esc($('hnote').value.trim())};
        const n=[S.handover.pack,S.handover.orders,S.handover.ctrl].filter(Boolean).length;
        mark('P8', n>=2, `夜間準備完成 ${n}/3 項`);
        if (S.handover.note) mark('P8',true,'留下具體的夜間注意事項');
        else mark('P8',false,'未留下任何書面交代，而夜班沒有藥師');
        if (q>0) mark('P1',false,`進入夜間時仍有 ${q} 項工作未處理`);
        closeModal(false); runNight(mode, wake, nightHelper);
      };
    });
}
function runNight(mode, wake, nh){
  const H=S.handover;
  const has = id => wake.includes(id) && mode!=='delegate';
  const helperOK = nh && nh.briefed && !nh.h.risky.includes('night');
  const helperBad = nh && nh.h.risky.includes('night');
  const ev=[];
  const push=(t,title,ok,txt)=>ev.push({t,title,ok,txt});

  // 22:40 留觀區止痛
  if (H.pack && H.orders)
    push('22:40','留觀區 3 床需要口服止痛','ok','護理師直接取用你分裝貼標好的備藥包，對照書面指示給藥。沒有人需要在半夜從瓶子裡數藥。');
  else if (H.orders)
    push('22:40','留觀區 3 床需要口服止痛','mid','沒有備藥包，護理師自己從瓶子裡數，但你的書面指示讓劑量沒有出錯。花了她 25 分鐘。');
  else if (helperOK)
    push('22:40','留觀區 3 床需要口服止痛','mid',`${nh.h.name} 依你白天做的作業簡介協助取藥，數量正確，但沒有書面指示可對照，${nh.h.ta}停下來確認了三次。`);
  else
    push('22:40','留觀區 3 床需要口服止痛','bad','沒有備藥包也沒有書面指示。護理師在昏暗的藥局裡自己找藥、自己算劑量，其中一床的間隔給錯了。');

  // 01:15 兒童發燒
  if (has('ped'))
    push('01:15','傷患04（6 歲、20 kg）發燒','ok','你被叫醒。你自己換算體重、用 120mg/5mL 藥水給藥，然後回去睡。這是你今晚少數幾次完全正確的事。');
  else if (H.orders)
    push('01:15','傷患04（6 歲、20 kg）發燒','ok','你的書面指示上寫著「所有退燒止痛一律用藥水，成人錠不要動」，護理師照做了。你寫下來的那一行救了這一次。');
  else
    push('01:15','傷患04（6 歲、20 kg）發燒','bad','沒有人知道那個孩子不能用成人錠。半夜一點多，一整顆成人 500 mg 錠餵了下去——那是 25 mg/kg。');

  // 03:30 管制藥品
  if (has('ctrl'))
    push('03:30','傷患12 疼痛，需要管制藥品','ok','你被叫醒，親自開鎖、取藥、逐筆登記、請護理師共同核對，然後回床上。這正是你該被叫醒的事。');
  else if (H.ctrl && helperOK)
    push('03:30','傷患12 疼痛，需要管制藥品','mid',`${nh.h.name} 依交接簿冊完成登記，但雙人核對只有${nh.h.ta}一個人簽。帳對得起來，程序不完整。`);
  else if (helperBad)
    push('03:30','傷患12 疼痛，需要管制藥品','bad',`你白天把夜間值守授權給了 ${nh.h.name}。管制藥品櫃的鑰匙在一個不該拿到它的人手上，而且簿冊沒有登記。`);
  else
    push('03:30','傷患12 疼痛，需要管制藥品','bad','沒有人能開管制藥品櫃，也沒有人敢叫你。那位傷患痛了三個小時，直到早上你自己醒來。');

  // 04:50 冷鏈
  const coldRisk = !S.genOn || S.fuel<40 || S.fridge>6;
  if (coldRisk){
    if (has('cold') || S.fridgeBackup || S.iceReady)
      push('04:50','冷藏庫溫度再次上升','ok','監測到了，也處理了。剩下的 Insulin 與疫苗保住。');
    else
      push('04:50','冷藏庫溫度再次上升','bad','沒有人被交代要看溫度。早上你走過去的時候，面板顯示 14.6℃，已經這樣好幾個小時了。');
  }
  // 白天沒處理好的錯誤，晚上會再出現——這一段引用的是你實際犯的那一筆
  unresolvedFollowUps().slice(0,2).forEach((f,i)=>{
    const s=f.src, dn=(s.enName||s.drug.n).split(' ')[0];
    const watched = has('doubt') || (H.orders && H.note);
    if (watched) push(i?'03:40':'02:20', `${s.pat.nm} 的狀況（#${String(s.n).padStart(2,'0')} ${dn}）`, 'mid',
      `夜班照你留下的交代特別看了他。白天那筆沒有處理完整，但有人在看，狀況沒有再惡化。`);
    else push(i?'03:40':'02:20', `${s.pat.nm} 的狀況（#${String(s.n).padStart(2,'0')} ${dn}）`, 'bad',
      `白天那筆 ${dn} 沒有停藥評估、也沒有寫進紀錄。夜班不知道要看他，直到他的狀況變差才被發現。`);
  });
  // 疲勞
  let fatigue;
  if (mode==='awake'){ fatigue=Math.min(100,S.fatigue+42);
    push('06:00','天亮','mid',`你一夜沒睡。所有事都經過你，所以幾乎沒有出錯——但你現在的判斷力比昨天差得多，而${dayName(DAY+1)}的白班還是只有你一個藥師。`);
    mark('P8', false, '整夜未休息，違反人員輪替原則，隔日作業風險升高'); }
  else if (mode==='split'){ fatigue=Math.max(0,S.fatigue-18);
    push('06:00','天亮','ok',`你睡了大約四個小時，被叫醒 ${ev.filter(e=>e.ok==='ok').length} 次。這是這幾天最接近正常的一晚。`);
    mark('P8', true, '採分段休息並設定明確的叫醒條件'); }
  else { fatigue=Math.max(0,S.fatigue-34);
    if (ev.filter(e=>e.ok==='bad').length>=2){
      push('06:00','天亮','bad','你睡滿了。代價是你早上一進藥局，就看見三件昨晚沒有人處理好的事。');
      mark('P8', false, '完全授權夜間作業，但留下的書面與授權不足以支撐'); }
    else { push('06:00','天亮','ok','你睡滿了，而且站還在運轉。你昨天留下的東西撐住了今晚。');
      mark('P8', true, '完整的書面交代與適當授權，使夜間作業在無藥師下仍安全'); }
  }
  // 夜裡的時間軸：20:00 之後的排前面，跨過午夜的接在後面
  const nk=t=>(t<'12:00'?'1':'0')+t; ev.sort((a,b)=>nk(a.t)<nk(b.t)?-1:1);
  S.night={mode,wake,ev,fatigue};
  ev.forEach(e=>{ if(e.ok==='bad') mark('P8',false,`${e.t} ${e.title}：未能安全處理`);
    else if (e.ok==='ok') mark('P8',true,`${e.t} ${e.title}：安全處理`); });

  const MN={awake:'整夜自己守著',split:'分段睡 4 小時並設定叫醒條件',delegate:'完整交代後睡滿'};
  openModal(`<h1>夜間</h1><p class="kicker">20:00–08:00 · 夜班藥師編制 0 人 · ${MN[mode]}</p>
    <div class="note">${wake.length&&mode!=='delegate'?`叫醒條件：${wake.map(w=>WAKE.find(x=>x.id===w).n).join('、')}`:'未設定叫醒條件。'}</div>
    ${ev.map(e=>`<div class="note ${e.ok==='ok'?'ok':e.ok==='mid'?'warn':''}"
      style="${e.ok==='bad'?'border-left-color:var(--bad)':''}">
      <b>${e.t}　${e.title}</b><br>${e.txt}</div>`).join('')}
    <div class="note">隔日晨間疲勞：<b>${Math.round(fatigue)}／100</b></div>
    <div class="btnrow"><button class="pbtn" id="toaar">產生 AAR</button></div>`,
    ()=>{ $('toaar').onclick=()=>{ closeModal(false); endGame(); }; });
}

/* ---------- 10. AAR ---------- */
function verdict(k){ const e=S.comp[k],t=e.good+e.bad; if(!t)return 3;
  const r=e.good/t; return r>=0.8?0:r>=0.5?1:2; }
const VN=['達成','有條件達成','未達成','本場未評估'];
function endGame(){
  S.over=true; S.running=false;
  const rxs = S.jobs.filter(j=>j.kind==='rx');
  const flagged = rxs.filter(j=>j.flag && !j.reissued);
  const caught = flagged.filter(j=>j.status==='returned' && j.reason===j.flag);
  const rate = flagged.length?Math.round(caught.length/flagged.length*100):100;
  if (S.counted) mark('P4',true,'完成藥品盤點與效期查核'); else mark('P4',false,'全場未執行藥品盤點');
  /* 用完不等於管理失敗——藥本來就是要給出去的。
     失敗的是：明明有補給車來過，你卻沒有替這一項開口。 */
  const outs = DRUGS.filter(d=>d.have<=0);
  const gives = S.jobs.filter(j=>j.kind==='logi' && j.mode==='give' && j.status==='done');
  const asked = new Set(gives.flatMap(j=>j.pickedAt||[]));
  const missedAsk = gives.length ? outs.filter(d=>!asked.has(d.id)) : [];
  if (missedAsk.length) mark('P4',false,`${missedAsk.map(d=>d.n.split(' ')[0]).join('、')} 已歸零，補給到站時未提出請求`);
  else if (outs.length) log(`白班結束時已歸零：${outs.map(d=>d.n.split(' ')[0]).join('、')}。`,'l-warn');
  if (S.scope) mark('P9',false,`${S.scope} 次選擇超出 EMT-2 執業範圍的處置`);

  const rows = Object.keys(COMP).map(k=>{
    const v=verdict(k), e=S.comp[k];
    const ev = e.ev.filter(x=>!x.good).slice(-2).concat(e.ev.filter(x=>x.good).slice(-1))
      .map(x=>`${x.t}　${x.txt}`).join('<br>') || '無紀錄';
    return `<div class="cmrow"><span class="cid">${k}</span>
      <span><b>${COMP[k][0]}</b><span class="cev">${ev}</span></span>
      <span class="verd v${v}">${VN[v]}</span></div>`;
  }).join('');
  const missed = rxs.filter(j=>j.flag && j.status==='done' && !j.reissued);
  const missRows = missed.map(j=>`<tr><td>#${String(j.n).padStart(2,'0')}　${j.pat.nm}</td>
    <td>${j.drug.n}<br><span style="color:var(--ink-faint);font-size:11px">${j.dose}</span></td>
    <td><b style="color:var(--bad)">${REASON_N[j.flag]}</b><br>
    <span style="color:var(--ink-faint);font-size:11px">${j.why||''}</span></td></tr>`).join('')
    || '<tr><td colspan="3">沒有帶著問題流出藥局的處方。</td></tr>';
  const dec = S.decisions.filter(d=>!d.cold).map(d=>`<tr><td>${d.t}</td>
    <td>#${String(d.rx).padStart(2,'0')} ${d.pat}</td>
    <td>${d.reason}<br><span style="color:var(--ink-faint);font-size:11px">${d.txt||'（未附替代建議）'}</span></td>
    <td class="verd ${d.right?'v0':(d.hadFlag?'v1':'v2')}">${d.right?'攔截正確':(d.hadFlag?'理由有誤':'過度阻擋')}</td></tr>`).join('')
    || '<tr><td colspan="4">本場未退回任何處方。</td></tr>';
  const cons = S.jobs.filter(j=>j.kind==='con'&&j.status==='done').map(j=>{
    const o=j.opts[j.picked];
    return `<tr><td>${clock(j.doneAt)}</td><td>${j.who}</td>
      <td>${o.t}<br><span style="color:var(--ink-faint);font-size:11px">${o.fb}</span></td>
      <td class="verd ${o.v==='good'?'v0':o.v==='mid'?'v1':'v2'}">${o.v==='good'?'正確':o.v==='mid'?'不完整':'錯誤'}</td></tr>`;
  }).join('') || '<tr><td colspan="4">本場未回覆任何諮詢。</td></tr>';
  const emts = S.jobs.filter(j=>j.kind==='emt'&&j.status==='done').map(j=>
    `<div class="note emt"><b>${clock(j.doneAt)}　${j.title}</b><br>` +
    j.res.map(r=>`${r.v==='good'?'✓':r.v==='mid'?'△':'✗'}　${r.t}<br>
      <span style="color:var(--ink-faint);font-size:11px">${r.fb}</span>`).join('<br>') + '</div>').join('')
    || '<p>本場未觸發 EMT-2 現場處置。</p>';
  const edus = S.jobs.filter(j=>j.kind==='edu'&&j.status==='done').map(j=>
    `<tr><td>${clock(j.doneAt)}</td><td>${j.pat.nm}</td><td>${j.topic}
       ${j.byHelper?`<br><span style="color:var(--ink-faint);font-size:11px">由 ${j.byHelper} 執行</span>`:''}</td>
     <td class="verd ${j.score[1]===0&&j.score[0]>=j.need?'v0':'v2'}">正確 ${j.score[0]}／錯誤 ${j.score[1]}</td></tr>`).join('')
    || '<tr><td colspan="4">本場未完成任何衛教。</td></tr>';
  const helpRows=S.jobs.filter(j=>j.kind==='help'&&j.status==='done').map(j=>{
    const h=j.h, risky=(j.scope||[]).filter(s=>h.risky.includes(s));
    const rc=S.helpers.find(r=>r.h===h);
    const stay = rc ? (rc.active ? `在站至白班結束（${Math.round(S.t-rc.joinedAt)} 分）`
      : `在站 ${Math.round((rc.leftAt||S.t)-rc.joinedAt)} 分　·　${h.leaveWhy||'離開'}`) : '';
    const v = j.declined ? (h.verify==='bad'?0:1) : (risky.length?2:(j.verified==='doc'?0:1));
    return `<tr><td>${h.name}<br><span style="color:var(--ink-faint);font-size:11px">${h.skill}${
      h.lang?`・會講${h.lang}`:''}${stay?'<br>'+stay:''}</span></td>
      <td>${j.verified==='doc'?'查驗證件與經歷':j.verified?'僅聽其自述':'未查核'}
        <br><span style="color:var(--ink-faint);font-size:11px">${h.verifyTxt.replace(/<[^>]+>/g,'')}</span></td>
      <td>${j.declined?'婉拒':((j.scope||[]).map(s=>SCOPES[s].n).join('、')||'不授權任何項目')}
        ${j.briefed?'<br><span style="color:var(--ok);font-size:11px">已完成作業簡介</span>':(j.declined?'':'<br><span style="color:var(--warn);font-size:11px">未做作業簡介</span>')}</td>
      <td class="verd v${v}">${v===0?'適當':v===1?'可再商榷':'超出範圍'}</td></tr>`;
  }).join('') || '<tr><td colspan="4">本場沒有處理任何前來協助的民眾。</td></tr>';
  const assRows=S.jobs.filter(j=>j.kind==='ass'&&j.status==='done').map(j=>
    `<tr><td>${clock(j.doneAt)}</td><td>${j.title}</td><td>${j.who}</td>
     <td class="verd ${j.score[1]===0&&j.score[0]>=j.need?'v0':'v2'}">正確 ${j.score[0]}／錯誤 ${j.score[1]}</td></tr>`).join('')
    || '<tr><td colspan="4">本場未完成任何支援性作業。</td></tr>';
  const cbrJ=S.jobs.find(j=>j.kind==='cbr'&&j.status==='done');
  const cbrBlock = cbrJ ? `<h2>CBRNE 應變：${cbrJ.title}</h2>` +
    (S.contaminated?'<div class="note" style="border-left-color:var(--bad)"><b>急救站曾遭污染。</b>未除污即進站，後果不只是那三名傷患。</div>':'') +
    cbrJ.res.map(r=>`<div class="note ${r.v==='good'?'ok':r.v==='mid'?'warn':''}"
      style="${r.v==='bad'?'border-left-color:var(--bad)':''}"><b>${r.q}</b><br>
      ${r.v==='good'?'✓':r.v==='mid'?'△':'✗'} ${r.t}<br><br>${r.fb}</div>`).join('')
    : '<h2>CBRNE 應變</h2><p>本場未觸發或未處理 CBRNE 事件。</p>';
  const logiRows=S.jobs.filter(j=>j.kind==='logi'&&j.status==='done').map(j=>
    `<tr><td>${clock(j.doneAt)}</td><td>${j.c.f}<br><span style="color:var(--ink-faint);font-size:11px">${j.mode==='give'?'補給到站':'前來徵調'}</span></td>
     <td>${j.mode==='give'?((j.got&&j.got.length)?j.got.join('、'):'未提出任何需求')
        :((j.gave&&j.gave.length)?j.gave.join('、')+(j.recAt?'（已辦紀錄）':'<b style="color:var(--warn)">（未辦紀錄）</b>'):'拒絕調出')}</td>
     <td style="color:var(--ink-faint);font-size:11px">${j.whyAt||'（未說明）'}</td></tr>`).join('')
    || '<tr><td colspan="4">本場沒有物流到訪，或你沒有處理。</td></tr>';
  const langRows=S.jobs.filter(j=>j.kind==='lang'&&j.status==='done').map(j=>
    `<tr><td>${clock(j.doneAt)}</td><td>${j.nm}（${j.flagTxt}）</td>
     <td class="verd ${j.score[2]?'v2':(j.score[1]===0&&j.score[0]>=j.need?'v0':'v1')}">
       ${j.score[2]?'涉及身分推測':(j.score[1]===0&&j.score[0]>=j.need?'完整':'不完整')}
       <br><span style="color:var(--ink-faint);font-size:11px">正確 ${j.score[0]}／不當 ${j.score[1]}</span></td></tr>`).join('')
    || '<tr><td colspan="3">本場未遇到語言障礙的傷患，或你沒有處理。</td></tr>';
  const MN2={awake:'整夜自己守著',split:'分段睡 4 小時並設定叫醒條件',delegate:'完整交代後睡滿'};
  const nightBlock = S.night ? `<h2>夜間（無藥師編制）</h2>
    <div class="note">你的選擇：<b>${MN2[S.night.mode]}</b>　·
      叫醒條件：${S.night.wake.length&&S.night.mode!=='delegate'?S.night.wake.map(w=>WAKE.find(x=>x.id===w).n).join('、'):'未設定'}</div>
    ${S.night.ev.map(e=>`<div class="note ${e.ok==='ok'?'ok':e.ok==='mid'?'warn':''}"
      style="${e.ok==='bad'?'border-left-color:var(--bad)':''}"><b>${e.t}　${e.title}</b><br>${e.txt}</div>`).join('')}` : '';
  const coldDec = S.decisions.filter(d=>d.cold).map(d=>
    `<div class="note cold"><b>${d.t}　冷鏈處置</b><br>${d.choice}<br>${d.txt||'（未記錄理由）'}</div>`).join('');

  openModal(`<h1>行動後檢討 AAR</h1>
    <p class="kicker">藥師（EMT-2）· ${dayName(DAY)}白班 08:00–20:00 · 第一類急救站</p>
    <div class="tblwrap"><table>
      <tr><th>處方</th><th>調劑</th><th>退回</th><th>正確攔截</th><th>過度阻擋</th><th>給藥事件</th><th>攔截率</th></tr>
      <tr><td>${rxs.length}</td><td>${S.dispensed}</td><td>${S.returned}</td><td>${S.blocked}</td>
        <td>${S.wrongBlock}</td><td>${S.errors}</td><td><b>${rate}%</b></td></tr></table></div>
    <div class="tblwrap"><table>
      <tr><th>向開立者確認</th><th>促成更正</th><th>替代品項</th><th>先給第一劑</th><th>諮詢正確</th><th>諮詢錯誤</th><th>衛教完整</th></tr>
      <tr><td>${rxs.filter(j=>j.asked).length}</td><td>${rxs.filter(j=>j.viaAsk).length}</td>
        <td>${rxs.filter(j=>j.subTo).length}</td><td>${rxs.filter(j=>j.partial).length}</td>
        <td>${S.conGood}</td><td>${S.conBad}</td><td>${S.eduGood}</td></tr></table></div>
    <div class="tblwrap"><table>
      <tr><th>支援作業</th><th>EMT 正確步驟</th><th>越權處置</th><th>打擊</th></tr>
      <tr><td>${S.assGood}／${S.assGood+S.assBad}</td>
        <td>${S.emtGood}</td><td>${S.scope}</td><td>${S.strikes}</td></tr></table></div>
    <div class="tblwrap"><table>
      <tr><th>前來協助</th><th>你授權</th><th>完成作業簡介</th><th>超出範圍的授權</th><th>CBRNE 正確步驟</th><th>急救站污染</th></tr>
      <tr><td>${S.jobs.filter(j=>j.kind==='help').length}</td><td>${S.helpers.length}</td><td>${S.briefed}</td>
        <td>${S.overAuth}</td><td>${S.cbrGood}</td><td>${S.contaminated?'<b style="color:var(--bad)">是</b>':'否'}</td></tr></table></div>
    <h2>能力矩陣</h2><div class="cmat">${rows}</div>
    <p style="margin-top:9px;color:var(--ink-faint);font-size:11.5px">不給總分。這份表的用途是帶討論，不是排名。</p>
    <h2>今天的處方是誰開的</h2>
    <div class="tblwrap"><table>
      <tr><th>開立者</th><th>本職</th><th>張數</th><th>其中有問題</th><th>你攔下</th></tr>
      ${PRESCRIBERS.map(d=>{
        const mine=rxs.filter(j=>j.by===d.n);
        if (!mine.length) return '';
        const bd=mine.filter(j=>j.flag).length;
        const ct=mine.filter(j=>j.flag&&j.status==='returned').length;
        return `<tr><td><b>${d.n}</b></td><td style="color:var(--ink-faint)">${d.sp}</td>
          <td>${mine.length}</td>
          <td style="color:${bd?'var(--warn)':'var(--ink-dim)'}">${bd}${bd?`（${Math.round(bd/mine.length*100)}%）`:''}</td>
          <td style="color:${bd&&ct===bd?'var(--ok)':bd?'var(--bad)':'var(--ink-faint)'}">${bd?ct+'／'+bd:'—'}</td></tr>`;
      }).join('')}</table></div>
    <div class="note">今天 <b>${rxs.length}</b> 張處方裡有 <b>${rxs.filter(j=>j.flag).length}</b> 張帶著問題——
      這不是「醫師很會開錯」，而是${dayName(DAY)}的班表上，有幾個人正在做他平常不做的事。
      ${PRESCRIBERS.filter(d=>rxs.some(j=>j.by===d.n&&j.flag)).map(d=>
        `<br><br><b>${d.n}</b>（${d.sp}）：${d.tell}`).join('')}
      <br><br><span style="color:var(--ink-faint)">這一欄不是用來檢討醫師的。是用來說明一件事：
      把人放到他不熟的位置上，錯誤會落在可以預測的那幾格裡——知道會落在哪幾格，正是藥師站在這裡的理由。</span></div>
    <h2>帶著問題流出藥局的處方</h2>
    <div class="tblwrap"><table><tr><th>處方</th><th>品項</th><th>問題</th></tr>${missRows}</table></div>
    <h2>錯誤之後</h2>
    <div class="tblwrap"><table><tr><th>回來的時間</th><th>誰回來找你</th><th>發生什麼</th><th>你的處理</th></tr>${
      S.jobs.filter(j=>j.kind==='fu').map(j=>{ const o=j.status==='done'?j.opts[j.picked]:null;
        return `<tr><td>${clock(j.issued)}</td><td>${j.who}<br><span style="color:var(--ink-faint);font-size:11px">回到 #${String(j.src.n).padStart(2,'0')}</span></td>
          <td>${j.q}</td><td class="verd ${!o?'v2':o.v==='good'?'v0':o.v==='mid'?'v1':'v2'}">${!o?'沒有處理':o.v==='good'?'如實處理':o.v==='mid'?'紀錄未跟上':'處理不當'}</td></tr>`; }).join('')
      || '<tr><td colspan="4">今天沒有錯誤回來找你。</td></tr>'}</table></div>
    <h2>退回決策回放</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>處方</th><th>你的理由</th><th>判定</th></tr>${dec}</table></div>
    <h2>跨職類諮詢</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>來源</th><th>你的回覆</th><th>判定</th></tr>${cons}</table></div>
    <h2>用藥衛教</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>對象</th><th>主題</th><th>判定</th></tr>${edus}</table></div>
    <h2>EMT-2 現場處置</h2>${emts}
    <h2>站內幫手：查核、授權與督導</h2>
    <div class="tblwrap"><table><tr><th>對象</th><th>你做的查核</th><th>授權範圍</th><th>判定</th></tr>${helpRows}</table></div>
    <h2>支援性作業</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>作業</th><th>請託者</th><th>判定</th></tr>${assRows}</table></div>
    ${cbrBlock}
    <h2>外來品項辨識</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>來源</th><th>品項</th><th>判定</th></tr>
      ${S.jobs.filter(j=>j.kind==='idn'&&j.status==='done').map(j=>
        `<tr><td>${clock(j.doneAt)}</td><td>${j.from}</td>
          <td>${j.items.map(x=>x.brand).join('<br>')}</td>
          <td class="verd ${j.skipped?'v2':'v0'}">${j.skipped?'未辨識即上架':'已比對後入庫'}</td></tr>`
      ).join('') || '<tr><td colspan="4">本場沒有外來品項需要辨識。</td></tr>'}
    </table></div>
    <h2>志工搜刮回來的藥</h2>
    ${S.jobs.filter(j=>j.kind==='scav'&&j.status==='done').map(j=>`
      <p style="color:var(--ink-faint);font-size:12px">${clock(j.doneAt)}　·　${j.from.who}　·　${j.from.where}　·
        ${j.recAt?'來源已登記':'<b style="color:var(--warn)">來源未登記</b>'}</p>
      <div class="tblwrap"><table><tr><th>品項</th><th>你的處理</th><th>應該</th><th>判定</th></tr>
      ${j.rows.map((r,i)=>{ const v=j.result.rows[i];
        return `<tr><td>${r.name}${r.packTxt?`<br><span style="color:var(--ink-faint);font-size:11px">${r.packTxt}</span>`:''}</td>
          <td>${v.label}</td><td>${v.should}</td>
          <td class="verd ${v.v==='good'?'v0':v.v==='mid'?'v1':'v2'}">${v.v==='good'?'正確':v.v==='mid'?'可以更好':'錯誤'}${
            v.v!=='good'&&v.note?`<br><span style="font-weight:400;font-size:11px">${v.note}</span>`:''}</td></tr>`; }).join('')}
      </table></div>`).join('') || '<p>本場沒有志工帶藥回來，或你沒有處理。</p>'}
    <h2>物資調撥與外部協調</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>對象</th><th>結果</th><th>理由</th></tr>${logiRows}</table></div>
    <h2>現場秩序與情緒處理</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>狀況</th><th>誰到場</th><th>判定</th></tr>
      ${S.jobs.filter(j=>j.kind==='crowd'&&j.status==='done').map(j=>
        `<tr><td>${clock(j.doneAt)}</td><td>${j.title}<br>
          <span style="color:var(--ink-faint);font-size:11px">${j.who}</span></td>
         <td>${j.helperTook||'你自己'}</td>
         <td class="verd ${j.score[2]?'v2':(j.score[1]===0&&j.score[0]>=j.need?'v0':'v1')}">
           ${j.score[2]?'以藥物處理情緒':(j.score[1]===0&&j.score[0]>=j.need?'處理適當':'不完整')}
           <br><span style="color:var(--ink-faint);font-size:11px">適當 ${j.score[0]}／不適當 ${j.score[1]}</span></td></tr>`
      ).join('') || '<tr><td colspan="4">本場窗口前沒有狀況，或你沒有處理。</td></tr>'}
    </table></div>
    <h2>語言障礙下的用藥安全</h2>
    <div class="tblwrap"><table><tr><th>時間</th><th>對象</th><th>判定</th></tr>${langRows}</table></div>
    ${nightBlock}
    ${coldDec?'<h2>冷鏈決策</h2>'+coldDec:''}
    <h2>庫存結算</h2>
    <div class="tblwrap"><table><tr><th>品項</th><th>七日儲備</th><th>剩餘</th></tr>
      ${DRUGS.filter(d=>d.have<d.q).sort((a,b)=>(a.have/a.q)-(b.have/b.q)).slice(0,10).map(d=>
        `<tr><td>${d.n}</td><td>${d.q} ${d.u}</td><td style="color:${d.have<=0?'var(--bad)':d.have/d.q<.3?'var(--warn)':'var(--ink-dim)'}">${d.have} ${d.u}</td></tr>`).join('')}
    </table></div>
    <h2>交班</h2>
    <div class="note">備藥包 ${S.handover.pack?'✓':'✗'}　書面給藥指示 ${S.handover.orders?'✓':'✗'}　管制藥品交接 ${S.handover.ctrl?'✓':'✗'}
      ${S.handover.note?`<br><br>給夜班的一句話：<br><b>${S.handover.note}</b>`:'<br><br>沒有留下任何書面交代。夜班沒有藥師。'}</div>
    <h2>本場紀錄</h2>
    <div style="max-height:170px;overflow:auto;font-family:var(--mono);font-size:10.5px;color:var(--ink-dim);background:#0e1214;padding:9px;border:1px solid var(--line)">
      ${S.log.map(l=>`${l.t}　${l.m}`).join('<br>')}</div>
    <div class="btnrow">${storeOK?`<button class="pbtn" id="nextday">接續${dayName(DAY+1)}</button>`:''}<button class="${storeOK?'gbtn':'pbtn'}" id="again">再跑一場</button>
      <button class="gbtn" id="closeaar">關閉</button></div>`,
    ()=>{ if ($('nextday')) $('nextday').onclick=goNextDay;
      $('again').onclick=()=>{ if (DAY>4){ location.hash=`#seed=${SEED}`; } location.reload(); }; $('closeaar').onclick=()=>{$('modal').hidden=true;}; });
}
