"use strict";
/* 還開著 STILL OPEN — 病人、開立者、退回理由 */

/* ---------- 2. 病人（藥局自己的紀錄） ---------- */
const PATIENTS = [
  {id:1,nm:'傷患01',cat:'軍',age:24,sex:'男',wt:72,tag:2,dx:'多發性小碎片傷',hx:[],allergy:null},
  {id:2,nm:'傷患02',cat:'民',age:71,sex:'男',wt:58,tag:2,dx:'氧氣依賴 COPD 急性惡化',hx:['長期吸入型支氣管擴張劑'],allergy:null},
  {id:3,nm:'傷患03',cat:'民',age:29,sex:'女',wt:54,tag:2,dx:'胰島素依賴糖尿病斷藥 4 日',hx:['Insulin 每日'],allergy:null},
  {id:4,nm:'傷患04',cat:'民',age:6,sex:'女',wt:20,tag:2,dx:'兒童多發碎片傷',hx:[],allergy:null,child:true},
  {id:5,nm:'傷患05',cat:'民',age:63,sex:'男',wt:66,tag:2,dx:'透析中斷、高血鉀 K 6.9',hx:['每週三次血液透析','Amlodipine 每日','Aspirin 每日','Glimepiride 每日'],allergy:null},
  {id:6,nm:'傷患06',cat:'民',age:69,sex:'男',wt:70,tag:3,dx:'頭皮撕裂傷，止血困難',hx:[],allergy:null},
  {id:7,nm:'傷患07',cat:'軍',age:31,sex:'男',wt:78,tag:1,dx:'腹部穿刺傷、失血性休克',hx:[],allergy:null},
  {id:8,nm:'傷患08',cat:'民',age:33,sex:'女',wt:63,tag:1,dx:'產後出血（地下室生產）',hx:['G2P2'],allergy:null},
  {id:9,nm:'傷患09',cat:'民',age:25,sex:'男',wt:68,tag:2,dx:'抗癲癇藥中斷、癲癇重積後意識不清',hx:['Valproate 長期','已置放鼻胃管'],allergy:null},
  {id:10,nm:'傷患10',cat:'民',age:47,sex:'女',wt:57,tag:2,dx:'胸腹爆震傷',hx:[],allergy:'Penicillin 過敏（曾全身疹）'},
  {id:11,nm:'傷患11',cat:'民',age:82,sex:'女',wt:44,tag:3,dx:'失智症長者、脫水',hx:['Donepezil','Metformin 每日','Aspirin 每日'],allergy:null},
  {id:12,nm:'傷患12',cat:'軍',age:22,sex:'男',wt:75,tag:1,dx:'FPV 直接撞擊、廣泛爆震',hx:[],allergy:null},
  {id:13,nm:'傷患13',cat:'民',age:5,sex:'男',wt:19,tag:2,dx:'腹瀉脫水（避難收容所）',hx:[],allergy:null,child:true},
  {id:14,nm:'傷患14',cat:'民',age:58,sex:'男',wt:74,tag:3,dx:'高血壓斷藥、頭暈',hx:['Amlodipine 每日','Metformin 每日','Aspirin 每日'],allergy:null},
  {id:15,nm:'傷患15',cat:'民',age:7,sex:'男',wt:23,tag:3,dx:'手臂二度燒燙傷（熱水）',
   hx:[],allergy:null,child:true},
  {id:16,nm:'傷患16',cat:'民',age:31,sex:'女',wt:58,tag:3,dx:'背部擦挫傷',
   hx:[],allergy:null},
  {id:17,nm:'傷患17',cat:'軍',age:27,sex:'男',wt:80,tag:2,dx:'左下肢開放性骨折、疼痛劇烈',
   hx:[],allergy:'Penicillin 過敏（幼時全身疹，未曾休克）'},
  {id:18,nm:'傷患18',cat:'民',age:74,sex:'女',wt:49,tag:3,dx:'心房顫動、長期抗凝血中',
   hx:['Warfarin 每日','Amiodarone 每日'],allergy:null},
];
/* 藥局紀錄上只有已知的事。下面這些，要開口問了才會知道——
   病人不會主動說他在吃「血液稀釋的藥」、在餵母奶、或今天早上自己吃過兩顆普拿疼。
   每一位都可以問；問了才知道有沒有。 */
const PT_ASK = {
  1:['今天早上自己吃了兩顆家裡帶來的普拿疼（Acetaminophen 500 mg）'],
  2:['在家長期吃 Prednisolone 5 mg，一天一顆，吃了兩年'],
  3:['最後一次打胰島素是四天前；這兩天吃得很少'],
  4:['（家屬）她吞藥丸會吐，平常都吃藥水'],
  5:['上一次透析是五天前；這幾天尿很少'],
  6:['有在吃「血液稀釋的藥」——藥袋上寫 Warfarin，每天一顆'],
  9:['（家屬）他平常吃 Valproate，一天兩次，已經四天沒吃了'],
  11:['（家屬）她在家睡不好時會吃半顆安眠藥，藥名不知道'],
  13:['（家屬）昨晚鄰居給了一顆止瀉藥，已經吃了'],
  14:['上次吃 Amlodipine 是四天前；自己帶了半排別家廠牌的'],
  15:['（家屬）他有蠶豆症（G6PD 缺乏症），出生時篩檢出來的'],
  16:['純哺乳中，寶寶 2 個月，一天餵 8 次'],
  18:['最近刷牙牙齦會流血，腳上的瘀青變多了'],
};
const patById = Object.fromEntries(PATIENTS.map(p=>[p.id,p]));
PATIENTS.forEach(p=>{p.given=[]; p.harm=0; p.educated=[]; p.ask=PT_ASK[p.id]||[]; p.asked=false;});
/* ---------- 2b. 開立者 ----------
   第四天，能站的人都被排上了。處方的品質跟開立的人有關：
   每天在開藥的人幾乎不會錯；被調來代打的人，錯在可以預測的地方。
   這不是在說誰比較差。是在說——把人放到他不熟的位置上，錯誤會落在固定的幾格裡，
   而知道錯誤會落在哪幾格，正是藥師站在這裡的理由。 */
const PRESCRIBERS = [
 {n:'張醫師', sp:'急診專科・第 11 年', err:.05, w:34, kinds:['stock','cold'],
  tell:'處方乾淨，劑量與體重都算過。他出問題時通常不是判斷，是他不知道我們缺什麼。'},
 {n:'何醫師', sp:'家醫科主治', err:.07, w:26, kinds:['dup','stock','sig'],
  tell:'慢性病用藥很穩。忙起來會漏看這個人今天已經領過同成分的藥。'},
 {n:'林醫師', sp:'一般外科・平常不開內科藥', err:.26, w:14, kinds:['ped','route','sig','dose'],
  tell:'刀開得漂亮。但他好幾年沒有親手算過一個五歲孩子的劑量，用法也常常只寫「止痛 prn」。'},
 {n:'陳醫師', sp:'醫美・住院醫師訓練後未再接急重症', err:.30, w:12, kinds:['inter','ctrl','dose','ped'],
  tell:'年輕、肯留下、手很穩。但他這幾年開的是保養處方；抗凝血、腎功能與管制藥品程序都不在他的日常裡。'},
 {n:'郭醫師', sp:'社區診所四十年・自願留下', err:.24, w:10, kinds:['old','renal','inter','ped'],
  tell:'他叫得出每一個鄰居的名字。但他寫的是三十年前的商品名與劑量習慣，也還沒把腎功能放進去算。'},
 {n:'NGO 醫師', sp:'國際人道組織派駐・第 3 週', err:.16, w:10, kinds:['stock','sig','old'],
  tell:'急重症他比誰都熟——他做過三個戰區。但台灣的品項、規格與商品名他還在學，'
    +'他寫的劑量單位有時候跟我們的包裝對不起來。'},
 {n:'蘇護理師', sp:'依醫囑轉抄', err:.10, w:4, kinds:['sig','dose'],
  tell:'轉抄的錯不是判斷錯，是手誤——而手誤跟判斷錯一樣會進到病人身上。'},
];
const DOC = Object.fromEntries(PRESCRIBERS.map(d=>[d.n,d]));
/* ---------- 3. 退回理由 ---------- */
const REASONS = [
  {id:'dose', n:'劑量與體重／年齡不符', d:'單位換算、成人劑量誤用、劑量翻倍'},
  {id:'ped',  n:'兒童用藥不適當',       d:'未依體重計算，或該年齡不建議使用'},
  {id:'renal',n:'未依器官功能調整',     d:'腎功能、肝功能、透析病人'},
  {id:'stock',n:'庫存不足，建議替代品項', d:'本站無此品項或數量不足'},
  {id:'cold', n:'冷鏈中斷，效價存疑',   d:'冷藏品項曾脫離 2–8℃'},
  {id:'inter',n:'交互作用或禁忌症',     d:'含過敏史、抗凝血劑、器官功能'},
  {id:'dup',  n:'重複用藥',             d:'同成分或同類已於近期給藥'},
  {id:'ctrl', n:'管制藥品程序不符',     d:'未依規登記、無雙人核對、無正本處方'},
  {id:'ident',n:'病人辨識不符',         d:'姓名、編號或診斷與處方不一致'},
  {id:'route',n:'給藥途徑或劑型不適當', d:'昏迷者口服、鼻胃管餵食、劑型錯誤'},
  {id:'sig',  n:'用法未寫清楚或無法判讀', d:'缺劑量、間隔或天數；只寫「prn」'},
  {id:'old',  n:'已不建議或已禁用的用法', d:'舊商品名、舊劑量習慣、該族群已禁用'},
];
const REASON_N = Object.fromEntries(REASONS.map(r=>[r.id,r.n]));
