"use strict";
/* 還開著 STILL OPEN — 站內幫手的生成 */

/* ---------- 4b. 幫手、支援作業與 CBRNE ----------
   地下避難室裡本來就有人。指引伍、一與行政區說明要求「確認新進醫事人員職業類別
   與有效執照，以及作業簡介；部署期間的任務發布與共識討論」——查核與授權是流程，
   不是人情。 */
const SCOPES = {
  dispense:{n:'調劑與交付', d:'依處方取藥、計量、包裝、標示'},
  check   :{n:'處方核對', d:'五對核對與攔截'},
  draw    :{n:'抽藥與貼標', d:'在你監督下抽取注射藥並完成標示'},
  pack    :{n:'分裝、排藥與貼標', d:'依床號分裝口服藥並貼標'},
  count   :{n:'點藥與盤點', d:'清點數量、核對效期、登記出入庫'},
  window  :{n:'領藥窗口秩序與叫號', d:'排隊、核對姓名、交付說明由你把關'},
  runner  :{n:'搬運與跑腿', d:'取物、送藥到各區、傳遞紙本'},
  night   :{n:'夜間值守（你休息時）', d:'夜班無藥師編制，這是最高風險的授權'},
  edu     :{n:'衛教與給藥指導', d:'對病人與家屬說明怎麼吃、何時停、出現什麼要回來'},
  translate:{n:'語言協助', d:'替聽不懂的傷患做溝通與書面指示的翻譯'},
  record  :{n:'紀錄與文書', d:'登錄出入庫、整理處方籃與紙本歸檔（不含管制藥品雙人核對）'},
};
/* 幫手是隨機生成的：同一個種子會生出同一批人，換個種子就是另一批。
   每個原型決定「他實際上能做什麼」與「他說的是不是真的」。 */
const SURNAMES='陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周葉蘇莊呂江何蕭羅高'.split('');
const GIVEN_F=['淑芬','雅婷','美玲','怡君','佩珊','秀英','曉慧','詩涵','宜靜','玉蘭'];
const GIVEN_M=['志明','建宏','俊傑','家豪','文雄','冠宇','世傑','宗翰','明哲','柏翰'];
const PLACES=['忠孝','民生','中山','復興','光明','和平','信義','大同','永康','文昌'];
const WHYHERE=['我家那棟第二天就沒了，我帶著證件跑出來。',
  '我本來在上面的收容所，聽說你們這裡缺人。',
  '我女兒在留觀區。我不想只是坐著等。',
  '我原本的機構疏散了，我跟著人群走到這裡。',
  '我住這棟樓的七樓。第一天就下來了。'];
const QUIRKS=['他說話很慢，但每一句都說到重點。','她手上有個舊的藥袋，摺得很整齊。',
  '他一直在看你身後的層架，像在確認什麼。','她的白鞋很乾淨，跟這裡格格不入。',
  '他講到一半停下來，深呼吸了一次。','她一邊說一邊已經在捲袖子了。'];

const ARCHETYPES = [
 {k:'rph_active', w:12, skill:'現職藥師（外院疏散）', needBrief:false, col:0x8fd6c9, sex:null,
  age:[28,52], tag:a=>`執業 ${a.yrs} 年，${a.place}醫院藥劑科`,
  say:a=>`我是藥師，在${a.place}醫院藥劑科做了${a.yrs}年。醫院疏散的時候我把執照帶出來了。你們這裡我可以直接上手。`,
  verify:'good', vtxt:a=>`執照正本與身分證相符，登記字號可查，機構名稱與他說的一致。這是你今天最好的運氣——一位仍在執業、熟悉現行品項的藥師。`,
  ok:['dispense','check','count','pack','window','night','draw','edu','record'], risky:[]},

 {k:'rph_retired', w:12, skill:'藥師（久未執業）', needBrief:true, col:0xa9d3de, sex:null,
  age:[66,78], tag:a=>`執業 ${a.yrs} 年，${a.retire} 年退休`,
  say:a=>`我執業了${a.yrs}年，${a.retire}年退休。執照還在，我隨身帶著。只是這幾年的新藥我不熟了。`,
  verify:'good', vtxt:a=>`執照正本與身分證相符，登記字號可查。但他自己說了：久未執業，對現行品項與新劑型不熟——這正是你要做作業簡介的理由。`,
  ok:['dispense','check','count','pack','window','night','edu','record'], risky:[]},

 {k:'assistant', w:14, skill:'藥師助理', needBrief:true, col:0x8fbf7f, sex:'f',
  age:[30,50], tag:a=>`社區藥局藥師助理 ${a.yrs} 年`,
  say:a=>`我以前在${a.place}路上那家藥局做了${a.yrs}年藥助。包藥、排藥、點庫存我都很熟。我不是藥師，但我想幫忙。`,
  verify:'good', vtxt:a=>`她沒有執照——藥師助理本來就不需要。但她說得出藥局名稱、負責藥師姓名與健保申報流程，經歷可信。她可以做很多事，但<b>調劑與核對不在其中</b>。`,
  ok:['pack','count','window','runner','record'], risky:['dispense','check','draw','night','edu']},

 {k:'pharm_student', w:10, skill:'藥學系學生（需監督）', needBrief:true, col:0xbfd68f, sex:null,
  age:[21,24], tag:a=>`藥學系${a.grade}年級，實習中`,
  say:a=>`我是藥學系${a.grade}年級，在社區藥局實習到一半疏散過來的。調劑我看過很多次，也做過。`,
  verify:'partial', vtxt:a=>`學生證與實習證明相符。<b>看過很多次不等於可以獨立作業</b>——學生僅能在具資格人員直接監督下執行部分作業。`,
  ok:['pack','count','draw','runner','window','record'], risky:['dispense','check','night','edu']},

 {k:'nurse_student', w:10, skill:'護理系學生（需監督）', needBrief:true, col:0xc3a2dd, sex:null,
  age:[21,24], tag:a=>`護理系${a.grade}年級，實習中`,
  say:a=>`我是護理系${a.grade}年級，在醫院實習到一半疏散過來的。抽藥、量生命徵象我做過。`,
  verify:'partial', vtxt:a=>`學生證與實習單位證明相符。學生可在具資格人員<b>直接監督</b>下執行部分技術，但不得獨立作業。`,
  ok:['draw','runner','window','record'], risky:['dispense','check','night','pack','edu']},

 {k:'nurse', w:8, skill:'護理師（外院疏散）', needBrief:false, col:0xa9d3de, sex:'f',
  age:[26,48], tag:a=>`執業 ${a.yrs} 年，${a.place}醫院`,
  say:a=>`我是護理師，${a.place}醫院的，執業${a.yrs}年。我知道我不是藥師，但抽藥、貼標、送藥我做得比誰都快。`,
  verify:'good', vtxt:a=>`護理師執照正本相符。她是合格醫事人員，但<b>調劑仍屬藥事人員業務</b>——她可以抽藥、可以核對給藥，不能代替你調劑。`,
  ok:['draw','pack','window','runner','count','edu','record'], risky:['dispense','check','night']},

 {k:'dentist', w:6, skill:'牙醫師', needBrief:true, col:0xd6c48f, sex:null,
  age:[32,60], tag:a=>`牙醫師，${a.place}牙醫診所`,
  say:a=>`我是牙醫師，診所在${a.place}路。我會開處方，藥理我也懂，需要的話我可以幫你配。`,
  verify:'partial', vtxt:a=>`牙醫師執照正本相符——他是合格醫事人員，但<b>執業範圍限於牙科</b>，且醫師開立處方與藥師調劑是兩種不同的業務。他能幫的忙不在藥局裡。`,
  ok:['runner','window','draw','record'], risky:['dispense','check','pack','count','night','edu']},

 {k:'vet', w:6, skill:'獸醫師', needBrief:true, col:0xd9a06b, sex:null,
  age:[30,55], tag:a=>`獸醫師，${a.place}動物醫院`,
  say:a=>`我是獸醫，我自己開業。藥理、劑量換算我每天在做，只是對象不一樣。`,
  verify:'partial', vtxt:a=>`獸醫師執照正本相符。他的藥理訓練是真的，但<b>不具人用藥品調劑資格</b>，而且人與動物的劑量體系不能互推。`,
  ok:['runner','window','count','record'], risky:['dispense','check','draw','pack','night','edu']},

 {k:'tcm', w:6, skill:'中藥從業人員', needBrief:true, col:0xb39a6b, sex:null,
  age:[40,68], tag:a=>`中藥行 ${a.yrs} 年`,
  say:a=>`我在${a.place}那邊開中藥行${a.yrs}年了。抓藥、秤重、包藥我做了一輩子。`,
  verify:'partial', vtxt:a=>`他的資歷是真的，但那是<b>中藥</b>。西藥調劑須由藥師為之，兩者的法規、劑型與交互作用完全不同。`,
  ok:['runner','window','pack','record'], risky:['dispense','check','draw','count','night','edu']},

 {k:'caregiver', w:8, skill:'照顧服務員', needBrief:true, col:0x9fb0dd, sex:'f',
  age:[35,60], tag:a=>`長照機構照顧服務員 ${a.yrs} 年`,
  say:a=>`我在長照機構做${a.yrs}年了。餵藥、翻身、記錄我都熟。老人家的事交給我。`,
  verify:'good', vtxt:a=>`結業證書相符。她協助服藥、生活照顧與紀錄的經驗很實在，尤其對留觀區的長者——但<b>協助服藥不是調劑</b>。`,
  ok:['runner','window','pack','record'], risky:['dispense','check','draw','night','edu']},

 {k:'rep', w:9, skill:'無醫事資格（冒名）', needBrief:true, col:0xd98f6b, sex:null,
  age:[35,52], tag:a=>`自稱「在藥廠做了 ${a.yrs} 年」`,
  say:a=>`我在藥廠做了${a.yrs}年，藥比誰都熟。你們這裡缺人吧？我可以幫你配藥。`,
  verify:'bad', vtxt:a=>`追問之下，他是醫藥行銷業務代表，不具藥事人員資格，也拿不出任何執照。<b>「熟悉藥品」與「具備調劑資格」是兩件事。</b>`,
  ok:['runner','window'], risky:['dispense','check','draw','pack','count','night','edu','record']},

 {k:'expired', w:7, skill:'無醫事資格（執照已失效）', needBrief:true, col:0xd98f6b, sex:null,
  age:[45,62], tag:a=>`自稱藥師，拿不出有效執照`,
  say:a=>`我是藥師啊，做了很多年。執照？執照在家裡，我跑出來的時候哪來得及拿。你看我這樣像不像？`,
  verify:'bad', vtxt:a=>`查無有效執業登記。他確實曾受過相關訓練，但<b>執照失效期間不得執行業務</b>——在災時也一樣，而且災時的紀錄會被檢視得更嚴格。`,
  ok:['runner','window'], risky:['dispense','check','draw','pack','count','night','edu','record']},

 {k:'thief', w:8, skill:'無醫事資格（動機可疑）', needBrief:true, col:0xa8747a, sex:null,
  age:[24,44], tag:a=>`自稱曾在${a.place}路的藥局工作`,
  say:a=>`我在${a.place}路那家藥局待過，包藥什麼的我都會。你這邊管制藥品是不是也放在裡面？我可以幫你顧。`,
  verify:'bad', vtxt:a=>`那家藥局三年前就歇業了，他說不出負責藥師的名字，證件也「放在家裡」。<b>而他從進來到現在，眼睛一直在管制藥品櫃上。</b>`,
  ok:['runner'], risky:['dispense','check','draw','pack','count','window','night','edu','record'], thief:true},

 {k:'ngo_intl', w:8, skill:'國際 NGO 藥事人員（外國執照）', needBrief:true, col:0x5fbfa8, sex:null,
  age:[28,50], tag:a=>`國際人道組織，派駐第 ${Math.max(1,Math.round(a.yrs/6))} 週`,
  say:a=>`我是${a.place==='忠孝'?'無國界醫療團':'國際人道組織'}的藥師，車道口那台車就是我們的。`
    +`我熟人道物資的品項跟國際規格，但我知道我的執照不是你們國家發的。`,
  verify:'partial', vtxt:a=>`證件與派遣文件相符，他確實是合格藥師——<b>但執照是外國發給的</b>。`
    +`在本國執行藥品調劑須具本國藥師資格；他能做的是<b>辨識國際品項、換算規格、清點與紀錄</b>，`
    +`而那正好是今天最缺的一雙眼睛。`,
  ok:['count','pack','record','translate','window','runner'], risky:['dispense','check','draw','night']},

 {k:'ngo_dom', w:8, skill:'國內 NGO 藥事人員（本國執照）', needBrief:true, col:0x8fd6c9, sex:null,
  age:[30,58], tag:a=>`國內人道組織醫療團，投入 ${Math.max(2,a.yrs-20)} 年`,
  say:a=>`我是本國 NGO 醫療團的藥師，我們平常做義診跟賑災。執照我帶著。`
    +`你們這裡的規矩我都知道，你說要我做什麼我就做什麼。`,
  verify:'good', vtxt:a=>`本國藥師執照正本相符，登記字號可查，組織的派遣證明也在。`
    +`他做過賑災義診，熟悉臨時據點的作業——<b>今天你可以把一整條線交給他</b>。`,
  ok:['dispense','check','count','pack','window','record','edu','runner','night'], risky:[]},

 {k:'volunteer', w:12, skill:'一般志工', needBrief:false, col:0x8ba0a0, sex:null,
  age:[18,65], tag:a=>`避難民眾，${a.job}`,
  say:a=>`我沒有醫療背景，我是${a.job}。可是我看你一個人忙成這樣。有什麼是我可以做的嗎？`,
  verify:'good', vtxt:a=>`他很坦白：沒有任何醫療背景。<b>這其實是最容易處理的一種</b>——範圍清楚，搬運、跑腿、維持領藥秩序、幫你登紙本都做得來，而且他不會假裝自己會。`,
  ok:['runner','window','record'], risky:['dispense','check','draw','pack','count','night','edu']},
];
const JOBS_CIVIL=['開計程車的','在市場賣菜','做水電','高中老師','便利商店店長','退休公務員','送貨員','做木工的'];
const VERDICT_TXT={good:'資格與經歷相符', partial:'資格屬實，但不涵蓋藥事調劑業務', bad:'查無有效醫事人員資格'};

function genHelper(i){
  const pool=[]; ARCHETYPES.forEach(a=>{ for(let k=0;k<a.w;k++) pool.push(a); });
  const A=pick(pool);
  const sex = A.sex || (chance(.5)?'f':'m');
  const age = rint(A.age[0],A.age[1]);
  const d = {yrs: Math.max(3, Math.min(age-24, rint(4,26))), place: pick(PLACES),
             grade: pick(['三','四']), retire: rint(2012,2021), job: pick(JOBS_CIVIL)};
  const THIEF_TELLS=['他問了兩次管制藥品櫃的鑰匙放在哪。','他的袖口鼓鼓的，你沒看清楚是什麼。',
    '他說話時一直站在你和層架之間。','他對品項的說法很熟，但對流程一問三不知。'];
  const name = pick(SURNAMES) + (sex==='f' ? pick(GIVEN_F) : pick(GIVEN_M));
  const honor = /rph/.test(A.k) ? '藥師' : A.k==='nurse' ? '護理師'
    : A.k==='dentist' ? '醫師' : A.k==='vet' ? '獸醫師'
    : (sex==='f'?'小姐':'先生');
  const display = name.slice(0,1) + honor;
  // 題庫裡的「他／她」是寫死的；依這個人實際抽到的性別換成對的那一個（「其他」不動）
  const gendered = s => sex==='f' ? s.replace(/(?<!其)他(?!們)/g,'她') : s.replace(/她(?!們)/g,'他');
  /* 語言：這一區住的人本來就不只講一種話。會講第二種語言的人，
     在有語言障礙的傷患面前，比你多的是耳朵而不是資格。 */
  const lang = chance(.5) ? pick(['台語','台語','客語','日語','日語','英語','英語','越南語','印尼語','粵語']) : null;
  const ok = A.ok.slice(), risky = A.risky.slice();
  if (lang) ok.push('translate'); else risky.push('translate');
  /* 每個人待多久、為什麼走。有些人待到你下班，有些人只是路過幫一手。 */
  const STAY = [
    {w:26, mins:[999,999], why:null},
    {w:16, mins:[150,260], why:'上面的收容所排了輪班，我得回去。'},
    {w:14, mins:[110,200], why:'我女兒在留觀區，我去看她一下就回來——如果回得來。'},
    {w:12, mins:[90,170],  why:'站長把我調去檢傷那邊，那裡現在更亂。'},
    {w:12, mins:[80,150],  why:'我不行了，我從昨天到現在沒睡。'},
    {w:10, mins:[60,120],  why:'我家人在外面等我，我真的得走了。'},
    {w:10, mins:[70,140],  why:'我只是路過看你忙不過來。我該回去顧我自己的人了。'},
  ];
  const spool=[]; STAY.forEach(x=>{ for(let k=0;k<x.w;k++) spool.push(x); });
  const st = pick(spool);
  return {id:'h'+i, arch:A.k, name:display, full:name, age, sex, lang, ta: sex==='f'?'她':'他',
    tag:A.tag(d), say:A.say(d)+'　'+pick(WHYHERE), quirk:gendered(A.k==='thief'?pick(THIEF_TELLS):pick(QUIRKS)), thief:!!A.thief,
    verify:A.verify, verifyTxt:gendered(A.vtxt(d)), ok, risky,
    stayMin: st.why ? rint(st.mins[0],st.mins[1]) : 999, leaveWhy: st.why,
    needBrief:A.needBrief, col:A.col, skill:A.skill};
}
const HELPERS = (()=>{
  const n = rint(3,5), used=new Set(), out=[];
  const times = spread(n, 30, 620, 45);
  for (let i=0;i<n;i++){
    let h, guard=0;
    do { h=genHelper(i+1); guard++; } while (used.has(h.arch) && guard<24);
    used.add(h.arch); h.t=times[i]; out.push(h);
  }
  return out;
})();
