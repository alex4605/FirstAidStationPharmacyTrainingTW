"use strict";
/* 還開著 STILL OPEN — 突發事件、冷鏈與空襲威脅 */

/* ---------- 7. 突發事件 ---------- */
/* ---------- 8b. 突發事件池 ----------
   每一場抽 3–5 個，時間與順序都不一樣。每一個都要你在幾秒內決定一件事，
   而且每一個都會在某個地方回來找你。 */
function evtChoice(title, kicker, body, opts, cls){
  openModal(`<h1>${title}</h1><p class="kicker">${clock(S.t)} · ${kicker}</p>${body}
    ${opts.map((o,i)=>`<button class="opt" data-c="${i}"><b>${o.t}</b>${o.s?`<span>${o.s}</span>`:''}</button>`).join('')}
    <div class="btnrow"></div>`,
    ()=>{ $('sheet').querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      const o=opts[+b.dataset.c]; closeModal(); o.go&&o.go(); }); });
}
function fireEvent(id){
  if (id==='mci'){
    log('※ 街口爆炸，多名傷患同時抵達。處方將同時湧入。','l-bad');
    openModal(`<h1>大量傷患</h1><p class="kicker">${clock(S.t)} · 街口爆炸</p>
      <p>檢傷掛號區同時湧入多名傷患。接下來幾分鐘內會有數張 <b>STAT</b> 處方同時進到你的佇列，其中包含管制藥品。</p>
      <div class="note warn">大量傷患時第一個被跳過的，永遠是管制藥品的登記與雙人核對。這一段就是要看你會不會跳過。</div>
      <div class="btnrow"><button class="pbtn" id="ok">了解</button></div>`,
      ()=>{ $('ok').onclick=()=>closeModal(); });
  }
  if (id==='raid'){
    log('※ 空襲警報。全站人員移至內走廊。','l-bad');
    evtChoice('空襲警報','警報器','<p>警報響了。站長在喊所有人往內走廊靠，離開外牆。你手上的東西要放下。</p>'
      +'<div class="note warn">你有大約十五秒。管制藥品櫃現在是開的。</div>',
      [{t:'先鎖管制藥品櫃，帶走鑰匙，再走', s:'多花十幾秒。但那個櫃子不能在沒有人的時候是開的。',
        go:()=>{ mark('P3',true,'空襲警報下仍先完成管制藥品上鎖並帶走鑰匙');
          startWork('警報疏散（已完成上鎖）', rint(6,10), ()=>log('警報解除，回到藥局。','l-ok')); }},
       {t:'直接走，人比較重要', s:'沒有人會怪你。但櫃子開著，走廊上有兩百多個人。',
        go:()=>{ mark('P3',false,'空襲警報期間管制藥品櫃未上鎖即離開');
          if (chance(.45)) S.pending.push({at:S.t+rnd(30,60), raidLoss:true});
          startWork('警報疏散', rint(6,10), ()=>log('警報解除，回到藥局。','l-warn')); }},
       {t:'不走，把手上這張配完', s:'',
        go:()=>{ mark('P9',false,'警報期間未依指示疏散');
          log('你留在原地。沒有人來叫你第二次。','l-warn'); S.fatigue=Math.min(100,S.fatigue+8); }}]);
  }
  if (id==='comms'){
    const dur=rint(45,80); S.commsDown=S.t+dur;
    log(`※ 無線電與市話同時中斷，預計 ${dur} 分鐘。這段時間聯絡不上開立者。`,'l-bad');
    narrate('無線電只剩下白噪音。你手上這幾張，得自己決定。');
    evtChoice('通訊中斷', `無線電・預計 ${dur} 分鐘`,
      '<p>無線電與市話同時斷了。你現在沒有辦法打電話問開立者，退回的處方也回不去。</p>'
      +'<div class="note warn">「向開立者確認」這段時間不能用。有疑慮的處方，你只剩下配、註記、退回三條路。</div>',
      [{t:'把待確認的處方集中起來，等通訊恢復一次處理', s:'病人會等，但不會有人拿到不確定的藥。',
        go:()=>{ mark('P8',true,'通訊中斷期間建立待確認清單'); }},
       {t:'先照原處方配，回來再說', s:'',
        go:()=>{ mark('P1',false,'通訊中斷期間選擇一律照配'); log('你決定先配。','l-warn'); }}]);
  }
  if (id==='fridged'){
    const up=rnd(9,13); S.fridge=Math.max(S.fridge,up);
    log(`※ 冷藏庫門沒有關緊，目前 ${up.toFixed(1)}℃。`,'l-bad');
    evtChoice('冰箱門沒關緊', `冷藏庫 ${up.toFixed(1)}℃`,
      `<p>不知道是誰拿東西之後沒把門壓到底。溫度已經到 <b>${up.toFixed(1)}℃</b>，不知道多久了。裡面是 Insulin 2 支、破傷風類毒素、Oxytocin。</p>`
      +'<div class="note cold">脫離 2–8℃ 的時間長度決定效價，而「不知道多久」本身就是一個答案。</div>',
      [{t:'關門、記錄發現時間與溫度、標示為效價存疑並通報', s:'該做的三件事：時間、溫度、標示。',
        go:()=>{ mark('P5',true,'發現冷鏈脫離後完成記錄、標示與通報'); S.coldBreach++;
          startWork('冷鏈事件記錄與品項標示', 6, ()=>log('已完成記錄與標示。','l-ok')); }},
       {t:'關門就好，溫度等一下就回來了', s:'',
        go:()=>{ mark('P5',false,'冷鏈脫離未記錄、未標示'); log('門關上了。沒有人知道它開了多久。','l-warn'); }},
       {t:'把 Insulin 移到冰袋箱，其餘留在原處再觀察', s:'',
        go:()=>{ mark('P5',true,'優先保全最關鍵的冷藏品項'); S.iceBags=Math.max(S.iceBags,1.2);
          log('Insulin 已移入冰袋箱。','l-ok'); }}]);
  }
  if (id==='lasa'){
    const a=pick(DRUGS.filter(d=>d.f==='針劑')), b=pick(DRUGS.filter(d=>d.f==='針劑'&&d.id!==a.id));
    log('※ 兩個外觀相近的品項放在同一格。','l-warn');
    evtChoice('看起來一模一樣','藥品架',
      `<p>你伸手要拿 <b>${a.n}</b>，指尖碰到的是旁邊那一盒 <b>${b.n}</b>。同樣的安瓿、同樣的字體、同一格。</p>`
      +'<div class="note warn">這一次你看到了。下一次是誰的手、在什麼時候伸進來，你不會知道。</div>',
      [{t:'兩者分開存放，各貼警示標籤，並在交班紀錄寫下來', s:'花五分鐘，換掉一個結構性的風險。',
        go:()=>{ mark('P2',true,'主動處理外觀相似品項（LASA）並貼警示標示');
          mark('P8',true,'外觀相似品項已寫入交班紀錄');
          startWork('分開存放與警示標示', 5, ()=>log('已分開存放並貼標。','l-ok')); }},
       {t:'先記在心裡，等空下來再處理', s:'',
        go:()=>{ mark('P2',false,'知道有外觀相似風險但未處理'); log('你記住了。你今天要記住的事已經太多了。','l-warn'); }},
       {t:'現在很忙，拿了就走', s:'',
        go:()=>{ mark('P2',false,'未處理外觀相似品項風險'); log('你拿了藥就走。','l-warn'); }}]);
  }
  if (id==='water'){
    log('※ 自來水中斷，只剩桶裝與酒精性乾洗手。','l-warn');
    evtChoice('停水','供水中斷',
      '<p>水線斷了。剩下的是兩桶飲用水和牆上的酒精性乾洗手。無菌配製、洗手、器具清洗都受影響。</p>',
      [{t:'改用酒精性乾洗手，限制只做必要的無菌配製，並優先保留飲用水', s:'該停的停，該保的保。',
        go:()=>{ mark('P12',true,'停水期間限縮無菌作業並保全飲用水'); }},
       {t:'照常作業，小心一點就好', s:'',
        go:()=>{ mark('P12',false,'停水期間仍照常進行無菌配製'); }}]);
  }
  if (id==='ownmeds'){
    const who=pick(['一位阿姨','一位先生','一個抱著小孩的媽媽']);
    evtChoice('避難民眾自己帶來的藥','領藥窗口',
      `<p>${who}拿著一個塑膠袋走到窗口。裡面是好幾板沒有外盒的藥，有些已經剪散了，有一板的字被水糊掉。</p>`
      +'<p>「藥師，這是我家裡的，我還可以吃嗎？我高血壓的藥吃完了。」</p>',
      [{t:'能辨識的逐項核對成分與劑量，不能辨識的請他先不要吃，並登記在藥局病人紀錄', s:'',
        go:()=>{ mark('P6',true,'自備藥品逐項辨識，無法辨識者不建議續用並留下紀錄');
          startWork('自備藥品辨識與紀錄', 6, ()=>log('已完成自備藥辨識與登記。','l-ok')); }},
       {t:'看起來像降血壓藥就讓他繼續吃，先安撫他', s:'',
        go:()=>{ mark('P6',false,'僅憑外觀判斷自備藥品即建議續用'); log('你憑外觀給了建議。','l-bad'); }},
       {t:'一律請他停用，等醫師看過', s:'安全，但他的血壓不會等醫師有空。',
        go:()=>{ mark('P6',false,'一律停用而未做辨識，可辨識的品項也被停掉'); }}]);
  }
  if (id==='neighbor'){
    const d=pick(DRUGS.filter(x=>x.st!=='ctrl'));
    evtChoice('鄰區急救站','無線電',
      `<p>鄰區急救站在無線電上：「我們 <b>${d.n.split(' ')[0]}</b> 用完了，你們還有嗎？我們這裡有兩個在等。」</p>`
      +`<div class="note ${S.counted?'ok':'warn'}">${S.counted
        ?`你今天盤過，說得出實際數量：目前 ${d.have} ${d.u}。`
        :'你今天還沒盤點。帳面數字是四天前的，你不確定架上真的有多少。'}</div>`,
      [{t:'依實際庫存調撥可分出的數量，記錄品項、數量與接收人', s:'',
        go:()=>{ if (!S.counted){ mark('P4',false,'未盤點即承諾調撥數量');
            log('你報了帳面數字。希望架上真的有。','l-warn'); }
          else { mark('P14',true,`依盤點結果調撥 ${d.n.split(' ')[0]} 給鄰區急救站`);
            mark('P4',true,'調撥前已確認實際庫存'); d.have=Math.max(0,d.have-Math.ceil(d.have*.2));
            d.book=d.have; log(`已調撥 ${d.n.split(' ')[0]} 給鄰區。`,'l-ok'); } }},
       {t:'先保留本站所需，說明可分出的上限與條件', s:'',
        go:()=>{ mark('P14',true,'以本站需求為前提回覆調撥上限'); }},
       {t:'回答沒有', s:'',
        go:()=>{ mark('P14',false,'未評估即回覆無法支援鄰區'); log('你說沒有。無線電那頭沉默了幾秒。','l-warn'); }}]);
  }
  if (id==='asking'){
    const what=pick(['安眠藥','止痛針','鎮定劑']);
    evtChoice('有人來要藥','領藥窗口',
      `<p>一個看起來沒睡的人站在窗口：「藥師，給我一點${what}就好，一點點。我三天沒有闔眼了。」</p>`
      +'<div class="note ctrl">他要的是管制藥品，而且沒有處方。他的疲憊是真的。</div>',
      [{t:'說明需經醫師評估與處方，安排他去看診，並先給非藥物的建議', s:'',
        go:()=>{ mark('P3',true,'無處方索取管制藥品時依規拒絕並轉介'); mark('P6',true,'提供非藥物的替代建議');
          log('你請他掛號，並告訴他幾件今晚可以做的事。','l-ok'); }},
       {t:'給一點點，讓他睡一下', s:'',
        go:()=>{ mark('P3',false,'無醫囑發出管制藥品'); S.ctrlSkipped++;
          log('※ 無處方發出管制藥品。這件事會出現在 AAR 上。','l-bad'); }},
       {t:'直接拒絕，不解釋', s:'',
        go:()=>{ mark('P3',true,'未依處方發放管制藥品'); mark('P6',false,'拒絕但未說明也未轉介');
          log('他站了一會兒才走。','l-warn'); }}]);
  }
  if (id==='label'){
    const d=pick(DRUGS.filter(x=>x.f==='口服'));
    evtChoice('標籤泡爛了','庫備品區',
      `<p>庫備品區角落有水滲進來。一箱 <b>${d.n.split(' ')[0]}</b> 的外盒標籤糊成一片，品名還看得出來，效期與批號看不出來。</p>`,
      [{t:'整批隔離不使用，標示「待確認」，登記並於交班寫明', s:'',
        go:()=>{ mark('P4',true,'效期與批號無法辨識之品項整批隔離並登記');
          mark('P8',true,'待確認品項已寫入交班紀錄');
          d.have=Math.max(0,Math.round(d.have*.5)); d.book=d.have;
          startWork('隔離、標示與登記', 5, ()=>log('已隔離並登記。','l-ok')); }},
       {t:'憑外觀與剩餘量推估效期，繼續使用', s:'',
        go:()=>{ mark('P4',false,'效期無法辨識仍繼續使用'); log('你決定繼續用。','l-bad'); }},
       {t:'挑出看得清楚的，其餘先放著', s:'',
        go:()=>{ mark('P4',false,'部分處理，未辨識者未隔離也未標示'); }}]);
  }
  if (id==='shortage'){
    if (!S.counted){ log('管制藥品簿冊與實際數量不符 — 但你今天還沒盤點，沒有基準可比對。','l-warn');
      mark('P3',false,'未盤點，管制藥品短少無法查證'); return; }
    openModal(`<h1>管制藥品短少</h1><p class="kicker">${clock(S.t)} · 例行清點</p>
      <p>你在例行清點時發現：簿冊登記 Morphine 應剩 <b>${drugById.mor.have+1}</b> 支，實際清點 <b>${drugById.mor.have}</b> 支。差一支。</p>
      <div class="note ctrl">管制藥品的短少不是庫存問題，是法規事件。</div>
      <button class="opt" data-c="a"><b>立即停止領用、重新清點並核對簿冊，登記異常並通報站長與主管機關</b>
        <span>會佔用時間，佇列會積壓。但這是唯一正確的做法。</span></button>
      <button class="opt" data-c="b"><b>先繼續作業，等交班時一起說</b>
        <span>時間拖越久，越難查出流向。</span></button>
      <button class="opt" data-c="c"><b>從其他批號補上，讓帳面對得起來</b>
        <span>帳面會很好看。</span></button>
      <div class="btnrow"></div>`,
      ()=>{ $('sheet').querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
        const c=b.dataset.c;
        if (c==='a'){ mark('P3',true,'發現管制藥品短少後立即清點、登記異常並通報');
          log('已停止領用、重新清點並通報站長。','l-ok');
          startWork('管制藥品異常清點與通報', 9, ()=>log('清點與通報完成。','l-ok')); }
        if (c==='b'){ mark('P3',false,'管制藥品短少未即時通報'); log('選擇稍後再說。','l-warn'); }
        if (c==='c'){ mark('P3',false,'以其他批號填補管制藥品短少（嚴重違規）');
          log('※ 以其他批號補帳。這件事會出現在 AAR 上。','l-bad'); }
        closeModal(); }); });
  }
}
function tickCold(dt){
  const load = S.genOn && S.fuel>0;
  let target = load?4.0:21.0;
  if (!load && S.fridgeBackup) target = 5.5;
  if (!load && S.iceBags>0){ target = 9.0; S.iceBags = Math.max(0,S.iceBags-dt*0.011); }
  S.fridge += (target-S.fridge)*dt*(load?0.05:0.011);
  if (S.fridge>8){
    S.coldBreach += dt;
    if (!S.coldWarned){ S.coldWarned=true;
      log('※ 冷藏庫溫度超過 8℃。Insulin 與破傷風類毒素疫苗開始計算脫鏈時間。','l-bad');
      openColdChoice(); }
    if (S.coldBreach>70 && !S.coldLost){
      S.coldLost=true;
      const ins=drugById.ins, tt=drugById.tt, oxy=drugById.oxy;
      if (S.coldSaved!=='ins') ins.have=0;
      if (S.coldSaved!=='tt') tt.have=Math.floor(tt.have*0.15);
      oxy.have=Math.floor(oxy.have*0.5);
      log('※ 脫鏈超過 70 分鐘。未受保護的冷藏品項效價存疑，依規不得使用。','l-bad');
      mark('P5',false,`冷鏈中斷 ${Math.round(S.coldBreach)} 分鐘，冷藏品項報廢`);
      dirty.stock=true;
    }
  } else S.coldWarned=false;
  dirty.top=true;
}
function openColdChoice(){
  openModal(`<h1>冷藏庫溫度上升</h1>
    <p class="kicker">2–8℃ · 目前 ${S.fridge.toFixed(1)}℃ · 你有大約 70 分鐘</p>
    <div class="note cold">冰箱（附件五 G3，100–150W）掛在發電機上。裡面是
      <b>Insulin ×${drugById.ins.have} 支</b>、<b>破傷風類毒素 ×${drugById.tt.have} 罐</b>、
      <b>Oxytocin ×${drugById.oxy.have} 支</b>。<br>
      Insulin 是傷患03 與傷患05 唯一的路；TT 是每一個外傷患都需要的 1 劑。</div>
    <button class="opt" data-c="ups"><b>接上行動電源（附件五 A5，1–2 kWh）</b>
      <span>冰箱可續命約 4 小時。代價：通訊與監測設備改用備援，站長的對外聯繫降級。</span></button>
    <button class="opt" data-c="ice"><b>製冰與保冷袋人工維持</b>
      <span>可撐約 90 分鐘${S.iceReady?'（你稍早已預先備妥，可立即投入）':'（現在才做要花你 8 分鐘，藥局暫時無人）'}。</span></button>
    <button class="opt" data-c="ins"><b>只保 Insulin，其餘放棄</b><span>2 支移入保冷箱。TT 與 Oxytocin 脫鏈報廢。</span></button>
    <button class="opt" data-c="tt"><b>只保破傷風疫苗，其餘放棄</b><span>350 罐移入保冷箱。Insulin 與 Oxytocin 脫鏈報廢。</span></button>
    <div class="field"><label>決策理由（會進入紀錄與 AAR）</label>
      <textarea id="coldwhy" placeholder="例：TT 影響 12 名以上外傷患；Insulin 只影響 2 人，且其中一人的存活路徑本來就是後送透析。"></textarea></div>`,
    ()=>{ $('sheet').querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      const c=b.dataset.c, why=esc($('coldwhy').value.trim());
      if (c==='ups'){ S.fridgeBackup=true; log('冰箱改由行動電源供電。通訊與監測改用備援。','l-cold'); }
      if (c==='ice'){ if (S.iceReady){ S.iceBags+=90; log('投入預先備妥的保冷袋。','l-cold'); }
        else startWork('臨時製冰與保冷袋', 6, ()=>{ S.iceBags+=90; log('保冷袋投入，冷鏈暫時穩住。','l-cold'); }); }
      if (c==='ins'){ S.coldSaved='ins'; log('選擇保 Insulin。','l-cold'); }
      if (c==='tt'){ S.coldSaved='tt'; log('選擇保破傷風疫苗。','l-cold'); }
      S.decisions.push({t:clock(S.t),cold:true,choice:b.querySelector('b').textContent,txt:why});
      mark('P5',!!why, why?'冷鏈處置決策已記錄理由':'冷鏈處置未記錄理由');
      closeModal(); }); });
}
function tickThreat(dt){
  S.expo = Math.max(0,S.expo-dt*0.05);
  if (S.genOn && S.fuel>0) S.expo = Math.min(100,S.expo+dt*0.038);
  const st = S.expo>=82?4 : S.expo>=58?3 : S.expo>=32?2 : 1;
  if (st!==S.stage){ S.stage=st;
    if (st===2) log('遠處低頻嗡鳴，同一方位重複出現。','l-warn');
    if (st===3) log('低空盤旋、長時間滯空。發電機是你最大的熱訊號，也是冰箱的電。','l-warn');
    if (st===4) strike();
    dirty.top=true; }
}
function strike(){
  S.strikes++; S.expo=44; shake=1; debris=1;
  log('※ 打擊。配電室受損，發電機停機，藥品架部分倒塌。','l-bad');
  S.genOn=false;
  ['ceph','acet','ns','ibu'].forEach(id=>{ const d=drugById[id];
    d.have = Math.max(0, Math.floor(d.have*0.72)); });
  mark('P5',false,'打擊導致發電機停機');
  mark('P4',false,'打擊造成藥品架倒塌，部分品項損毀');
  dirty.stock=true;
  pushJob({kind:'emt', title:'打擊後隊員受傷', zone:'store',
    intro:'配電室方向傳來爆炸。庫備品區有一名志工被倒下的層架壓到，右大腿在流血。醫護都在留觀區處理其他傷患。',
    steps:[
     {q:'第一步',opts:[
      {t:'先確認現場安全（結構、電線、二次打擊風險）再接近，並呼救',v:'good',fb:'3S。打擊後的接近紀律：不要在同一時間全部湧上去。'},
      {t:'立刻衝過去壓傷口',v:'mid',fb:'救人心切，但打擊後現場可能有二次危險與不穩結構。'},
      {t:'等醫師來再說',v:'bad',fb:'大量出血以分鐘計，而你就在旁邊，且你持有 EMT-2。'}]},
     {q:'右大腿噴射狀出血',opts:[
      {t:'立即上止血帶於傷口近心端，記錄上帶時間，再評估其他傷處',v:'good',fb:'正確。止血帶時間一定要寫在身上或紀錄上。'},
      {t:'先用紗布加壓，觀察十分鐘',v:'bad',fb:'噴射狀出血代表動脈損傷，直接壓迫常不足。'},
      {t:'先量血壓再決定',v:'bad',fb:'先止血。血壓在活動性出血時不是決策依據。'}]},
     {q:'出血控制，病人臉色蒼白、心跳 128',opts:[
      {t:'建立靜脈路徑並依醫囑輸液、保暖、持續監測，同時通知醫師',v:'good',fb:'IV 與輸液在 EMT-2 執業範圍內。低體溫是創傷病人最快的殺手之一。'},
      {t:'自行推 Morphine 止痛',v:'bad',fb:'管制藥品且無醫囑，超出執業範圍。',pen:'P9'},
      {t:'先扶他到藥局坐著休息',v:'bad',fb:'休克病人不應行走。'}]}]});
}
