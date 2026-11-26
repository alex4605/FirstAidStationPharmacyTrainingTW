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
  {d:'metf', dose:'500 mg PO bid ×3 天份', flag:'renal', fx:'更昏沉了，呼吸又深又快',
   why:'傷患11 是 82 歲、44 kg 的長者，正在脫水。脫水時 Metformin 有乳酸中毒的風險，這種時候要先暫停。',
   alt:'暫停 Metformin，先補水並評估腎功能，恢復進食後再請醫師決定。'}]},
 {pid:5, preferBy:'林醫師', items:[
  {d:'amlo', dose:'5 mg PO qd ×3 天份', why:'透析病人的降血壓藥，維持原劑量。'},
  {d:'asa',  dose:'100 mg PO qd ×3 天份', why:'維持原本的低劑量 Aspirin。'},
  {d:'glim', dose:'5 mg PO qd ×3 天份', flag:'renal', fx:'冒冷汗、講話不清楚，血糖機量到 45',
   why:'傷患05 在透析、已中斷。腎功能這麼差，Glimepiride 的作用會拉長，低血糖風險高。',
   alt:'先不要配。請醫師重新評估降血糖用藥，並以血糖監測為主。'}]},
];
/* 傍晚的工作：夜班沒有藥師，急救車要在交接前補齊並封好 */
const EVENING_CART = {id:'a7', title:'夜班急救車補藥與交接', who:'周護理師',
  ask:'快交班了。周護理師推著急救車過來：「夜班沒有藥師，這台車今晚就是全部。你幫我一起補齊、封好？」',
  need:3, pts:[
   {t:'依急救車清單逐項清點，缺的從庫房補足並登記',ok:true},
   {t:'核對效期，近效期的前移並標示',ok:true},
   {t:'把高警訊藥的位置與濃度寫在交接單上',ok:true},
   {t:'登記封條編號，夜班開封要記錄時間與原因',ok:true},
   {t:'放一兩支 Morphine 進車裡，夜班找不到你時先用',ok:false},
   {t:'今晚先不上封條，夜班拿東西比較快',ok:false},
   {t:'缺的品項寫在白板上，明天早上再一起補',ok:false}]};
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
  // 每一場至少有一張「錯在格式上」的處方（管制箋缺欄、口頭醫囑、轉抄、連續處方、英文處方）
  if (!rxBad.some(j=>j.lockBy)) rxBad[rxBad.length-1] = sample(rxRaw.filter(j=>!j.stat && j.flag && j.lockBy),1)[0];
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
    if (j.preferBy && DOC[j.preferBy] && (j.lockBy || chance(.8))) n=j.preferBy;   // 格式綁定開立者的題目一定是他開的
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
  /* 一天的形狀：處方從早上一路開到傍晚，不是下午五點就停。
     傍晚另有它自己的事——晚餐前的慢性病領藥、夜班交接前的補藥。 */
  const endT = 690;
  const rest = shuffle(rxAll.filter(j=>!j.stat && !j.bag));
  const rxT = spread(rest.length, 4, 672, 9);
  rest.forEach((j,i)=>{
    let t = rxT[i];
    if (t>mciT-14 && t<mciT+26) t = mciT+26+rint(2,30);   // 大量傷患那一段，一般處方往後推
    const dep = j.flag && DEP[j.flag] && DEP[j.flag].pid===j.pid ? DEP[j.flag] : null;
    out.push({...j, t:Math.round(t), dep});
  });
  // 藥袋：晚餐前的慢性病領藥高峰（17:00–18:00）。同一位病人的處方一起到，幾袋幾乎同時
  const eve = rint(545,575);
  [...new Set(bagJobs.map(j=>j.bag))].forEach((id,i)=>{
    const tb = eve + i*rint(3,8);
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
  // 志工從外面搜刮回來的藥（OTC）：1–2 箱。箱子裡有什麼由種子決定
  place(Array.from({length:rint(1,2)},()=>makeScav()), 130, endT-70, 70, {kind:'scav'});
  // 語言不通的傷患：1–2 位
  place(sample(LANG_CASES, rint(1,2)), 90, endT-70, 60, {kind:'lang'});
  // 窗口前的人：一場 2–4 件
  place(sample(CROWD_CASES, rint(2,4)), 70, endT-40, 55, {kind:'crowd'});
  // 幫手
  HELPERS.forEach(h=>out.push({t:h.t, kind:'help', h}));

  /* 傍晚：領藥人潮跟著藥袋一起來；夜班交接前，急救車要補齊。 */
  { const c=sample(CROWD_CASES.filter(c=>(c.id==='surge'||c.id==='shout') && !out.some(j=>j.kind==='crowd'&&j.id===c.id)),1)[0];
    if (c) out.push({...c, kind:'crowd', t:eve+rint(4,12)}); }
  out.push({...EVENING_CART, kind:'ass', t:rint(645,680)});
  // 黃昏：如果這一場抽到了空襲或通訊中斷，讓其中一個落在天快黑的時候
  { const d=out.find(j=>j.kind==='evt' && (j.id==='raid'||j.id==='comms')); if (d) d.t=rint(585,640); }

  /* 同時發生：真正的排序抉擇不是「下一件做什麼」，而是「三件同時在等，先做哪一件」。
     每場兩次，把一張處方、一件窗口前的事、一個諮詢或求援擠在同一兩分鐘裡。 */
  [rint(100,250), rint(430,520)].forEach(T=>{
    if (T>mciT-20 && T<mciT+40) return;
    const near = out.filter(j=>Math.abs(j.t-T)<70 && j.kind!=='evt' && j.kind!=='help' && !j.dep && !j.bag);
    const groups=[near.filter(j=>j.kind==='rx'), near.filter(j=>j.kind==='crowd'||j.kind==='lang'||j.kind==='edu'),
      near.filter(j=>j.kind==='con'||j.kind==='emt2'||j.kind==='ass')];
    groups.forEach((g,k)=>{ if (g.length) g[0].t = T+k; });
  });

  out.sort((a,b)=>a.t-b.t);
  out.forEach(j=>JOBS.push(j));
  return {mciT, endT, n:out.length};
})();

JOBS.push({t:rint(380,600), kind:'con', who:'葉心理師', role:'心理諮商／社工師',
  q:'避難民眾在傳「要吃碘片才不會被輻射傷到」，已經有人在問我們有沒有。我該怎麼跟他們說？',
  ctx:'本站庫備醫藥品清單（附件六）沒有碘化鉀（KI）。',
  opts:[
   {t:'本站沒有碘化鉀；KI 只防放射性碘、不是萬用防護，請大家以官方通報為準',v:'good',
    fb:'正確。KI 只針對放射性碘對甲狀腺的攝取，不能預防外部曝露或其他核種。這一題的價值在於你同時做了三件事：講清楚我們沒有、糾正「碘片＝防輻射」的錯誤觀念、並阻止民眾自行服用來路不明的碘。'},
   {t:'先跟大家說有在申請，安撫情緒，等真的需要再說',v:'bad',fb:'給不存在的保證，等他們來領藥時你會失去所有信任。'},
   {t:'請大家用優碘擦脖子，可以達到類似碘片的效果',v:'bad',fb:'這是真實流傳過的錯誤訊息，會造成灼傷與碘中毒。'}]});
JOBS.sort((a,b)=>a.t-b.t);
