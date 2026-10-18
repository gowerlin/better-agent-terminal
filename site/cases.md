---
title: 實戰案例
description: 現實比計劃更混亂的時候，塔台與 Worker 怎麼接住：三個 demo-shop 情境，加上 BAT 自己的三段開發紀錄。
---

# 實戰案例

首頁講的是一個順利的早上。這一頁講其他的早上：現實比計劃更混亂的時候，塔台和 Worker 怎麼接住。 {.ct-intro}

前三個情境用的是虛構專案 demo-shop；後三個是 BAT 自己的開發紀錄。

## 情境案例 {#scenarios}

三個常見的混亂時刻：「以前」是你過去的做法，「BAT + CT」是交給塔台之後。 {.ct-lead}

<CaseCard id="merge-layers" title="合併之後，問題一層一層冒出來" tag="合併後除錯" facet="ct" :roles="[['CT', '先盤點、分層開單、換一層就另開一張'], ['BAT', '每張新工單一個新分頁']]">
<template #before>同事合併了一個大分支，<code>demo-shop</code> 的結帳 API 就壞了。你修好一個設定，服務起來後又冒出別的錯，接著建置流程也失敗。你開了三個對話各追一段，沒有一個看得到全貌。</template>
<template #after>第一張工單只做一件事：跑過結帳流程，列出所有壞掉的地方。塔台把結果分成設定、相依套件、程式邏輯和環境四類，每類各開一張工單。修好一層又冒出新問題時，Worker 先回報部分完成，由塔台另開一張乾淨的工單；本機能驗證的先做完，需要遠端環境的另外開單。</template>
<template #result>四張工單依序收單，你一直知道還剩下什麼沒解決。</template>
</CaseCard>

<CaseCard id="shared-field" title="兩個服務，同一個欄位" tag="跨服務改欄位" facet="ct" :roles="[['CT', '先寫契約、兩邊各自實作、最後比對']]">
<template #before><code>demo-shop</code> 的訂單服務會發出「訂單成立」事件，由通知服務接收。你要把事件裡的 <code>createdAt</code> 改名為 <code>placedAt</code>，先讓 Agent 改好訂單服務，再叫它「照著改」通知服務。上線後才發現，一邊的欄位叫 <code>placedAt</code>，另一邊卻變成 <code>placedTimestamp</code>。</template>
<template #after>第一張工單先寫一份事件契約：欄位名稱、型別和格式必須一致，處理邏輯和錯誤處理可以各自不同。兩個服務各自照契約實作，最後一張工單確認兩邊都已清掉舊名稱，新欄位的型別也一致。</template>
<template #result>兩邊對照的是同一份契約，不是彼此的程式碼。</template>
</CaseCard>

<CaseCard id="urgent-fix" title="規劃到一半，正式站出事" tag="緊急插隊" facet="both" :roles="[['CT', '暫停、優先工單、接回原本的規劃'], ['BAT', '已派出的分頁照常執行']]">
<template #before>你正和 Agent 討論 <code>demo-shop</code> 折扣碼的做法，正式站的付款 API 卻開始回 500 錯誤。你不敢打斷它，怕剛理清楚的計劃找不回來；可是付款不能等。</template>
<template #after>你直接告訴塔台發生了什麼事。塔台把手上的規劃標成暫停，替付款問題開一張優先工單派出去；已經在執行的 Worker 分頁照常做事。修好之後，塔台從暫停的地方接回折扣碼的規劃。進度存在檔案裡，不是只存在對話裡。</template>
<template #result>緊急事件和原本的計劃各自有紀錄，沒有一件被忘掉。</template>
</CaseCard>

## BAT 自己就是這樣開發的 {#bat-itself}

BAT 從 2026 年 4 月起，每個功能都由塔台開單、Worker 實作。下面三段是這個過程裡真實發生的事。 {.ct-lead}

<CaseCard id="contract" title="BAT 定介面契約，Control Tower 依契約撰寫" tag="兩個專案一起演進" facet="both" :roles="[['BAT', '定介面契約、記下需要的版本'], ['CT', '照契約更新流程']]">

BAT 和 Control Tower 是兩個專案，由兩個塔台各自開發，卻要一起運作。兩邊的做法和[兩個服務，同一個欄位](#shared-field)一樣：每次要加整合功能（例如 Worker 問塔台），BAT 先把介面定成契約，包括參數、結束代碼、環境變數和回傳欄位，寫成一張委派單交給 Control Tower。Control Tower 照契約更新流程，只看結束代碼判斷成敗。

新功能要兩邊的版本都到位才啟用；任一邊較舊時，其餘流程照舊。截至 2026 年 10 月，這樣的交接約有 20 次，[版本對照表](./compatibility)列了 11 項整合功能各自需要的版本。

<template #figure><ContractFlow /></template>
</CaseCard>

<CaseCard id="one-sentence-rule" title="一句話變成塔台的原則" tag="從一句話到規則" facet="ct" :roles="[['CT', '把觀察升級成規則，之後每次都照做']]">

BAT 每次發預覽版，自動產生的版本說明都只有一行。有一次塔台漏寫了給使用者看的更版重點，塔台把這件事記成一條觀察；下一版又漏了一次。BAT 的維護者只說了一句「加入塔台原則，每次發布都要加」，塔台就把它升級成正式規則，連格式、內容來源和收尾檢查都寫清楚。

從那以後，每一版的更版重點都在建置完成後立刻補上。塔台怎麼把經驗變成規則，見[越用越懂你的專案](./control-tower#learning)。

</CaseCard>

<CaseCard id="design-language" title="這個網站的設計語言，是從 BAT 的程式碼抽出來的" tag="視覺規範" facet="ct" brief :roles="[['CT', '視覺規範擷取，由 Worker 執行']]">

動工之前，Worker 先用 Control Tower 的視覺規範擷取功能，掃描 BAT 本身的 UI 程式碼，抽出品牌紫、Worker 的 ⚠️、?、✓ 狀態符號和分頁標題格式，每個值都附上出處。所以網站上的示意圖和 App 用的是同一套顏色與符號。

</CaseCard>

想看塔台與 BAT 平常怎麼分工，見[分工與流程](./control-tower)；想看 Control Tower 本身的完整介紹，見[功能導覽](./control-tower-tour)。 {.ct-note .cases-next}
