"use strict";
/* 還開著 STILL OPEN — 藥品、第四天庫存、作業時間、針劑規格 */

/* ---------- 1. 藥品（附件四・附件六） ---------- */
const CATS = {
  emg:{n:'急救藥箱',c:'#c6362f'}, pain:{n:'止痛消炎',c:'#d9873a'}, resp:{n:'呼吸道',c:'#4fa8b8'},
  gi:{n:'腸胃道',c:'#8a9b57'}, cv:{n:'心臟血管',c:'#b8586b'}, neu:{n:'神經精神',c:'#8a7bb8'},
  abx:{n:'抗生素',c:'#4f9268'}, dm:{n:'血糖血脂',c:'#d9a521'}, tra:{n:'外傷用藥',c:'#a86b4a'},
  iv:{n:'輸液',c:'#6f8b93'}, ped:{n:'兒科',c:'#5fbfa8'}, ob:{n:'產科',c:'#c98fb0'}, vac:{n:'疫苗',c:'#7fa8d9'},
};
const DRUGS = [
  {id:'epi',n:'Epinephrine 1mg/1ml/A',cat:'emg',f:'針劑',q:150,st:'rt'},
  {id:'atr',n:'Atropine 1mg/1ml/A',cat:'emg',f:'針劑',q:30,st:'rt'},
  {id:'cacl',n:'CaCl₂ H₂O／Glucose H₂O 20ml/A',cat:'emg',f:'針劑',q:20,st:'rt',note:'高血鉀心肌保護'},
  {id:'nabic',n:'Sod. Bicarbonate 1400mg/20ml/A',cat:'emg',f:'針劑',q:50,st:'rt'},
  {id:'d50',n:'Dextrose 50% 20ml/A',cat:'emg',f:'針劑',q:20,st:'rt'},
  {id:'amio',n:'Amiodarone 150mg/3ml/A',cat:'emg',f:'針劑',q:50,st:'rt'},
  {id:'diaz',n:'Diazepam 10mg/2ml/A',cat:'emg',f:'針劑',q:20,st:'ctrl'},
  {id:'mida',n:'Midazolam 5mg/1ml/A',cat:'emg',f:'針劑',q:20,st:'ctrl'},
  {id:'prop',n:'Propofol 1% 20ml/A',cat:'emg',f:'針劑',q:30,st:'ctrl'},
  {id:'furoi',n:'Furosemide 20mg/2ml/A',cat:'emg',f:'針劑',q:20,st:'rt'},
  {id:'hydro',n:'Hydrocortisone 100mg/Vial',cat:'emg',f:'針劑',q:10,st:'rt'},
  {id:'ipra',n:'Ipratropium Bromide 0.5mg/2ml',cat:'emg',f:'霧化',q:100,st:'rt'},
  {id:'terb',n:'Terbutaline Sulfate 5mg/2ml',cat:'emg',f:'霧化',q:100,st:'rt'},
  {id:'acet',n:'Acetaminophen 500mg',cat:'pain',f:'口服',q:2500,st:'rt'},
  {id:'ibu',n:'Ibuprofen 200mg',cat:'pain',f:'口服',q:1000,st:'rt'},
  {id:'tram',n:'Tramadol HCL 50mg',cat:'pain',f:'口服',q:200,st:'rt'},
  {id:'mor',n:'Morphine 10mg/1ml/A',cat:'pain',f:'針劑',q:10,st:'ctrl'},
  {id:'fent',n:'Fentanyl 0.1mg/2ml/A',cat:'pain',f:'針劑',q:5,st:'ctrl'},
  {id:'dexa',n:'Dexamethasone 5mg/2ml/A',cat:'pain',f:'針劑',q:10,st:'rt'},
  {id:'cod',n:'Codeine 30mg',cat:'resp',f:'口服',q:180,st:'ctrl'},
  {id:'pred',n:'Prednisolone 5mg',cat:'resp',f:'口服',q:1000,st:'rt'},
  {id:'dphi',n:'Diphenhydramine 30mg/1ml/A',cat:'resp',f:'針劑',q:50,st:'rt'},
  {id:'lanso',n:'Lansoprazole 30mg',cat:'gi',f:'口服',q:150,st:'rt',note:'腸溶劑型'},
  {id:'lansoi',n:'Lansoprazole 40mg/Vial',cat:'gi',f:'針劑',q:20,st:'rt'},
  {id:'meto',n:'Metoclopramide 3.84mg',cat:'gi',f:'口服',q:450,st:'rt'},
  {id:'loper',n:'Loperamide 5mg',cat:'gi',f:'口服',q:210,st:'rt'},
  {id:'amlo',n:'Amlodipine Besylate 5mg',cat:'cv',f:'口服',q:250,st:'rt'},
  {id:'furo',n:'Furosemide 40mg',cat:'cv',f:'口服',q:50,st:'rt'},
  {id:'asa',n:'Aspirin 100mg',cat:'cv',f:'口服',q:250,st:'rt'},
  {id:'clop',n:'Clopidogrel 75mg',cat:'cv',f:'口服',q:120,st:'rt'},
  {id:'ntg',n:'Nitroglycerin 0.6mg',cat:'cv',f:'口服',q:8,st:'rt',u:'罐'},
  {id:'lora',n:'Lorazepam 0.5mg',cat:'neu',f:'口服',q:100,st:'ctrl'},
  {id:'vitb',n:'Vit B1/B6/B12',cat:'neu',f:'口服',q:100,st:'rt'},
  {id:'ceph',n:'Cephalexin 250mg',cat:'abx',f:'口服',q:1200,st:'rt'},
  {id:'azi',n:'Azithromycin 250mg',cat:'abx',f:'口服',q:400,st:'rt'},
  {id:'augm',n:'Amoxil／Clavulanic 250/125mg',cat:'abx',f:'口服',q:300,st:'rt'},
  {id:'cipro',n:'Ciprofloxacin 250mg',cat:'abx',f:'口服',q:150,st:'rt'},
  {id:'ceftx',n:'Ceftriaxone 1g/Vial',cat:'abx',f:'針劑',q:20,st:'rt'},
  {id:'augmi',n:'Amoxil／Clav 1000/200mg/A',cat:'abx',f:'針劑',q:20,st:'rt'},
  {id:'metf',n:'Metformin 500mg',cat:'dm',f:'口服',q:250,st:'rt'},
  {id:'glim',n:'Glimepiride 5mg',cat:'dm',f:'口服',q:100,st:'rt'},
  {id:'ins',n:'Insulin Actrapid 1000IU/10ml',cat:'dm',f:'針劑',q:2,st:'cold',note:'全站僅 2 支'},
  {id:'txa',n:'Transamic Acid 500mg/5ml/A',cat:'tra',f:'針劑',q:50,st:'rt'},
  {id:'txao',n:'Transamic Acid 250mg',cat:'tra',f:'口服',q:100,st:'rt'},
  {id:'ssd',n:'Silver Sulfadiazine 1% 500g',cat:'tra',f:'外用',q:2,st:'rt',u:'瓶'},
  {id:'ns',n:'0.9% 生理食鹽水 NS 500ml',cat:'iv',f:'輸液',q:200,st:'rt',u:'瓶'},
  {id:'lr',n:'Ringer 乳酸液 LR 500ml',cat:'iv',f:'輸液',q:200,st:'rt',u:'瓶'},
  {id:'acetp',n:'Acetaminophen 120mg/5mL 60mL',cat:'ped',f:'藥水',q:30,st:'rt',u:'瓶'},
  {id:'ibup',n:'Ibuprofen 100mg/5mL 60mL',cat:'ped',f:'藥水',q:30,st:'rt',u:'瓶'},
  {id:'ors',n:'口服補液鹽 ORS 包',cat:'ped',f:'藥水',q:100,st:'rt',u:'包'},
  {id:'amoxp',n:'Amoxicillin 250mg/5mL 100mL',cat:'ped',f:'藥水',q:20,st:'rt',u:'瓶'},
  {id:'oxy',n:'Oxytocin 10IU/mL/A',cat:'ob',f:'針劑',q:10,st:'cold',note:'產後出血'},
  {id:'miso',n:'Misoprostol 200µg',cat:'ob',f:'口服',q:20,st:'rt'},
  {id:'mgso4',n:'Magnesium Sulfate 50% 10mL',cat:'ob',f:'針劑',q:10,st:'rt'},
  {id:'tt',n:'破傷風類毒素疫苗 TT',cat:'vac',f:'針劑',q:350,st:'cold',u:'罐',note:'外傷患皆需 1 劑'},
];
const drugById = Object.fromEntries(DRUGS.map(d=>[d.id,d]));

/* ---------- 1b. 第四天的庫存 ----------
   七日儲備量是「開站時」的數字。現在是第四天，東西用掉了，而且帳面不一定準——
   因為前三天忙到沒有人好好登記。管制藥品是例外：它逐筆登記，帳面必須等於實際。
   d.have = 架上真正有幾個（你看不到，除非你盤點或真的去數）
   d.book = 帳面數字（左側藥品架顯示的就是它） */
const BLISTER = {ibu:10,tram:10,cod:10,lanso:14,meto:10,loper:10,amlo:10,furo:10,asa:10,
  clop:7,lora:10,azi:6,augm:10,cipro:10,glim:10,txao:10,miso:4};
DRUGS.forEach(d=>{
  d.u = d.u || (d.f==='口服'?'顆':d.f==='針劑'?'支':'份');
  if (d.f==='口服') d.pk = BLISTER[d.id] ? {type:'blister', per:BLISTER[d.id]} : {type:'bottle'};
  // 第四天：用掉四成到八成，少數品項幾乎見底
  const used = chance(.18) ? rnd(.82,.96) : rnd(.35,.75);
  d.have = Math.max(0, Math.round(d.q*(1-used)));
  if (d.id==='ins')  d.have = 2;                 // 本來就只有兩支
  if (d.id==='fent') d.have = rint(3,5);
  if (d.id==='mor')  d.have = rint(6,9);
  // 帳面誤差：管制藥品沒有誤差，其餘依數量大小而定
  if (d.st==='ctrl' || d.have===0) d.book = d.have;
  else {
    const drift = Math.max(1, Math.round(d.have*rnd(.06,.22)));
    d.book = Math.max(0, d.have + (chance(.55)? drift : -drift));
  }
  d.counted = (d.st==='ctrl');                   // 管制藥品開場即為已核對
});
/* 盤點會把帳面校正回實際，並告訴你差了多少 */
function doStocktake(byWho){
  let off=0, worst=null;
  DRUGS.forEach(d=>{
    const diff=d.book-d.have;
    if (diff!==0){ off++; if(!worst||Math.abs(diff)>Math.abs(worst.diff)) worst={d,diff}; }
    d.book=d.have; d.counted=true;
  });
  S.counted=true; S.stockOff=off;
  const low=DRUGS.filter(d=>d.have>0 && d.have/d.q<.25).map(d=>d.n.split(' ')[0]);
  const out=DRUGS.filter(d=>d.have<=0).map(d=>d.n.split(' ')[0]);
  log(`盤點完成${byWho?`（${byWho}）`:''}：${off} 項帳面與實際不符。`, off?'l-warn':'l-ok');
  if (worst) log(`落差最大的是 ${worst.d.n.split(' ')[0]}：帳面比實際${worst.diff>0?'多':'少'} ${Math.abs(worst.diff)} ${worst.d.u}。`,'l-warn');
  if (out.length) log(`已經歸零的品項：${out.join('、')}。`,'l-bad');
  if (low.length) log(`低於兩成五：${low.join('、')}。`,'l-warn');
  narrate('你把數字抄進物資管理紀錄表。第四天了，這是第一份可以拿去報的清單。');
  mark('P4', true, `完成盤點，校正 ${off} 項帳面落差`);
  if (off>6) mark('P3', false, `盤點前有 ${off} 項帳面與實際不符，代表前幾日的出入庫登記不完整`);
  dirty.stock=true;
}
/* 用法解析：算出這一張處方到底要給幾顆 */
/* ---------- 作業時間（唯一的真相來源）----------
   面板上寫幾分鐘，程式就跑幾分鐘。之前有幾處文字沒跟著改，
   所以現在所有顯示與計時都從這張表來。 */
const T = {
  ask:3, sub:4, partial:2, ret:2,          // 處方的四條路
  con:3, edu:4, lang:5, crowd:5, logi:5,   // 諮詢、衛教、語言、現場、物流
  ass:6, assLong:8,                        // 支援性作業
  verify:4, verifyFast:1, scope:2, brief:8,// 幫手的查核與授權
  back:2, doff:5, rest:8,                  // 返回、脫裝備、休息
  idnIntl:4, idnDom:2,                     // 外來品項辨識的基本時間
  reqList:3,                               // 要求對方補一張書面需求清單
};
const FREQ = {qd:1,hs:1,bid:2,tid:3,qid:4,q4h:6,q6h:4,q8h:3,q12h:2,q24h:1,stat:1,prn:0};
function sigOf(j){
  const dose=j.dose||'';
  const fk=(dose.toLowerCase().match(/\b(q\d+h|qd|bid|tid|qid|hs|stat|prn)\b/)||[])[1];
  const perDay=FREQ[fk]!=null?FREQ[fk]:1;
  const strength=parseFloat((j.drug.n.match(/([\d.]+)\s*(mg|µg|g)/)||[])[1]);
  const amt=parseFloat((dose.match(/([\d.]+)\s*(mg|µg|g)/)||[])[1]);
  let per=1;
  if (strength&&amt){ const r=amt/strength; if (r>=1&&Math.abs(r-Math.round(r))<0.01) per=Math.round(r); }
  const days = fk==='stat' ? 0 : (j.days||3);
  const total = fk==='stat' ? per : (fk==='prn' ? per*3 : per*perDay*days);
  return {fk:fk||'qd', perDay, per, days, total, stat:fk==='stat'};
}

/* ---------- 1c. 針劑的「一支裝多少」 ----------
   最容易出事的不是算錯，是<b>沒算</b>——伸手就拿一支。
   TXA 一支 500mg，醫師開 1g；Dextrose 50% 一支 20mL，醫師開 50mL。
   數量要你自己算，而且答案常常不是 1。 */
const VIAL = {
  epi:[1,'mg'], atr:[1,'mg'], cacl:[20,'mL'], nabic:[20,'mL'], d50:[20,'mL'],
  amio:[150,'mg'], diaz:[10,'mg'], mida:[5,'mg'], prop:[20,'mL'], furoi:[20,'mg'],
  hydro:[100,'mg'], mor:[10,'mg'], fent:[.1,'mg'], dexa:[5,'mg'], dphi:[30,'mg'],
  lansoi:[40,'mg'], ceftx:[1000,'mg'], augmi:[1200,'mg'], ins:[1000,'IU'],
  txa:[500,'mg'], oxy:[10,'IU'], mgso4:[10,'mL'], tt:[.5,'mL'],
  ipra:[.5,'mg'], terb:[5,'mg'], ns:[500,'mL'], lr:[500,'mL'],
};
const UNIT_NAME = {針劑:'支', 霧化:'支', 輸液:'袋'};
Object.keys(VIAL).forEach(id=>{ const d=drugById[id]; if(!d) return;
  d.vial={a:VIAL[id][0], u:VIAL[id][1]}; });
/* 從用法裡讀出「一次要用多少」，換算成需要幾支。
   g 一律換成 mg；讀不出劑量的（例如只寫「1 支」或「依血糖滑動」）就不進數藥台。 */
function vialOf(j){
  const d=j.drug; if (!d || !d.vial) return null;
  const dose=j.dose||'';
  const m=dose.match(/([\d.]+)\s*(mg|g|mL|ml|IU|µg)/);
  if (!m) return null;
  let amt=parseFloat(m[1]); let u=m[2];
  if (u==='g'){ amt*=1000; u='mg'; }
  if (u==='µg'){ amt/=1000; u='mg'; }
  if (u==='ml') u='mL';
  if (u!==d.vial.u) return null;                 // 單位對不上就不算，交給人判斷
  const fk=(dose.toLowerCase().match(/\b(q\d+h|qd|bid|tid|qid|hs|stat|prn)\b/)||[])[1]||'stat';
  const perDay=FREQ[fk]!=null?FREQ[fk]:1;
  const dm=dose.match(/[×x]\s*(\d+)\s*天/);
  const xm=dose.match(/[×x]\s*(\d+)\s*(?!天)/);
  // 針劑一次配一次的量，除非處方寫明天數或「×N」
  const days = dm ? parseInt(dm[1],10) : (fk==='prn' ? 1 : 0);
  const perDose = Math.ceil((amt/d.vial.a) * 1000)/1000;
  const doses = days>0 ? perDay*days : (xm ? parseInt(xm[1],10) : 1);
  const need = Math.ceil(perDose*doses - 1e-9);
  return {amt, u, per:d.vial.a, perDose, perDay, days, doses, need,
    unit: UNIT_NAME[d.f]||'支'};
}
