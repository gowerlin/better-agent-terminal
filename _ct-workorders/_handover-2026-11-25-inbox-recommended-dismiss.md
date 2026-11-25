---
schema_version: 1
schema_kind: cross-tower-handover
from: better-agent-terminal
to: BMad-Guide
status: ACKNOWLEDGED
local_workorder: "T0566"
acknowledged_at: "2026-11-25T20:36:52+0800"
created_at: "2026-11-25T20:28:42+0800"
title: "契約 v2 待辦清單：推薦項欄位、放棄 / 批次放棄的回答格式（BAT PLAN-069）"
---

# HANDOVER — 待辦清單的推薦項與放棄（BAT PLAN-069）

> 發起：BAT 塔台（better-agent-terminal），2026-11-25 20:28 (UTC+8)，D346。
> 修法由 CT 決定；以下是 BAT 的提案與使用者已裁示的需求。BAT 介面部分在雙方同意前不實作。

## 背景

PLAN-068 之後，塔台的提問可以在 BAT 側邊欄「待辦」分頁回答（契約 v2，CT 6.1.0）。使用者提出兩個缺口：

1. **推薦項不見了**：終端互動選單會把推薦項排第一並標「(Recommended)」；`awaiting_user[]`（`memory-protocol.md` § 契約 v2 欄位）沒有推薦欄位，待辦分頁看不出塔台建議哪一項。自由回答欄仍在，不受影響。
2. **沒有放棄**：有時整批不做、原問題已不合時宜、要改變方向，所有選項都不適用。

使用者裁示（2026-11-25）：

| # | 需求 | 裁示 |
|---|---|---|
| R1 | 撰寫慣例：推薦項排第一、說明加「（推薦）」 | 要（BAT 塔台即日起照做） |
| R2 | 契約加推薦欄位，BAT 顯示標記並預設選取 | 要 |
| R3 | 單筆放棄：`U-n` 與 `A-n` 都可以（`A-n` 的「略過」= 不做了，與「失敗」= 做了沒過分開） | 兩區都要 |
| R4 | 批次放棄：可勾選批次，也有每區一鍵全部；可附一欄原因 / 新方向 | 兩者都要 |
| R5 | 放棄後：不套用任何選項、相關工單維持暫停，停下等新方向；有附文字時依文字重新對齊後才動作 | 停下等新方向 |

## 請 CT 決定的事

1. **R1 撰寫慣例**是否寫進 `memory-protocol.md` § 契約 v2 欄位（`options` 那列）與 SKILL.md 的暫停訊息規則。
2. **契約草案 C-1–C-5**（下節）是否同意、要改哪裡；版本閘門用哪個做法（C-5）。
3. CT 端預計的版本與時程。

## BAT 提案：契約草案

- **C-1 `awaiting_user[].recommended`**：選填字串，值是同一筆 `options` 中某一項的代號（不分大小寫比對）。沒有這個鍵、或對不到任何選項 = 沒有推薦（BAT 不報錯、不略過該筆）。CT 仍把推薦項排第一；有這個欄位之後，說明文字裡的「（推薦）」是否保留由 CT 決定（BAT 不會重複加標記以外的文字）。
- **C-2 單筆放棄**：`U-n：放棄[ <原因或新方向>]`、`A-n：略過[ <原因>]`。「放棄」「略過」是保留字，只在冒號後第一個詞時成立；之後的文字是原因或新方向。
- **C-3 批次放棄**：一行列出明確編號，以 `、` 或 `,` 分隔，例 `U-1、U-3、U-4：放棄 <原因>`、`A-2、A-3：略過 <原因>`。每區一行（不混 `U` 與 `A`）。BAT 的「全部放棄」在送出當下展開成畫面上的明確編號，**不送萬用字元**，避免把使用者還沒看到、剛寫入的項目一起放棄；塔台遇到已經不在清單的編號就略過它，其他照做。
- **C-4 塔台收到放棄 / 略過**：從 `awaiting_user` / `user_actions` 移除，記一筆決策（批次只記一筆）；不套用任何選項；相關工單維持暫停（不改 `waiting_user` 以外的狀態）；有原因 / 新方向文字時依文字重新對齊，沒有文字時停下問使用者新方向。
- **C-5 版本閘門**：BAT 只在塔台宣告支援時顯示推薦標記與放棄 / 批次控制項。兩個做法擇一：(a) 升 `--bat-contract 3` 與 `bat_contract: 3`；(b) 維持 2，另加 frontmatter 能力旗標（例 `inbox_features: [recommended, dismiss]`）。BAT 傾向 (a)，理由是現有 `towerContractStatus` 只比對一個整數，閘門單純；但 (a) 會讓舊 BAT 把新 CT 判成「版本不符」而隱藏整個待辦分頁內容，需要 CT 端在舊 BAT 時降回宣告 2——請 CT 評估。

## BAT 端待查（不影響 CT 回覆）

- 舊 BAT（`0.8.0-pre.3`）遇到 `awaiting_user[]` 的未知鍵 `recommended` 是否只略過該鍵（決定 C-1 能否不升版直接寫）。
- `checkInboxAnswer` 目前只收 `^[UA]-\d+[：:]` 開頭、單行 ≤ 1,000 字，C-3 需要放寬。

## CT 回覆草案與 BAT 答覆（2026-11-25 20:33 (UTC+8)）

CT 回覆草案（CT D885，DRAFT，待 CT 使用者核定）：CT repo `_ct-workorders/_reply-2026-11-25-inbox-recommended-dismiss.md`（commit `323323f`）。要點：R1–R5、C-1–C-4 同意；有 `recommended` 仍保留「（推薦）」；「放棄」「略過」兩區互通、接受全形「，」；不支援萬用字元 / 範圍 / 批次選同一選項；`A-n` 略過記「未驗（使用者略過）」不開 BUG；放棄沒附文字 → 不再新增 `awaiting_user`，改在 `todo` 留「暫停中、等新方向」。C-5 建議 (b)：維持契約 2，狀態檔頂層加 `inbox_features: ["recommended", "dismiss"]`，BAT 只在有 `dismiss` 時顯示放棄類控制項，推薦標記只看欄位本身。CT 6.2.0（先出 6.2.0-pre.1 規範供 BAT 對照）。

BAT 答覆：

- **Q1：舊 BAT `0.8.0-pre.3` 兩種未知鍵都忽略。**
  - `awaiting_user[]` 每筆的未知鍵（`recommended`）：`parseTowerInboxLists`（`src/lib/tower-inbox.ts`）只取已知欄位組成項目，未知鍵忽略、該筆照常顯示（檔頭註解第 13–14 行；測試 `src/lib/__tests__/tower-inbox.test.ts`「ignores unknown keys」）。
  - 頂層未知鍵（`inbox_features`）：`parseTowerState`（`src/lib/ct-tower-overview.ts`）只讀已知欄位（測試 `ct-tower-overview.test.ts`「ignores unknown keys」、`ct-tower-overview-bat-contract.test.ts`）。
  - 兩檔與 `inbox-model.ts` 從 `v0.8.0-pre.3` 到目前 `main` 沒有改動（`git diff --stat` 空）。
  - 推論（未實機）：舊 BAT 看到 `recommended` 只是不顯示標記；說明文字的「（推薦）」照原文顯示；收到放棄類回答的路徑不存在（沒有控制項），使用者仍可在自由回答欄手打 `U-n：放棄 …`，`checkInboxAnswer` 單編號格式本來就收。
- **Q2：BAT 版號** = `0.8.0-pre.4`（下一個預覽版，從 `main` 發，D344）。**同意** C-5 (b)、欄位名 `inbox_features` 與兩個值 `recommended` / `dismiss`。BAT 的判斷：`towerContractStatus` 仍為 `match` 才看 `inbox_features`；值未知者忽略；推薦標記只看 `recommended` 欄位本身（不看旗標）。
- CT 補充各點 BAT 都接受；BAT 送出端固定用 `、` 分隔、每區一行。

## CT 受理（2026-11-25 20:36 (UTC+8)）

CT 使用者核定（CT D886），回覆稿 `status: ACCEPTED`、`local_workorder: T0566`（CT repo 的工單）。CT 計畫 PLAN-020（CT 6.2.0）：P1 T0566 = 6.2.0-pre.1 規範＋`check-frontmatter.py`＋Guide 預覽專章（只打包）；P2 BAT `0.8.0-pre.4` 實作後雙方實機驗收；P3 與 BAT 同日發 6.2.0。定案：`bat_contract` 維持 2、頂層 `inbox_features: ["recommended", "dismiss"]`、`awaiting_user[].recommended`、放棄 / 略過 / 批次照 CT 回覆〈逐點〉。新功能的 BAT 版號 `0.8.0-pre.4` 只寫在 ct-help 與 Guide，`auto-session.md` 契約 2 最低版號（`0.8.0-pre.3`）不改。CT 在 T0566 收單後傳規範位置（檔:行）與 6.2.0 範例狀態檔路徑，BAT 之後開實作單。

## 補充需求 R6：暫停時可改用 Claude Code 原生選單（2026-11-25 20:45 (UTC+8)，D347）

- **背景**：使用者問 `user_inbox: off` 是否就回到 6.0.x 行為。查證：`user_inbox: off` 只停寫 `awaiting_user` / `user_actions`（`memory-protocol.md` § 契約 v2 欄位 › `user_inbox: off`），終端的提問形式不變。需求對齊的當場提問依 `interactive-prompts` 用原生選單（`AskUserQuestion`，方向鍵 / 滑鼠可選、有推薦項與自由輸入）；但 6.1.0 起塔台的**暫停**（斷點 A / B-1 / B-2 / C / E、合併前確認、Worker 提問升級、`tower-question`）一律是純文字範本「請回覆 U-n：A／B／C」（`yolo-mode.md` 第 286、310、348、384、532、1017、1147 行），沒有開關。部分使用者不習慣打字回答，想回到終端內鍵盤 / 滑鼠點選。
- **使用者裁示**：當作 PLAN-069 的補充需求，併入 CT 6.2.0。
- **BAT 提案（修法由 CT 決定）**：
  - 新增設定鍵（名稱由 CT 定，例 `pause_prompt: native | text`），與 `user_inbox` 獨立（可只關側邊欄、也可只換提問方式）。
  - `native`：暫停時以原生選單提問（推薦項排第一並標推薦、最後一項自由輸入、選項與 `awaiting_user[].options` 同一組代號），**同一次寫入仍照寫 `U-n`**（`user_inbox: on` 時），BAT 待辦分頁同步顯示；使用者在終端選單或 BAT 待辦分頁任一處回答都算數，終端回答後塔台照常移除該筆（BAT 分頁隨之消失）。原生選單上也提供放棄（R3）的出口，例如一個「放棄（停下等新方向）」選項，或以自由輸入「放棄 …」表達。
  - `text`：維持 6.1.x 文字範本。
  - 預設值由 CT 決定；BAT 傾向 `native`（最接近使用者原本習慣，側邊欄照樣保留）。
  - 非 Claude Code（codex 塔台）沒有原生選單 → 一律 `text`。
- **BAT 端影響**：不需要改。原生選單開著時塔台分頁是 `blocked`（`question`），Worker 通知由 BAT 通知保護（T0788 / BUG-196）保留到回答後才送，不會替使用者作答；BAT 待辦分頁送出的 `U-n：…` 也走同一個保留路徑（`enqueueAnswer` 受 prompt reason 擋），等選單關閉後才送進塔台——此時該 `U-n` 若已在終端答過，CT 依既有規則「編號不存在或已結 → 回一行說明」處理。請 CT 確認這個雙處回答的競態可接受。

## 請回覆

回覆稿請寫在 CT repo 的 `_ct-workorders/_reply-2026-11-25-inbox-recommended-dismiss.md`，並以跨 session 訊息通知 `better-agent-terminal · Tower`（或由使用者轉交）。
