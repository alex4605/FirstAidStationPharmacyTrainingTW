"use strict";
/* 還開著 STILL OPEN — 處方箋的格式
   同一張處方，寫在不同的紙上，要核對的欄位就不一樣：
   一般處方箋、管制藥品專用處方箋、口頭醫囑紀錄、護理轉抄的醫囑單、
   慢性病連續處方箋、以及外籍醫師的英文處方。
   格式只決定「紙長什麼樣子、多了哪些欄位」；對錯仍由處方本身決定。 */

const RX_FMT = {
  std:       {t:'處方箋',             chip:''},
  ctrl:      {t:'管制藥品專用處方箋', chip:'管制箋'},
  oral:      {t:'口頭醫囑紀錄',       chip:'口頭'},
  transcribe:{t:'醫囑轉抄單',         chip:'轉抄'},
  chronic:   {t:'慢性病連續處方箋',   chip:'連續'},
  en:        {t:'Rx · English',       chip:'EN'},
};
/* 管制藥品使用執照號碼（遊戲用，虛構） */
const DOC_LIC = {'張醫師':'第 113-0027 號','何醫師':'第 108-0411 號','林醫師':'第 105-0932 號',
  '陳醫師':'第 111-0584 號','郭醫師':'第 079-0136 號'};

function rxFormat(j){
  if (j.fmt) return j.fmt;
  if (j.oral) return 'oral';
  if (/護理師$/.test(j.by)) return 'transcribe';
  if (j.by==='NGO 醫師') return 'en';
  if (j.ctrl) return 'ctrl';
  if (j.bag || /×\s*([7-9]|\d\d)\s*天/.test(j.dose)) return 'chronic';
  return 'std';
}
/* 處方上寫的藥名：英文處方可能是別的學名或縮寫 */
const rxName = j => j.enName || j.drug.n;

/* 外籍醫師寫的用法：把題庫裡的中文用語換成他會寫的樣子 */
function enSig(s){
  return s.replace(/×\s*(\d+)\s*天份?/g,'x $1 days').replace(/霧化/g,'neb').replace(/外用塗抹/g,'apply topically')
    .replace(/每日換藥/g,'change daily').replace(/依血糖滑動劑量/g,'per sliding scale')
    .replace(/依脫水程度少量多次補充/g,'small frequent sips').replace(/分次餵食/g,'divided')
    .replace(/1 包溶於/g,'1 sachet in').replace(/以 5% 葡萄糖稀釋後緩推/g,'in D5W, slow push')
    .replace(/以生理食鹽水稀釋後緩推/g,'in NS, slow push').replace(/，/g,', ').replace(/　/g,' ');
}
const sexEn = s => s==='女'?'F':'M';

function rxPaper(j){
  const p=j.pat, f=rxFormat(j), by=j.by;
  const row=(k,v,cls)=>`<div class="prow"><span>${k}</span><b${cls?` class="${cls}"`:''}>${v}</b></div>`;
  const bag = j.bag ? row('藥袋',`同一袋 ${j.bagK}/${j.bagN}　同袋其他品項：${S.jobs.filter(x=>x.kind==='rx'&&x.bag&&x.bag===j.bag&&x.n!==j.n)
      .map(x=>x.drug.n.split(' ')[0]).join('、')||'尚未全部到齊'}`) : '';
  const pt = row('病人',`${p.nm}　${p.age}歲${p.sex}　${p.wt} kg`);
  const tail = (j.ctrl&&f!=='ctrl'?'　（管制藥品）':'')+(j.stat?'　STAT':'');
  let body;
  if (f==='ctrl'){
    body = pt
      + row('識別',`傷患編號 ${p.nm.replace('傷患','')}（身分未確認）`)
      + row('診斷',p.dx) + row('品項',rxName(j),'big') + row('用法',j.dose)
      + row('開立',`${by}　（簽章）${j.stat?'　STAT':''}`)
      + row('執照',j.noLic ? '<i class="blank">＿＿＿＿＿＿</i>' : `管制藥品使用執照 ${DOC_LIC[by]||'—'}`);
  } else if (f==='oral'){
    body = row('下達者',`${by}（口頭）`) + row('接收者','你（藥師）') + row('時間',clock(j.issued))
      + pt + row('醫囑',`${rxName(j)}<br>${j.dose}`,'big')
      + row('複誦',j.noReadback?'☐ 未複誦':'☑ 已複誦')
      + row('補簽','開立者 24 小時內補簽（尚未補簽）');
  } else if (f==='transcribe'){
    const orig = j.orig || j.dose, oby = j.origBy || '何醫師';
    body = pt + row('診斷',p.dx)
      + `<div class="txcmp"><div><span>原始醫囑　${oby}（手寫）</span><b>${rxName(j)}</b><b>${orig}</b></div>
          <div><span>轉抄　${by}</span><b>${rxName(j)}</b><b>${j.dose}</b></div></div>`
      + row('開立',`${oby}　→　轉抄 ${by}${tail}`);
  } else if (f==='chronic'){
    const days=(j.dose.match(/×\s*(\d+)\s*天/)||[])[1];
    body = pt + row('診斷',p.dx) + row('品項',rxName(j),'big') + row('用法',j.dose)
      + row('調劑',`第 ${j.refillN||1} 次／共 ${j.refillOf||3} 次${days?`　·　每次 ${days} 日份`:''}`)
      + row('開立日',`第一天（四天前）`) + bag
      + row('開立',`${by}${tail}`);
  } else if (f==='en'){
    body = row('Name',`${p.nm}　${p.age} y / ${sexEn(p.sex)} / ${p.wt} kg`)
      + row('Dx',p.dx) + row('Rx',rxName(j),'big') + row('Sig',enSig(j.dose))
      + row('Signed','Dr. — (NGO, int’l)'+(j.stat?'　STAT':''));
  } else {
    body = pt + row('診斷',p.dx) + row('品項',rxName(j),'big') + row('用法',j.dose) + bag
      + row('開立',`${by}${tail}`);
  }
  return `<div class="paper f-${f}" data-t="${RX_FMT[f].t}">${body}</div>`;
}
