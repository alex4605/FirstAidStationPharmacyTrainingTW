"use strict";
/* 還開著 STILL OPEN — 處方題庫 */

/* ---------- 4b-2. 處方題庫的補充 ----------
   乾淨的處方（多數）與各開立者特有的錯誤。每一場只會抽到其中幾張，
   所以同一個種子以外，你不會知道今天哪幾張有問題。 */
const RX_CLEAN = [
 {kind:'rx', pid:14, d:'amlo', dose:'5 mg PO qd ×7 天份', preferBy:'何醫師',
  why:'斷藥後恢復他原本在吃的降血壓藥，劑量與病史一致。'},
 {kind:'rx', pid:4, d:'acetp', dose:'120mg/5mL　10 mL PO q6h prn', preferBy:'林醫師',
  why:'傷患04 體重 20 kg，10 mL 是 240 mg，約 12 mg/kg，在兒童單次劑量範圍內。'},
 {kind:'rx', pid:17, d:'acet', dose:'500 mg PO q6h ×3 天份', preferBy:'張醫師',
  why:'開放性骨折的輔助止痛，與 Morphine 合用可以減少鴉片類的用量。'},
 {kind:'rx', pid:17, d:'mor',   dose:'5 mg IV q4h prn', preferBy:'張醫師',
  why:'開放性骨折的疼痛控制。管制藥品，一次配一次的量。'},
 {kind:'rx', pid:17, d:'azi',   dose:'500 mg PO qd ×3 天份', preferBy:'張醫師',
  why:'傷患17 對 Penicillin 過敏，這張特地避開了 β-lactam。'},
 {kind:'rx', pid:16, d:'ibu',   dose:'400 mg PO q8h prn ×3 天份', preferBy:'何醫師',
  why:'哺乳期相對安全的止痛選擇。'},
 {kind:'rx', pid:15, d:'acetp', dose:'120mg/5mL　12 mL PO q6h prn', preferBy:'何醫師',
  why:'7 歲、23 kg，依 10–15 mg/kg 換算後的兒童藥水劑量。'},
 {kind:'rx', pid:18, d:'acet',  dose:'500 mg PO q6h prn ×2 天份', preferBy:'張醫師',
  why:'抗凝血中的長者，止痛避開 NSAID。'},
 {kind:'rx', pid:12, d:'txa',   dose:'1 g IV over 10 min', preferBy:'張醫師',
  why:'爆震傷合併出血，受傷 3 小時內給予。一支 500mg。'},

 {kind:'rx', pid:2,  d:'pred',  dose:'30 mg PO qd ×5 天份', preferBy:'張醫師',
  why:'COPD 急性惡化的短期口服類固醇療程。'},
 {kind:'rx', pid:10, d:'azi',   dose:'500 mg PO qd ×3 天份', preferBy:'張醫師',
  why:'傷患10 對 Penicillin 過敏，這張特地避開了 β-lactam。'},
 {kind:'rx', pid:6,  d:'acet',  dose:'500 mg PO q6h prn ×2 天份', preferBy:'何醫師',
  why:'服用 Warfarin 者的止痛首選，避開 NSAID。'},
 {kind:'rx', pid:11, d:'ors',   dose:'1 包溶於 250 mL，分次餵食', preferBy:'何醫師',
  why:'高齡脫水，先以口服補液鹽補充。'},
 {kind:'rx', pid:13, d:'ors',   dose:'依脫水程度少量多次補充', preferBy:'何醫師',
  why:'兒童急性腹瀉的第一線是補水，不是止瀉。'},
 {kind:'rx', pid:9,  d:'lansoi',dose:'30 mg IV qd', preferBy:'張醫師',
  why:'已置放鼻胃管者改用針劑，避免磨粉與腸溶衣的問題。'},
 {kind:'rx', pid:1,  d:'ceph',  dose:'500 mg PO qid ×5 天份', preferBy:'林醫師',
  why:'碎片傷的口服抗生素療程。'},
 {kind:'rx', pid:7,  d:'ceftx', dose:'1 g IV q24h', preferBy:'張醫師',
  why:'腹部穿刺傷的靜脈抗生素。'},
 {kind:'rx', pid:5,  d:'nabic', dose:'40 mL IV slow', preferBy:'張醫師',
  why:'高血鉀的暫時性處置之一，與 CaCl₂ 併行。一支 20 mL。'},
 {kind:'rx', pid:7,  d:'d50',   dose:'50 mL IV push', preferBy:'張醫師',
  why:'低血糖的緊急處置。一支 20 mL——這一張不是拿一支就好。'},
 {kind:'rx', pid:10, d:'hydro', dose:'200 mg IV stat', preferBy:'何醫師',
  why:'嚴重過敏反應的類固醇。一瓶 100 mg。'},
 {kind:'rx', pid:7,  d:'ceftx', dose:'1 g IV q24h ×3 天份', preferBy:'張醫師',
  why:'腹部穿刺傷的靜脈抗生素療程，一次配三天的量。'},
 {kind:'rx', pid:12, d:'txa',   dose:'1 g IV over 10 min', preferBy:'張醫師',
  why:'爆震傷合併出血，受傷 3 小時內給予。'},
];
const RX_FLAGGED = [
 {kind:'rx', pid:3, d:'glim', dose:'5 mg PO qd ×3 天份', flag:'inter', fx:'血糖機量到 380，一直口渴、人很累', preferBy:'陳醫師',
  why:'傷患03 是胰島素依賴型糖尿病，已斷胰島素 4 天。磺醯脲類無法取代胰島素，只會延誤處置，酮酸中毒的風險還在。',
  alt:'要處理的是恢復胰島素與評估酮酸中毒，請醫師決定劑量與監測。', altD:'ins'},

 {kind:'rx', pid:7, d:'furoi', dose:'20 mg IV q12h prn', fx:'血壓掉到 78/40，手腳冰冷', flag:'inter', preferBy:'林醫師',
  why:'傷患07 是失血性休克。Furosemide 會再減少血容量，現在要的是止血與補充血容量，不是利尿。',
  alt:'不給。先處理出血與輸液，若有疑問由醫師確認。'},

 {kind:'rx', pid:4, d:'ibup', dose:'100mg/5mL　30 mL PO q6h prn', fx:'吐了兩次，說肚子痛', flag:'dose', preferBy:'林醫師',
  why:'傷患04 體重 20 kg，30 mL 相當 600 mg，每次 30 mg/kg，是兒童單次上限（約 10 mg/kg）的三倍。看起來是把成人劑量直接抄過來。',
  alt:'依體重 5–10 mg/kg 重算，最多 10 mL（200 mg），每 6–8 小時一次。'},

 {kind:'rx', pid:6, d:'asa', dose:'100 mg PO qd ×3 天份', flag:'inter', fx:'頭皮傷口又開始滲血', preferBy:'何醫師',
  why:'傷患06 在吃 Warfarin，INR 4.8，頭皮撕裂傷還在出血風險中。Aspirin 會再加重出血。',
  alt:'暫不併用；止痛改用 Acetaminophen，並請醫師處理 INR。', altD:'acet'},

 {kind:'rx', pid:5, d:'ibu', dose:'200 mg PO q8h prn ×3 天份', flag:'renal', fx:'尿量更少了，心電圖的 T 波看起來更尖', preferBy:'何醫師',
  why:'傷患05 透析中斷、血鉀 6.9。NSAID 會讓血鉀更高，也傷殘餘腎功能。',
  alt:'止痛改用 Acetaminophen；血鉀與透析的問題另外跟醫師確認。', altD:'acet'},

 /* ── 台灣現場真的會遇到的幾個 ───────────────────── */
 {kind:'rx', pid:15, d:'ssd', dose:'外用塗抹，每日換藥', fx:'臉色發白、尿變成茶色，活力很差', flag:'inter', preferBy:'林醫師',
  why:'傷患15 有 G6PD 缺乏症（蠶豆症）。Silver Sulfadiazine 屬磺胺類，'
    +'G6PD 缺乏者使用可能誘發溶血。這一條在他的病歷第一行。',
  alt:'建議改用非磺胺類的燒燙傷敷料處理，並在藥局病人紀錄第一行標註 G6PD。', altD:'ns'},

 {kind:'rx', pid:16, d:'cod', dose:'30 mg PO q6h prn', fx:'說寶寶今天特別愛睡、吸奶沒力', flag:'inter', preferBy:'郭醫師',
  why:'傷患16 正在純哺乳。Codeine 在超快代謝者身上會讓乳汁中的嗎啡濃度上升，'
    +'已有嬰兒呼吸抑制的案例，哺乳期不建議使用。而且這是管制藥品。',
  alt:'建議改用 Acetaminophen 或 Ibuprofen，兩者哺乳期相對安全。', altD:'acet', ctrl:true},

 {kind:'rx', pid:18, d:'azi', dose:'500 mg PO qd ×3 天份', flag:'inter', fx:'說心悸，牙齦在流血', preferBy:'陳醫師',
  why:'傷患18 長期服用 Warfarin 與 Amiodarone。Azithromycin 會同時拉高 INR 與延長 QT——'
    +'而她現在沒有辦法抽 INR，也沒有心電圖監測。',
  alt:'建議改用交互作用較小的抗生素，或先與醫師確認是否真的需要抗生素。', altD:'ceph'},

 {kind:'rx', pid:18, d:'ibu', dose:'400 mg PO tid', flag:'inter', fx:'解出黑色的便，有點頭暈', preferBy:'NGO 醫師',
  why:'傷患18 在服用 Warfarin。NSAID 併用會同時增加出血風險與影響腎功能，'
    +'而她 74 歲、這幾天喝水也不夠。',
  alt:'建議改用 Acetaminophen。', altD:'acet'},

 {kind:'rx', pid:17, d:'augm', dose:'375 mg PO tid ×5 天份', fx:'手臂和胸口起了一片紅疹，眼皮有點腫', flag:'inter', preferBy:'林醫師',
  why:'傷患17 對 Penicillin 過敏（幼時全身疹）。Amoxicillin/Clav 本身就是 penicillin 類，直接衝突。'
    +'他的過敏史寫在紀錄上，只是沒有人回頭看。',
  alt:'建議改用 Azithromycin 或 Clindamycin；若一定要用 β-lactam，須由醫師評估交叉過敏風險。', altD:'azi'},

 {kind:'rx', pid:12, d:'mida', dose:'5 mg IV q4h prn', fx:'呼吸變慢，血氧掉到 88%', flag:'inter', preferBy:'陳醫師',
  why:'傷患12 已經在用 Morphine。苯二氮平類與鴉片類併用會加成呼吸抑制，'
    +'而這裡沒有連續血氧監測，也沒有人能整夜盯著他。',
  alt:'建議避免常規併用；若非用不可，須先確認監測方式與 Naloxone 的可近性。', altD:'mor', ctrl:true},

 {kind:'rx', pid:5,  d:'amio', dose:'150 mg IV，以生理食鹽水稀釋後緩推', fx:'輸注那條管路越打越慢，打針的部位又紅又痛', flag:'route', preferBy:'蘇護理師', lockBy:true,
  orig:'150 mg IV，以 5% 葡萄糖稀釋後緩推', origBy:'張醫師',
  why:'轉抄時把稀釋液寫成了生理食鹽水。Amiodarone 在生理食鹽水中的相容性與穩定性不佳，'
    +'仿單指定以 5% 葡萄糖稀釋——這一點寫在仿單上，而現場沒有人會去翻仿單。',
  alt:'建議更正為以 5% 葡萄糖稀釋，並註明輸注時間。', altD:'amio'},

 {kind:'rx', pid:11, d:'meto', dose:'10 mg IV q8h', fx:'脖子僵硬、眼睛不自主往上翻，很不安', flag:'old', preferBy:'郭醫師',
  why:'傷患11 是 82 歲失智長者。Metoclopramide 在高齡與失智者身上容易引發錐體外症候群與譫妄，'
    +'而她現在已經有定向感障礙。',
  alt:'建議先找出嘔吐的原因；若須止吐，選用錐體外症候群風險較低的品項並縮短療程（本站沒有，需請醫師評估）。'},

 {kind:'rx', pid:15, d:'acet', dose:'500 mg PO q6h', flag:'ped', fx:'吐了兩次，說肚子右上方痛', preferBy:'NGO 醫師',
  why:'傷患15 是 7 歲、23 kg。Acetaminophen 建議 10–15 mg/kg/dose（約 230–345 mg），'
    +'500 mg 成人錠既過量也無法準確分割。',
  alt:'建議改用 Acetaminophen 120mg/5mL 兒童藥水，23 kg 約 10–14 mL。', altD:'acetp'},

 {kind:'rx', pid:3,  d:'ins', dose:'Actrapid 20 U SC tid', fx:'冒冷汗、手在抖，血糖機量到 42', flag:'sig', preferBy:'NGO 醫師', lockBy:true,
  why:'「U」在手寫或轉抄時極易被看成「0」而變成 200 單位——'
    +'國際上早已要求寫成 “units”。而本站的胰島素只剩 2 支，劑量寫錯沒有第二次機會。',
  alt:'建議改寫為「20 units」，並註明監測血糖的時間點。', altD:'ins'},

 {kind:'rx', pid:10, d:'tram', dose:'止痛 prn', fx:'護理師照自己的理解每 4 小時給一次，她現在很想睡', flag:'sig', preferBy:'林醫師',
  why:'用法只寫「止痛 prn」：沒有劑量、沒有間隔、沒有天數。這張沒有辦法調劑，也沒有辦法給藥指導。',
  alt:'建議補寫為 Tramadol 50 mg PO q6h prn，並註明最大日劑量。', altD:'tram'},
 {kind:'rx', pid:13, d:'loper', dose:'1# PO tid', fx:'肚子脹得很厲害，一直哭，也不太解便了', flag:'ped', preferBy:'林醫師',
  why:'傷患13 是 5 歲、19 kg 的孩子。兒童急性腹瀉不建議使用止瀉劑，Loperamide 於幼童更有腸阻塞與中樞抑制的風險。',
  alt:'建議改為口服補液鹽（ORS）補水，並衛教脫水徵象。', altD:'ors'},
 {kind:'rx', pid:13, d:'cod', dose:'半顆 PO tid 止咳', fx:'呼吸變慢、很難叫醒', flag:'old', preferBy:'郭醫師',
  why:'Codeine 已禁用於 12 歲以下兒童——超快代謝者會發生呼吸抑制，國際上有死亡案例。而且這是管制藥品。',
  alt:'建議停用，改以症狀支持與補水處理。', altD:'ors', ctrl:true},
 {kind:'rx', pid:5,  d:'cipro', dose:'500 mg PO bid ×7 天份', fx:'說頭暈、有點混亂，講話顛三倒四', flag:'renal', preferBy:'郭醫師',
  why:'傷患05 是透析中斷的病人。Ciprofloxacin 需依腎功能與透析時程調整劑量與間隔，原劑量會累積。',
  alt:'建議調整為 500 mg q24h 並於透析後給予。', altD:'cipro'},
 {kind:'rx', pid:3,  d:'pred', dose:'30 mg PO qd ×5 天份', flag:'inter', fx:'血糖機量到 410，一直跑廁所', preferBy:'陳醫師',
  why:'傷患03 是胰島素依賴糖尿病、已斷藥四天。全站 Insulin 只剩 2 支。類固醇會把她的血糖再推上去，而我們沒有胰島素跟得上。',
  alt:'建議避免全身性類固醇；若非用不可，須先確認胰島素供應與血糖監測頻率。', altD:'ins'},
 {kind:'rx', pid:4,  d:'asa', dose:'100 mg PO qd', flag:'ped', fx:'吐了好幾次，精神很差', preferBy:'陳醫師',
  why:'傷患04 是 6 歲兒童。兒童與青少年使用 Aspirin 有雷氏症候群（Reye syndrome）風險，且她並沒有需要抗血小板的適應症。',
  alt:'建議停用；止痛改以 Acetaminophen 依體重計算。', altD:'acetp'},
 {kind:'rx', pid:2,  d:'terb', dose:'Salbutamol 2.5 mg neb q6h', enName:'Salbutamol 2.5 mg/2.5 mL', flag:'stock', preferBy:'NGO 醫師', lockBy:true,
  why:'他寫的是 Salbutamol——那是他慣用的品項。本站沒有，庫備清單上是 Terbutaline。'
    +'成分不同、劑量也不能直接照抄。',
  alt:'建議改為 Terbutaline Sulfate 5mg/2mL 霧化，並重新換算劑量。', altD:'terb'},
 {kind:'rx', pid:12, d:'mor', dose:'Morphine 0.1 mg/kg IV q4h prn', fx:'呼吸變慢，叫兩次才睜眼', flag:'sig', preferBy:'NGO 醫師', lockBy:true,
  why:'以體重計算是國際上常見的寫法，但他沒有寫出換算後的實際毫克數，'
    +'而本站的安瓿是 10mg/1mL——照 mg/kg 抓藥很容易抓錯一個位數。',
  alt:'建議補寫換算後的單次劑量（75 kg 約 7.5 mg）與最大日劑量。', altD:'mor', ctrl:true},
 {kind:'rx', pid:9,  d:'lanso', dose:'qd', fx:'鼻胃管堵住了，灌不進去', flag:'sig', preferBy:'蘇護理師', lockBy:true,
  orig:'30 mg qd', origBy:'何醫師',
  why:'轉抄時漏掉了劑量，只寫了頻次。而且傷患09 有鼻胃管，腸溶錠不能磨粉。',
  alt:'建議補寫劑量，並改為 Lansoprazole 40mg/Vial 針劑。', altD:'lansoi'},
 {kind:'rx', pid:11, d:'lora', dose:'2 mg PO hs', fx:'半夜下床跌倒，比白天更混亂', flag:'old', preferBy:'郭醫師',
  why:'傷患11 是 82 歲的失智長者。苯二氮平類用於高齡者會增加譫妄與跌倒風險，屬於老年人潛在不適當用藥。',
  alt:'建議先處理脫水與環境定向，避免常規使用鎮靜劑。', altD:'ors'},
 /* ── 處方箋格式本身帶來的錯誤 ────────────────────────
    同一個錯，在不同的紙上長得不一樣：管制藥品專用處方箋少一欄、
    口頭醫囑少一個單位、轉抄少一個小數點、連續處方多開了幾週、英文處方用了危險的縮寫。 */
 {kind:'rx', pid:17, d:'mor', dose:'5 mg IV q4h prn', flag:'ctrl', preferBy:'陳醫師', lockBy:true, fmt:'ctrl', noLic:true,
  why:'管制藥品專用處方箋上「管制藥品使用執照號碼」那一欄是空的。劑量沒有問題，'
    +'但少了這一欄的處方，第一、二級管制藥品不能調劑。陳醫師這幾年沒有開過管制藥品。',
  alt:'請開立醫師補填管制藥品使用執照號碼並簽章後再調劑；等待期間疼痛先以 Acetaminophen 處理。'},

 {kind:'rx', pid:12, d:'mor', dose:'「Morphine 給 10」IV stat（未說單位）', fx:'呼吸變慢，血氧掉到 87%', flag:'sig', preferBy:'張醫師', lockBy:true, fmt:'oral',
  why:'大量傷患時的口頭醫囑只說了「給 10」。10 mg 還是 10 支？本站 Morphine 一支 10 mg/1 mL——'
    +'「10 支」就是 100 mg，十倍。口頭醫囑複誦時，藥名、劑量、單位、途徑要一起唸回去。',
  alt:'複誦確認為「Morphine 10 mg IV」後再調劑，記錄於口頭醫囑紀錄單，並請開立者 24 小時內補簽。'},

 {kind:'rx', pid:17, d:'mor', dose:'25 mg IV q4h prn', fx:'呼吸只剩每分鐘 8 次，叫不太醒', flag:'dose', preferBy:'蘇護理師', lockBy:true,
  orig:'2.5 mg IV q4h prn', origBy:'張醫師',
  why:'原始醫囑是 2.5 mg，轉抄成 25 mg——小數點不見了，劑量變成十倍。'
    +'一支 10 mg 的 Morphine，這張會讓你拿兩支半。',
  alt:'依原始醫囑更正為 2.5 mg，請轉抄者與開立者確認後再調劑。'},

 {kind:'rx', pid:14, d:'amlo', dose:'5 mg PO qd ×28 天份', flag:'stock', preferBy:'何醫師', lockBy:true, fmt:'chronic',
  refillN:1, refillOf:3,
  why:'慢性病連續處方一次開了 28 天份。附件六的口服帶藥以 3 天規劃，就算放寬到一週也遠不到 28 天——'
    +'全站 Amlodipine 七日儲備才 250 顆，給他一個人 28 顆，是把好幾個斷藥的人的份量給了一個人。',
  alt:'建議先給 3 天份，登記於慢性病缺藥清單，待補給到站後再續調劑。'},

 {kind:'rx', pid:12, d:'mor', dose:'MS 10 mg IV q4h prn', fx:'呼吸變慢，叫兩次才睜眼', enName:'MS', flag:'sig', preferBy:'NGO 醫師', lockBy:true,
  why:'他寫的是「MS」。MS 可以是 Morphine Sulfate，也可以被讀成 Magnesium Sulfate——'
    +'國際上明列「不要使用」的縮寫，而本站兩種都有。',
  alt:'請開立者寫出完整藥名「Morphine sulfate 10 mg IV q4h prn」並註明最大日劑量。'},

 {kind:'rx', pid:17, d:'acet', dose:'Paracetamol 1 g PO q4h prn', fx:'噁心，右上腹悶痛', enName:'Paracetamol 500 mg', flag:'dose', preferBy:'NGO 醫師', lockBy:true,
  why:'Paracetamol 就是 Acetaminophen。單次 1 g 沒問題，但 q4h prn 一天最多可以給到 6 次——6 g，'
    +'超過成人每日上限 4 g。用法沒有寫最大日劑量。',
  alt:'建議改為 1 g PO q6h prn，每日最多 4 g（肝病、營養不良或長期飲酒者更低）。'},
];
