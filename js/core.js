"use strict";
/* 還開著 STILL OPEN — 亂數種子、共用小工具與場地分區 */

/* =========================================================================
   還開著 STILL OPEN — v1.10「藥師視角（EMT-2）」
   空間、人員配置、藥品品項與七日儲備量取自衛福部 114 年
   「急救站設置參考指引」本文與附件四、附件五、附件六；
   冷鏈與 72 小時自主維生取自「地下空間作為替代醫療場所運作指引」。
   ========================================================================= */

/* ---------- 0a. 可重現的亂數 ----------
   訓練工具需要「整班跑同一場」的能力：種子寫在網址 #seed=xxxx，
   同一個種子會生出完全相同的幫手、事件與時序，可橫向比較。 */
const SEED = (()=>{
  const m = /seed=([A-Za-z0-9_-]{1,16})/.exec(location.hash||'');
  if (m) return m[1];
  const s = Math.random().toString(36).slice(2,8).toUpperCase();
  try { history.replaceState(null,'','#seed='+s); } catch(e){ /* 無法改寫網址時略過；本場種子仍然有效，只是不能分享連結 */ }
  return s;
})();
// 改了網址上的種子就重開一場
addEventListener('hashchange',()=>{ if (!/seed=/.test(location.hash) || !location.hash.includes(SEED)) location.reload(); });
const rng = (()=>{                       // mulberry32
  let h=1779033703^SEED.length;
  for (let i=0;i<SEED.length;i++){ h=Math.imul(h^SEED.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  let a=(h^h>>>16)>>>0;
  return ()=>{ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; };
})();
/* 畫面效果專用的亂數（NPC 漫步、鏡頭晃動、灰塵）。不吃種子：
   這些每一幀都在抽，若與劇情共用同一條亂數序列，幀率不同的兩台機器
   跑同一個種子就會抽到不同的事件結果。 */
const fxRnd = (a,b)=>a+Math.random()*(b-a);
/** 玩家手打的文字要先跳脫才能放進 innerHTML（例如「<5 mg」） */
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd   = (a,b)=>a+rng()*(b-a);
const rint  = (a,b)=>Math.floor(rnd(a,b+1));
const pick  = arr=>arr[Math.floor(rng()*arr.length)];
const chance= p=>rng()<p;
function shuffle(arr){ const a=arr.slice();
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a; }
const sample = (arr,n)=>shuffle(arr).slice(0,n);
/* 選項的顯示順序。題庫裡正解大多寫在第一個、複選題的對的全排在前面——
   不打亂的話，玩家不用懂藥也猜得到。這裡用「種子＋題目」決定順序，
   不動主亂數（主亂數的抽取順序會隨玩家操作而變），所以同一個種子、同一題，順序永遠一樣。 */
function keyedShuffle(arr, key){
  let h=2166136261;
  const s=SEED+'|'+key;
  for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  const r=()=>{ h=Math.imul(h^h>>>15,2246822507); h=Math.imul(h^h>>>13,3266489909); h^=h>>>16; return (h>>>0)/4294967296; };
  const a=arr.slice();
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
/** 把一組事件平均鋪在 [from,to] 之間，加上抖動，回傳排序後的時間 */
function spread(n, from, to, jitter){
  const step=(to-from)/n, out=[];
  for (let i=0;i<n;i++){ const v=from+step*i+rnd(-(jitter||step*0.3),(jitter||step*0.3));
    out.push(Math.round(Math.max(from,Math.min(to,v)))); }
  return out.sort((a,b)=>a-b);
}

/* ---------- 0. 場地 ---------- */
const ZONES = [
  {id:'ramp', name:'救護車停車與動線區', a:[1,-15], b:[9,-9.4], c:0x161c1f, k:'車道口'},
  {id:'admin',name:'行政區',           a:[-13,-9], b:[-8,-4],  c:0x171e21, k:'指揮中心 5坪'},
  {id:'pharm',name:'藥局',             a:[-8,-9],  b:[-3,-4],  c:0x2a2317, k:'調劑作業 4坪'},
  {id:'tri',  name:'檢傷掛號區',       a:[-3,-9],  b:[3,-4],   c:0x211c19, k:'單一入口 4坪'},
  {id:'iso',  name:'隔離區',           a:[3,-9],   b:[8,-4],   c:0x1a2022, k:'負壓／帳篷'},
  {id:'mort', name:'罹難遺體管理區',   a:[9,-9],   b:[13,-4],  c:0x131617, k:'5坪'},
  {id:'store',name:'庫備品區',         a:[-13,-4], b:[-8,1],   c:0x231e14, k:'上鎖藥櫃・冷藏'},
  {id:'tx1',  name:'診療區一',         a:[-8,-4],  b:[-2,1],   c:0x182224, k:'處置 隱私'},
  {id:'pub',  name:'公共空間',         a:[-2,-4],  b:[5,6],    c:0x161b1d, k:'候診／領藥／家屬'},
  {id:'obs',  name:'留觀區',           a:[5,-4],   b:[13,6],   c:0x161f22, k:'10 床'},
  {id:'waste',name:'廢棄物處理區',     a:[-13,1],  b:[-8,6],   c:0x181616, k:'感染性／針具'},
  {id:'tx2',  name:'診療區二',         a:[-8,1],   b:[-2,6],   c:0x182224, k:'處置 隱私'},
];
const zoneById = Object.fromEntries(ZONES.map(z=>[z.id,z]));
const zc = z => [(z.a[0]+z.b[0])/2,(z.a[1]+z.b[1])/2];
const inZone = (p,id)=>{const z=zoneById[id];return p[0]>=z.a[0]&&p[0]<=z.b[0]&&p[1]>=z.a[1]&&p[1]<=z.b[1];};
const BENCH=[-5.6,-6.9], FRIDGE=[-11.2,-6.1], WINDOW=[-2.6,-6.2];
