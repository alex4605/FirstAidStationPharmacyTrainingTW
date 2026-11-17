"use strict";
/* 還開著 STILL OPEN — 以種子隨機編排這一場 */

/* ---------- 4c. 隨機編排這一場 ----------
   處方維持敘事順序（後面的處方會參照前面的事），但每次的「間隔」不同；
   諮詢、衛教、支援作業從題庫抽樣；幫手、CBRNE、大量傷患的時間點都會移動。 */
/* 突發事件池：每一場抽 3–5 個，時間與順序都不一樣。
   每一個都要你在幾秒內決定一件事，而且每一個都會在某個地方回來找你。 */
const EVT_POOL = [
 {id:'raid',   w:14, t:[40,660]}, {id:'comms',  w:12, t:[60,620]},
 {id:'fridged',w:11, t:[70,600]}, {id:'lasa',   w:12, t:[60,640]},
 {id:'water',  w:9,  t:[90,600]}, {id:'ownmeds',w:12, t:[50,640]},
 {id:'neighbor',w:10,t:[120,620]},{id:'asking', w:11, t:[80,650]},
 {id:'label',  w:9,  t:[100,600]},
];
const S_MCI={t:340};
const RX_STAT={total:0,bad:0,by:{}};   // 今天總共幾張處方、其中幾張有問題
/* 藥袋：一位病人的幾張處方一起到。慢性病斷藥的人，平常拿的不只一種病的藥；
   每一張仍要各自核對，但也要看同一袋裡的其他品項有沒有互相打架。
   每場抽 1–2 袋；同一袋由同一位醫師開、相隔一兩分鐘送到。 */
const RX_BAGS = [
 {pid:14, preferBy:'何醫師', items:[
  {d:'amlo', dose:'5 mg PO qd ×7 天份', why:'恢復他原本的降血壓藥，劑量與病史一致。'},
  {d:'metf', dose:'500 mg PO bid ×7 天份', why:'恢復他原本的降血糖藥，劑量合理。'},
  {d:'asa',  dose:'100 mg PO qd ×7 天份', why:'恢復他原本的心血管預防用藥。'}]},
 {pid:11, preferBy:'張醫師', items:[
  {d:'asa',  dose:'100 mg PO qd ×3 天份', why:'長期服用的低劑量 Aspirin，維持原劑量。'},
  {d:'metf', dose:'500 mg PO bid ×3 天份', flag:'renal',
   why:'傷患11 是 82 歲、44 kg 的長者，正在脫水。脫水時 Metformin 有乳酸中毒的風險，這種時候要先暫停。',
   alt:'暫停 Metformin，先補水並評估腎功能，恢復進食後再請醫師決定。'}]},
 {pid:5, preferBy:'林醫師', items:[
  {d:'amlo', dose:'5 mg PO qd ×3 天份', why:'透析病人的降血壓藥，維持原劑量。'},
  {d:'asa',  dose:'100 mg PO qd ×3 天份', why:'維持原本的低劑量 Aspirin。'},
  {d:'glim', dose:'5 mg PO qd ×3 天份', flag:'renal',
   why:'傷患05 在透析、已中斷。腎功能這麼差，Glimepiride 的作用會拉長，低血糖風險高。',
   alt:'先不要配。請醫師重新評估降血糖用藥，並以血糖監測為主。'}]},
];
const SCENARIO = (()=>{
  const raw = JOBS.splice(0, JOBS.length);
  /* 處方池 ＝ 原本的敘事處方 ＋ 補充題庫。
     今天不是每兩張就有一張錯。是二十幾張裡有四、五張，而且幾乎都落在
     被調來代打的那幾個人身上——這才是你在第四天真正會看到的分布。 */
  const rxRaw   = raw.filter(j=>j.kind==='rx').concat(RX_CLEAN, RX_FLAGGED);
  const rxStat  = rxRaw.filter(j=>j.stat);
  // 乾淨的處方題庫比一場用得到的多，所以每場抽一部分——兩場之間不會長一樣
  const rxClean = sample(rxRaw.filter(j=>!j.stat && !j.flag), rint(18,21));
  const rxBad   = shuffle(rxRaw.filter(j=>!j.stat && j.flag)).slice(0, rint(3,4));
  const bagJobs = sample(RX_BAGS, rint(1,2)).flatMap((b,bi)=>b.items.map((it,k)=>
    ({kind:'rx', pid:b.pid, preferBy:b.preferBy, ...it, bag:'B'+(bi+1), bagK:k+1, bagN:b.items.length})));
  const rxAll   = rxStat.concat(rxClean, rxBad, bagJobs);

  /* 誰開的。先把有問題的處方分給「會犯這一種錯的人」，
     再依各人應有的錯誤率補上乾淨的處方——這樣每個人在這一場的個人錯誤率
     才會落在他該有的水準（急診與家醫幾個百分點；代打的兩三成），
     而不是「凡是錯的都是他開的」。剩下的處方依開方量分給大家。 */
  const pick=(cand,wts)=>{ let r=rnd(0,wts.reduce((a,b)=>a+b,0));
    for (let i=0;i<cand.length;i++){ r-=wts[i]; if (r<=0) return cand[i]; }
    return cand[cand.length-1]; };
  const tally={}; PRESCRIBERS.forEach(d=>tally[d.n]={bad:0,ok:0});
  rxStat.concat(rxBad, bagJobs).filter(j=>j.flag).forEach(j=>{
    let n;
    if (j.preferBy && DOC[j.preferBy] && chance(.8)) n=j.preferBy;
    else { const fit=PRESCRIBERS.filter(d=>d.kinds.includes(j.flag));
      const cand=fit.length?fit:PRESCRIBERS;
      n=pick(cand, cand.map(d=>d.err*100)).n; }
    j.by=n; tally[n].bad++;
  });
  const cleanQ = shuffle(rxStat.filter(j=>!j.flag).concat(rxClean, bagJobs.filter(j=>!j.flag)));
  let ci=0, budget=Math.floor(cleanQ.length*.45);   // 代打的人最多拿走四成五，其餘仍是主力在開
  PRESCRIBERS.forEach(d=>{                       // 先補足各人「該有的乾淨處方張數」
    if (!tally[d.n].bad) return;
    const want = Math.min(6, budget, Math.ceil(tally[d.n].bad/d.err)) - tally[d.n].bad;
    for (let k=0;k<want && ci<cleanQ.length;k++,ci++){
      cleanQ[ci].by=d.n; tally[d.n].ok++; budget--; }
  });
  for (; ci<cleanQ.length; ci++){                // 其餘依開方量分
    const d=pick(PRESCRIBERS, PRESCRIBERS.map(x=>x.w*(1-x.err)));
    cleanQ[ci].by=d.n; tally[d.n].ok++;
  }
  // 同一個藥袋＝同一位醫師開的：以有問題的那一張的開立者為準
  const bagBy={};
  bagJobs.forEach(j=>{ const bad=bagJobs.find(x=>x.bag===j.bag&&x.flag); bagBy[j.bag]=(bad||j).by; });
  bagJobs.forEach(j=>{ const to=bagBy[j.bag];
    if (j.by!==to){ const k=j.flag?'bad':'ok'; tally[j.by][k]--; tally[to][k]++; j.by=to; } });
  RX_STAT.total = rxAll.length;
  RX_STAT.bad   = rxAll.filter(j=>j.flag).length;
  RX_STAT.by    = tally;
  const conPool = raw.filter(j=>j.kind==='con').concat(EXTRA_CONSULTS);
  const eduPool = raw.filter(j=>j.kind==='edu').concat(EXTRA_EDU);
  const assPool = ASSISTS.concat(EXTRA_ASSISTS);
  const emtAll = raw.filter(j=>j.kind==='emt');
  const out = [];

  // 大量傷患錨點：STAT 群集跟著它走
  const mciT = rint(290,395); S_MCI.t = mciT;
  out.push({t:mciT, kind:'evt', id:'mci', title:'街口爆炸，大量傷患'});
  const stat = rxAll.filter(j=>j.stat);
  stat.forEach((j,i)=>out.push({...j, t:mciT+2+i*rint(3,6)}));

  // 其餘處方：順序完全打散。有前後關係的那幾張改成「條件成立才會出現」，
  // 所以打散不會讓劇情說不通。
  const DEP = {
    dup:   {pid:1, given:'acet'},          // 重複用藥：要先真的給過一次
    dose:  {pid:12, given:'mor'},          // 劑量翻倍：要先給過原劑量
  };
  const rest = shuffle(rxAll.filter(j=>!j.stat && !j.bag));
  let t = rint(3,9);
  rest.forEach(j=>{
    if (t>mciT-14 && t<mciT+26) t = mciT+28;      // 避開大量傷患那一段
    const dep = j.flag && DEP[j.flag] && DEP[j.flag].pid===j.pid ? DEP[j.flag] : null;
    out.push({...j, t:Math.round(t), dep});
    t += rint(15,31);
  });
  const endT = Math.min(700, t);
  // 藥袋：同一位病人的處方一起到（相隔一兩分鐘）
  [...new Set(bagJobs.map(j=>j.bag))].forEach((id,i)=>{
    let tb = rint(70+i*170, 190+i*170);
    if (tb>mciT-14 && tb<mciT+26) tb = mciT+30;
    bagJobs.filter(j=>j.bag===id).forEach((j,k)=>out.push({...j, t:tb+k}));
  });

  // 抽樣：諮詢 5–6、衛教 3–4、支援作業 3
  function place(list, from, to, jit, extra){
    const ts=spread(list.length, from, to, jit);
    list.forEach((j,i)=>out.push({...j, ...(extra||{}), t:ts[i]}));
  }
  place(sample(conPool, rint(4,6)), 55, endT-30, 40);
  place(sample(eduPool, rint(2,4)), 40, endT-40, 45);
  place(sample(assPool, rint(2,3)), 80, endT-60, 50, {kind:'ass'});

  // EMT-2：大場景這一場只會遇到一個，其餘是護理師隨口的求援
  const big = sample(emtAll, chance(.75)?1:0);   // 大場景不是每一場都有
  place(big, 200, endT-120, 70);
  place(sample(EMT_ASSIST, rint(2,4)), 70, endT-40, 55);

  // CBRNE 不是每一場都有；管制藥品短少七成的場次會發生
  if (chance(.6)) out.push({...CBRNE, kind:'cbr', t:rint(470, Math.max(500,endT-60))});
  if (chance(.7)) out.push({t:rint(430,560), kind:'evt', id:'shortage', title:'管制藥品盤點短少'});
  /* 突發事件：每場抽 3–5 個，不重複，時間各自隨機。 */
  {
    const pool=EVT_POOL.slice(), take=Math.min(pool.length, rint(3,5)), chosen=[];
    for (let k=0;k<take && pool.length;k++){
      const tot=pool.reduce((a,x)=>a+x.w,0); let r=rnd(0,tot), idx=0;
      for (let i=0;i<pool.length;i++){ r-=pool[i].w; if (r<=0){ idx=i; break; } }
      chosen.push(pool.splice(idx,1)[0]);
    }
    const slots=spread(chosen.length, 60, Math.max(120,endT-40), 55);
    chosen.forEach((e,i)=>{
      let t=slots[i];
      t=Math.max(e.t[0], Math.min(e.t[1], t));
      if (t>mciT-10 && t<mciT+30) t=mciT+32;      // 不要跟大量傷患重疊
      out.push({t:Math.round(t), kind:'evt', id:e.id});
    });
  }

  // 物流到訪：2–3 次，來給或來要
  const convoys = sample(CONVOYS, rint(1,3)).map(c=>({kind:'logi', c,
    mode: chance(.55)?'give':'take'}));
  place(convoys, 120, endT-50, 60);
  // 語言不通的傷患：1–2 位
  place(sample(LANG_CASES, rint(1,2)), 90, endT-70, 60, {kind:'lang'});
  // 窗口前的人：一場 2–4 件
  place(sample(CROWD_CASES, rint(2,4)), 70, endT-40, 55, {kind:'crowd'});
  // 幫手
  HELPERS.forEach(h=>out.push({t:h.t, kind:'help', h}));

  out.sort((a,b)=>a.t-b.t);
  out.forEach(j=>JOBS.push(j));
  return {mciT, endT, n:out.length};
})();

JOBS.push({t:rint(380,600), kind:'con', who:'葉心理師', role:'心理諮商／社工師',
  q:'避難民眾在傳「要吃碘片才不會被輻射傷到」，已經有人在問我們有沒有。我該怎麼跟他們說？',
  ctx:'本站庫備醫藥品清單（附件六）沒有碘化鉀（KI）。',
  opts:[
   {t:'本站沒有碘化鉀；而且 KI 只針對放射性碘對甲狀腺的攝取，不是萬用的輻射防護，也不能預防外部曝露或其他核種。請他們以官方通報為準，不要自行服用來路不明的碘',v:'good',
    fb:'正確。這一題的價值在於你同時做了三件事：講清楚我們沒有、糾正「碘片＝防輻射」的錯誤觀念、並阻止民眾自行服用高劑量碘。'},
   {t:'跟他們說有，先安撫情緒再說',v:'bad',fb:'給不存在的保證，等他們來領藥時你會失去所有信任。'},
   {t:'叫他們去買優碘擦脖子',v:'bad',fb:'這是真實流傳過的錯誤訊息，會造成灼傷與碘中毒。'}]});
JOBS.sort((a,b)=>a.t-b.t);
