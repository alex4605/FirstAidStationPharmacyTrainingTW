"use strict";
/* 還開著 STILL OPEN — 志工從外面搜刮回來的藥（OTC）

   巷口那間藥局的鐵門被震開了，便利商店沒人顧，鄰居的家也空了。
   志工冒險出去，抱回來一箱藥。裡面有能用的，也有不能用的；
   能用的裡面，有些可以直接併進本站的庫存，有些「看起來一樣」卻不能併。

   每一項，你要決定：
     in  ＝ 入庫：併入本站既有的品項（要數清楚有幾顆）
     sep ＝ 另外標示存放：可以用，但不能併入任何既有品項（含量不同、複方、本站沒有的品項）
     no  ＝ 不收：過期、受潮破損、看不出是什麼、開過的藥水
   數量的難處在包裝：有的 12 錠一排、有的 10 錠、有的 14 錠、有的 7 錠；
   有整盒的（一盒兩排）、有散排、有吃掉一半的排。

   商品一律用學名與一般描述，不用真實品牌。內容在 scenario 編排時以種子決定，同一個種子看到的箱子一樣。 */

/* 一排藥長什麼樣子：per 顆一排；left 只用在「吃過的那一排」，表示還剩幾顆 */
const strip = (per,left)=>({per, left:left==null?per:left});

/* 可以併入本站庫存的（in）。target：併入哪一項；make()：隨機出這一箱裡的包裝 */
const SCAV_IN = [
  {target:'acet', name:'Acetaminophen 500mg 錠', maker:'甲廠',
   per:[12,10], make:p=>({boxes:rint(1,3), perBox:2, loose:rint(0,2), part:chance(.7)?rint(2,p-2):0})},
  {target:'acet', name:'Acetaminophen 500mg 膜衣錠', maker:'乙廠',
   per:[10,20], make:p=>({boxes:rint(0,2), perBox:1, loose:rint(1,3), part:chance(.6)?rint(1,p-3):0})},
  {target:'ibu', name:'Ibuprofen 200mg 膜衣錠', maker:'丙廠',
   per:[12,10], make:p=>({boxes:rint(1,2), perBox:2, loose:rint(0,2), part:chance(.6)?rint(2,p-2):0})},
  {target:'asa', name:'Aspirin 100mg 腸溶錠', maker:'丁廠',
   per:[14,7], make:p=>({boxes:rint(1,3), perBox:p===7?4:2, loose:rint(0,1), part:chance(.5)?rint(2,p-1):0})},
  {target:'ors', name:'口服補液鹽 粉包', maker:'戊廠', unit:'包',
   per:[6,10], make:p=>({boxes:rint(1,3), perBox:1, loose:0, part:0, sachet:true})},
];
/* 可以用，但不能併入任何既有品項（sep）。像的那一項寫在 like：選「併入」就是併錯 */
const SCAV_SEP = [
  {like:'ibu', name:'Ibuprofen 400mg 膜衣錠', per:[10,12],
   why:'含量是本站 Ibuprofen 200mg 的兩倍。併進去之後，任何照「顆數」開的處方都會給到兩倍劑量。'},
  {like:'acet', name:'綜合感冒膠囊（每顆含 Acetaminophen 300mg＋Chlorpheniramine＋Phenylephrine）', per:[10,12],
   why:'複方，裡面就有 Acetaminophen。併入 Acetaminophen 500mg 會讓含量錯；病人若同時吃普通止痛藥，就是重複成分、過量的風險。'},
  {like:'asa', name:'Aspirin 500mg 止痛錠（非腸溶）', per:[10,20],
   why:'這是止痛劑量的 Aspirin，不是本站給心血管用的 100mg 腸溶錠，含量差五倍。'},
  {like:'acet', name:'Acetaminophen 80mg 兒童咀嚼錠', per:[10,12],
   why:'兒童用的低含量。併入成人 500mg 會讓之後拿的人以為一顆是 500mg。'},
  {like:null, name:'Cetirizine 10mg 抗組織胺錠', per:[7,10],
   why:'本站藥品清單沒有這一項。可以用（蕁麻疹、過敏性鼻炎），但要另外標示、登記、存放。'},
  {like:null, name:'制酸劑咀嚼錠（氫氧化鋁／氫氧化鎂）', per:[12,10],
   why:'本站清單沒有。可以另外標示存放，給胃不舒服的人用；但它會影響其他口服藥吸收，要寫在標示上。'},
];
/* 不能收的（no）。kind 決定畫面上的描述 */
const SCAV_NO = [
  {target:'acet', n:24, name:'Acetaminophen 500mg 錠', per:12, tell:'盒裝 1 盒（每盒 2 排 × 12 錠）。外盒效期：<b>已過期 8 個月</b>。', why:'過期藥不入庫。戰時缺藥也一樣——你沒有辦法知道它還剩多少效力，也沒有辦法對病人負責。'},
  {target:'ibu', n:30, name:'Ibuprofen 200mg 膜衣錠', per:10, tell:'散排 3 排（10 錠／排）。整盒泡過水，紙盒軟爛，<b>鋁箔起皺、幾顆錠劑變色</b>。', why:'受潮與破損的藥品質已經不能保證，不收。'},
  {name:'夾鏈袋裝白色圓形錠，約 40 顆', per:0, tell:'<b>沒有任何標示</b>。志工說：「店裡櫃台抽屜拿的，應該是止痛藥吧。」', why:'看不出成分與含量的藥，不能給任何人。「應該是」不是辨識。'},
  {name:'剪成小片的鋁箔 4 片（3、2、4、1 錠）', per:0, tell:'是從整排剪下來的，<b>每一片上都看不到品名、含量與效期</b>。', why:'鋁箔片上沒有品名與效期，就跟散裝錠一樣無法確認，不收。'},
  {target:'acetp', n:1, unit:'瓶', name:'兒童退燒糖漿 Acetaminophen 120mg/5mL 60mL', per:0, tell:'<b>已開封</b>，剩約一半，瓶口黏黏的，不知道開了多久。', why:'開封過、保存條件不明的藥水，不收。'},
  {name:'Acetaminophen 125mg 肛門塞劑', per:0, tell:'放在車上曬了一整天，<b>軟化變形、黏在包裝上</b>。', why:'塞劑對溫度很敏感，變形就不能用。'},
];
/* 誰帶回來、從哪裡 */
const SCAV_FROM = [
  {who:'吳志工', where:'巷口那間藥局', say:'藥局鐵門被震開了，裡面沒人。我把架上看得到的都掃回來了，你看看哪些能用。'},
  {who:'吳志工', where:'對面的便利商店', say:'便利商店沒人顧，櫃台後面那一櫃藥我整個搬回來。什麼都有，你分一下。'},
  {who:'避難民眾（自稱以前做物流）', where:'附近幾戶空掉的住家', say:'我們幾個去附近的空屋找了一下，家家都有一點藥。全部倒在這一箱裡。'},
  {who:'吳志工', where:'里長辦公室的備品櫃', say:'里長辦公室有一櫃防災備品，鑰匙在里長那裡，他叫我們拿過來給你。'},
];

/** 數一排排、一盒盒的包裝，回傳文字描述與正確總數 */
function scavPackText(p){
  const parts=[]; let total=0;
  if (p.sachet){
    parts.push(`${p.boxes} 盒（每盒 ${p.per} 包）`); total=p.boxes*p.per;
    return {txt:parts.join('、'), total};
  }
  if (p.boxes){ parts.push(`盒裝 ${p.boxes} 盒（每盒 ${p.perBox} 排 × ${p.per} 錠）`); total+=p.boxes*p.perBox*p.per; }
  if (p.loose){ parts.push(`散排 ${p.loose} 排（${p.per} 錠／排）`); total+=p.loose*p.per; }
  if (p.part){ parts.push(`另有 1 排已經用過，剩 ${p.part} 錠（同一排，印字還在）`); total+=p.part; }
  return {txt:parts.join('、'), total};
}

/** 編排一箱：2–3 項可入庫（至少兩種不同的每排錠數）、1–2 項另外存放、1–2 項不收 */
function makeScav(){
  const from=pick(SCAV_FROM);
  const rows=[];
  // 可入庫：盡量讓同一箱裡出現不同的每排錠數，這是這個事件要練的
  // 至少兩項是一排一排的錠劑（粉包是一包一包，不算），才比得出「每排錠數不一樣」
  const ins=sample(SCAV_IN.filter(t=>!t.unit), rint(2,3)), used=new Set();
  if (ins.length<3 && chance(.4)) ins.push(SCAV_IN.find(t=>t.unit));
  ins.forEach((t,k)=>{
    // 這個事件要練的就是「每排錠數不一樣」：最後一項若會讓整箱只剩一種錠數，就換成另一種
    let per=pick(t.per);
    if (k===ins.length-1 && used.size===1 && used.has(per)) per=t.per.find(x=>x!==per)||per;
    if (!t.unit) used.add(per);
    const p={per, ...t.make(per)};
    if (!p.sachet && !p.boxes && !p.loose) p.loose=1;
    const pk=scavPackText(p);
    rows.push({ok:'in', target:t.target, name:t.name, maker:t.maker, unit:t.unit||'顆', per, pack:p,
      packTxt:pk.txt, total:pk.total});
  });
  sample(SCAV_SEP, rint(1,2)).forEach(t=>{
    const per=pick(t.per), p={per, boxes:rint(0,1), perBox:2, loose:rint(1,3), part:0};
    const pk=scavPackText(p);
    rows.push({ok:'sep', target:t.like, name:t.name, unit:'顆', per, pack:p, packTxt:pk.txt, total:pk.total, why:t.why});
  });
  sample(SCAV_NO, rint(1,2)).forEach(t=>{
    rows.push({ok:'no', target:t.target||null, name:t.name, unit:t.unit||'顆', per:t.per, tell:t.tell, why:t.why,
      packTxt:'', total:t.n||0});
  });
  return {from, rows:shuffle(rows)};
}
