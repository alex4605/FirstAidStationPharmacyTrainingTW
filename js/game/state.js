"use strict";
/* 還開著 STILL OPEN — 遊戲狀態、紀錄與評核計分 */

/* ---------- 5. 狀態 ---------- */
const COMP = {
  P1:['處方核對（五對）','攔截有問題的處方，且不過度阻擋'],
  P2:['調劑正確性','劑型選擇、體重換算、稀釋與分裝'],
  P3:['管制藥品管理','上鎖、逐筆登記、雙人核對'],
  P4:['庫存與效期管理','盤點、預警、調撥與替代建議'],
  P5:['冷鏈維持','2–8℃、備援電力、優先順序'],
  P6:['用藥諮詢與衛教','對病人與家屬的給藥指導'],
  P7:['跨職類諮詢與溝通','回答其他職類的問題、退回處方時的替代建議'],
  P8:['交班與書面指示','夜班無藥師編制下的備藥與指示'],
  P9:['EMT-2 執業範圍','現場處置的正確性與越權判斷'],
  P10:['幫手的查核、授權與督導','資格查核、授權範圍、作業簡介與督導'],
  P11:['CBRNE 應變','除污動線、個人防護、解毒劑與污染廢棄物'],
  P12:['支援性作業','抽藥、配製、藥車清點與估算的品質與標示'],
  P13:['語言障礙下的用藥安全','語言不通時仍完成過敏史確認、成分比對與書面指示，並保持身分中立'],
  P14:['物資調撥與外部協調','對外請求與被徵調時的依據、優先順序與紀錄'],
  P15:['現場秩序與情緒處理','窗口前的憤怒、悲傷與急性壓力：先處理人，再處理事，而且不用藥去解決情緒'],
};
const S = {
  t:0, speed:1, running:false, over:false, autopause:true,
  jobs:[], nextJob:0, sel:null, nextN:1,
  fridge:4.0, fridgeBackup:false, iceBags:0, coldBreach:0,
  fuel:180, genOn:true, expo:6, stage:1, strikes:0,
  fatigue:8, atBench:true, task:null,
  dispensed:0, returned:0, errors:0, blocked:0, wrongBlock:0,
  ctrlLedger:[], ctrlSkipped:0, counted:false, iceReady:false,
  conGood:0, conBad:0, eduGood:0, eduBad:0, emtGood:0, emtBad:0, scope:0,
  assGood:0, assBad:0, cbrGood:0, cbrBad:0, contaminated:false,
  crowdGood:0, crowdBad:0,
  helpers:[], overAuth:0, briefed:0, pickups:[],
  handover:{pack:false,orders:false,ctrl:false,note:''}, night:null,
  commsDown:0, byBad:{}, noticed:{}, asked:0, subs:0, partials:0, evts:[],
  sup:{sharp:true,label:true,oral:true,book:true}, supWarn:{},
  patrol:null, patrolIn:null, patrolSeen:[],
  log:[], comp:{}, decisions:[], pending:[],
};
for (const k in COMP) S.comp[k] = {good:0,bad:0,ev:[]};
const clock = m => String(8+Math.floor(m/60)).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');
function log(m,c){S.log.push({t:clock(S.t),m,c:c||''}); if(S.log.length>300)S.log.shift(); dirty.log=true;}
function mark(k,good,txt){const e=S.comp[k]; if(!e)return; good?e.good++:e.bad++;
  e.ev.push({t:clock(S.t),good,txt}); if(e.ev.length>30)e.ev.shift();}
