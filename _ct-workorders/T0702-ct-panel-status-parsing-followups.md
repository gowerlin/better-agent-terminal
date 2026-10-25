---
schema_version: 1
schema_kind: workorder
id: T0702
title: "指揮塔工單狀態解析後續（T0701）：讀引用區塊形式的狀態、加入 PAUSED、TODO 當 PENDING 別名（D185）"
type: fix
status: PENDING
repo: better-agent-terminal
project: "Control Tower 面板"
priority: P2
sizing: S
created_at: "2026-10-25T19:49:22+0800"
started_at: ""
updated_at: "2026-10-25T19:49:22+0800"
completed_at: ""
depends_on: [T0701]
related:
  - "T0701 回報區「後續建議」1、2；D185；`docs/agent-guide/ct-tower-overview.md`（T0701 的分類表）"
  - "CT 狀態定義（只讀）：`<使用者資料夾>\\.claude\\skills\\control-tower\\references\\work-order-system.md`、`interrupt-protocol.md`（`PAUSED`）、`work-order-template.md`（`status: PENDING`）"
affects_files:
  - src/types/control-tower.ts
  - src/lib/ct-tower-overview.ts
  - "src/components/ControlTowerPanel.tsx（只在狀態徽章 / 計數 / 按鈕需要對應新狀態時）"
  - "src/components/**（同上，顯示狀態的元件）"
  - "src/types/__tests__/**、src/lib/__tests__/ct-tower-overview.test.ts、src/components/__tests__/**（測試）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（新狀態的顯示文字）"
  - "src/styles/control-tower.css（只在需要新徽章顏色時）"
  - docs/agent-guide/ct-tower-overview.md
  - "CLAUDE.md（只在「指揮塔總覽（T0701，D184）」節需要改一句時）"
  - _ct-workorders/T0702-ct-panel-status-parsing-followups.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 唯讀：只改 BAT 的解析與顯示，不得修改任何工單檔（BAT 或 BMad-Guide 的 `_ct-workorders/`）來配合解析；BMad-Guide repo 只讀。"
  - "🔴 Worker 不 push。非隔離工單，目前沒有其他 Worker。`Claude outputs/` 未追蹤資料夾不是你的，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。回報寫路徑時家目錄寫 `<使用者資料夾>`、截圖路徑寫 `<scratchpad>/…`（D176 / L175）。"
  - "🔴 renderer 日誌用 `window.electronAPI.debug.log`（CLAUDE.md「Logging」）。改共用型別 / parser 時追蹤所有 consumer（No Regressions Policy）。"
  - "🔴 yolo Worker：不得問使用者；範圍內的細節自己決定並在回報說明；真正需要決定的事依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0702 — 指揮塔工單狀態解析後續

## 目標

T0701 修正了總覽與計數，Worker 留下兩個解析缺口，本單補上，之後與 T0701 一起發 `v0.7.1-pre.7`（D185）。

## 要做的事

1. **引用區塊形式的狀態**：legacy parser（沒有 frontmatter 的工單）目前讀不到寫在 Markdown 引用區塊裡的狀態，例如 BMad-Guide `T0098` 的 `> 狀態:✅ DONE`。補上這種格式：允許行首 `>`、全形 / 半形冒號、狀態前的 emoji 或符號。先唯讀盤點 BMad-Guide 與 BAT `_ct-workorders/` 熱區裡沒有 frontmatter 的檔案實際用了哪些狀態寫法，只補實際出現的格式，回報列出盤點結果。🔴 不得因此讓報告檔（真的沒有狀態的檔）被誤判出狀態。
2. **`PAUSED`**：CT 的中斷協定會把工單改成 `PAUSED`（`interrupt-protocol.md`）。加入 BAT 狀態列舉，分類為「進行中」（open，列在總覽、不算 done），給顯示文字與徽章；計數歸在哪一格由你決定並說明（建議不算 pending）。
3. **`TODO` 當 `PENDING` 的別名**：frontmatter `status: TODO` 視同 `PENDING`（顯示、計數、可執行按鈕都和 PENDING 一樣），不再標 ⚠️ Invalid。CT 範本是 `PENDING`，塔台之後開單一律用 `PENDING`；別名只為了相容已經寫成 `TODO` 的舊單。
4. 同步更新 `docs/agent-guide/ct-tower-overview.md` 的分類表；`CLAUDE.md` 該節若有受影響的句子才改。

## 驗證

- 單元測試涵蓋：引用區塊狀態（含 emoji、全形冒號）、報告檔仍是 `UNKNOWN`、`PAUSED`、`TODO` → PENDING
- `npm run test:unit` 全過；`npm run typecheck` = 0；`npx vite build` 成功
- 唯讀實測：BMad-Guide 與 BAT `_ct-workorders/` 的計數修正前後數字（`T0098` 應變成 done）；方法自選（單元測試以真實檔案內容快照，或隔離實例畫面），不跑 Playwright e2e 套件

## 驗收

- 三項都完成，計數前後數字附在回報
- 測試、typecheck、build 全過；docs 已更新
- commit（不 push），回報區附 SHA

## 回報區

（Worker 填寫）
