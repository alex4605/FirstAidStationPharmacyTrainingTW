"use strict";
/* 還開著 STILL OPEN — 錯誤之後
   給錯的藥不會只留在紀錄上。它會在三十到九十分鐘後，從別人的嘴裡回到你面前：
   護理師說病人怎麼了、家屬回到窗口、站長清點時對不起來。
   你那時候怎麼回應——停藥、請醫師評估、如實記錄並告知——也是一個決定。 */

/* 讓一位病人承受了錯誤，並排定它回來的時間。
   cause：rx 照配了有問題的處方／annotated 已註記但仍配出／sub 換錯品項／partial 先給一劑但問題不在數量
          helper 幫手調劑出錯／helperRx 幫手獨立配出有問題的處方／unverified 未辨識的外來品項 */
function harm(j, cause, n){
  S.errors++; j.pat.harm += (n||1);
  if (S.over) return;
  S.pending.push({at:S.t+rnd(35,90), fu:{j, cause}});
}

/* 錯在哪一格，就從哪裡回來 */
const FU_TYPE = flag => flag==='stock' ? 'stock' : flag==='ctrl' ? 'ctrl' : 'clin';
const FU_GENERIC = {
  dose:'比平常嗜睡、反應變慢', ped:'吐了兩次，比平常想睡', renal:'尿量變少，人也比較昏沉',
  inter:'出現了新的狀況，護理師說跟早上不太一樣', dup:'說噁心、右上腹悶悶的',
  route:'吞不下去、一直嗆咳', sig:'護理師照自己的理解給，間隔跟你想的不一樣，現在很想睡',
  old:'變得比較混亂，一直想下床', ident:'藥給到了另一個人手上', cold:'這一劑好像沒有效果',
  helper:'吃了之後說頭暈、心悸，護理師對了一下藥袋，覺得品項怪怪的',
  unverified:'用了之後反應比預期大，護理師說這一支的含量好像不一樣',
};

function spawnFollowUp(fu){
  const j=fu.j, p=j.pat, dn=(j.enName||j.drug.n).split(' ')[0];
  const reason = j.flag || (fu.cause==='unverified'?'unverified':'helper');
  const type = (fu.cause==='helper'||fu.cause==='unverified') ? 'clin' : FU_TYPE(reason);
  const who = type==='ctrl' ? '站長' : p.child ? '家屬' : pick(NURSES);
  const role = type==='ctrl' ? '站長' : p.child ? '家屬' : '護理師';
  const when = clock(j.doneAt!=null ? j.doneAt : S.t);
  let q, opts;
  if (type==='stock'){
    q=`有一位傷患需要 ${dn}，但架上已經沒有了。稍早那張 #${String(j.n).padStart(2,'0')}（${p.nm}）是照開立的量整張給出去的。`;
    opts=[
      {t:`先找本站可用的替代品項並請醫師評估，把缺口與原因寫進庫存紀錄，回報站長申請調撥`, v:'good',
       fb:'正確。缺藥已經發生，現在能做的是找替代、讓醫師決定，並把這個缺口變成調撥的依據。下一次同樣的處方來時，你會先想到庫存。'},
      {t:`先跟護理師說沒有了，請醫師自己想辦法換藥，庫存紀錄等交班時再一起補`, v:'mid',
       fb:'把問題丟回醫師沒有錯，但你比誰都清楚站內還有什麼可以替代；紀錄拖到交班，調撥的依據就晚了半天。'},
      {t:`先跟鄰區急救站借一點應急，數量不用另外登記，等補給到了再還回去`, v:'bad',
       fb:'沒有紀錄的調撥，兩邊的帳都會對不起來，而且借來的量也沒有人追得到。'},
      {t:`把今天其他病人還沒領走的份量先挪過來給他，之後補給到了再補回去`, v:'bad',
       fb:'挪走別人的份量，等於把這個缺口轉到另一個人身上，而且沒有任何人決定過這件事。'}];
  } else if (type==='ctrl'){
    q=`我在清點管制藥品。#${String(j.n).padStart(2,'0')} 那一筆 ${dn}（${p.nm}，${when}）的處方與登記對不起來——缺的是程序上的那一塊。這一筆你怎麼說？`;
    opts=[
      {t:`如實說明經過，請開立者補正本處方與簽章，在簿冊登記異常並通報站長`, v:'good',
       fb:'正確。管制藥品的程序缺口補不回「當時有做」，但可以如實補齊、如實登記。這一筆會留在紀錄上——留下的是誠實的那個版本。'},
      {t:`請開立者補簽正本處方，簽好就算補齊了，異常就不另外登記`, v:'mid',
       fb:'補簽是必要的，但不登記異常，等於讓簿冊看起來從來沒有出過問題——下一次查核時對不起來的會是你。'},
      {t:`在簿冊那一筆補上雙人核對的簽名，跟護理師說好當時有一起看過`, v:'bad',
       fb:'事後補一個當時不存在的核對，是偽造紀錄。這比原本的程序缺口嚴重得多。'},
      {t:`跟站長說是大量傷患時處方被收走了，晚點應該找得回來`, v:'bad',
       fb:'沒有依據的說法，會讓真正的流向永遠查不清楚。'}];
  } else {
    const sym = j.fx || FU_GENERIC[reason] || FU_GENERIC.inter;
    q=`${p.nm} ${sym}。他是 ${when} 從你這裡拿到 ${dn} 的。現在怎麼辦？`;
    if (p.sex==='女') q=q.replace('他是','她是');
    if (p.child) q=q.replace(/^/,'（家屬回到領藥窗口）');
    opts=[
      {t:`先停用 ${dn}，請醫師立即評估${p.nm}；把經過寫進用藥疏失紀錄，並如實告知病人與家屬`, v:'good',
       fb:'正確。先處理人，再處理事——但兩件事都要做。用藥疏失如實記錄、對病人與家屬說明，是災時也不能省的程序；這份紀錄也讓下一班知道要看什麼。'},
      {t:`先停用 ${dn} 並請醫師評估；疏失紀錄等交班時再一起寫，現在先顧病人`, v:'mid',
       fb:'停藥與評估是對的，但紀錄拖到交班，細節會不見，接手的人也不知道要觀察什麼。'},
      {t:`先觀察一小時，可能是本來的病程，不一定跟 ${dn} 有關；有變化再請醫師過來`, v:'bad',
       fb:'新的症狀，時間點剛好在給藥之後。這時候說「不一定是藥」，等於什麼都沒做。'},
      {t:`請醫師過來評估，但先不要提到藥的事，免得家屬情緒更大，之後我再私下跟醫師說明`, v:'bad',
       fb:'隱匿會讓下一個照顧他的人不知道要看什麼，也違反用藥疏失的通報原則。'}];
  }
  pushJob({kind:'fu', t:S.t, who, role, q, opts, src:j, fuType:type, cause:fu.cause});
  p.events = p.events || [];
  p.events.push({t:clock(S.t), txt: type==='stock'?`${dn} 缺貨，其他病人拿不到` : type==='ctrl'?`${dn} 管制程序對不起來` : `${dn} 給藥後出現狀況`});
}

function answerFollowUp(j, i){
  const o=j.opts[i];
  startWork(`處理 #${String(j.src.n).padStart(2,'0')} 的後續`, T.con, ()=>{
    j.status='done'; j.doneAt=S.t; j.picked=i;
    const k = j.fuType==='stock' ? 'P4' : j.fuType==='ctrl' ? 'P3' : 'P7';
    const nm=j.src.pat.nm;
    if (o.v==='good'){ mark(k,true,`#${j.src.n} 出事之後：${j.fuType==='clin'?'停藥、請醫師評估、如實記錄並告知':'如實處理並留下紀錄'}`);
      log(`#${String(j.src.n).padStart(2,'0')} 的後續：${nm} 已處理，經過寫進紀錄。`,'l-ok'); }
    else if (o.v==='mid'){ mark(k,false,`#${j.src.n} 出事之後：處置對了，但紀錄沒有跟上`);
      log(`#${String(j.src.n).padStart(2,'0')} 的後續：處置了，紀錄還沒寫。`,'l-warn'); }
    else { mark(k,false,`#${j.src.n} 出事之後：${j.fuType==='clin'?'沒有停藥評估或隱匿了藥的關聯':'紀錄不實或把缺口轉嫁出去'}`);
      if (j.fuType==='clin') j.src.pat.harm++;
      log(`※ #${String(j.src.n).padStart(2,'0')} 的後續沒有處理好。`,'l-bad'); }
    dirty.q=dirty.detail=true;
  });
}
function renderFu(j){
  renderChoiceJob(j, {
    title:`後續 #${String(j.n).padStart(2,'0')}　<span style="font-size:11px;color:var(--ink-faint)">回到 #${String(j.src.n).padStart(2,'0')}</span>`,
    sub:`${j.who}（${j.role}）· ${clock(j.issued)}${j.status==='done'?'　·　已處理':'　·　人在領藥窗口'}`,
    paper:'後續',
    rows:`<div class="prow"><span>來源</span><b>${j.who}</b></div>
      <div class="prow"><span>狀況</span><b class="big" style="font-size:12.5px;line-height:1.5">${j.q}</b></div>
      <div class="prow"><span>當時</span><b style="color:var(--ink-dim)">#${String(j.src.n).padStart(2,'0')}　${j.src.pat.nm}　${(j.src.enName||j.src.drug.n)}　${j.src.dose}</b></div>`,
    doneLabel:'你的處理', foot:`處理需要 ${T.con} 分鐘。`,
    submit:answerFollowUp});
}
/* 夜間：白天沒處理好的那幾筆，晚上會再出現一次 */
function unresolvedFollowUps(){
  return S.jobs.filter(j=>j.kind==='fu' && j.fuType==='clin' && (j.status==='pending' || j.opts[j.picked].v!=='good'));
}
