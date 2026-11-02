---
schema_version: 1
schema_kind: workorder
id: T0789
title: "研究：終端回覆 claude 的 `OSC 7501 ; ?` 探詢後，claude 會送哪些狀態序列、時機與副作用（PLAN-061 前置）"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T18:24:49+0800"
started_at: ""
updated_at: "2026-11-02T18:24:49+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "T0787 回報區〈Q2〉（claude 內嵌 `2.1.316` 有 OSC 7501 編碼器：常數 `PROGRAM_STATUS:7501`、`app=claude-code`、`kind=` / `progress=` / base64 `title=` / `msg=`；啟動送 `OSC 7501 ; ?`，收到以 `?` 開頭的回覆才送；字串 `probe: OSC 7501 reply` / `probe: no reply to OSC 7501 ; ?`；`CLAUDE_CODE_DISABLE_TERMINAL_TITLE` 或背景 worker 關閉）〈Q3〉（herdr-core `crates/herdr-core/src/status.rs`：6 個 state、kind、progress、id、`:` 分隔；探詢回覆格式官方未寫）〈建議下一步 ④ (2)〉"
  - "PLAN-061（PLAN-059 子項 B：OSC 7501 白名單）；PLAN-059；D227"
  - "`src/lib/codex-terminal-state.ts`（現行解析器：`CODEX_OSC_PAYLOAD_MAX = 128`、丟掉 `app≠codex`）；`electron/terminal-blocked-state.ts`（hook reason 判斷）；CLAUDE.md「blocked 狀態偵測」節"
affects_files:
  - _ct-workorders/T0789-research-claude-osc7501-probe-reply.md
  - _ct-workorders/PLAN-061-osc7501-allowlist.md
  - e2e/t0789-claude-osc7501-probe.spec.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 只研究：不改產品程式碼（`electron/**`、`src/**`、`scripts/**`）、不改 `package*.json`、不在 repo 跑 `npx vite build`（與 T0788 並行，T0788 會改程式並 build）。唯一可新增的 repo 檔是探針 `e2e/t0789-claude-osc7501-probe.spec.ts`（可 commit）；其他暫存放 Worker scratchpad 或系統暫存目錄的 `ct-T0789/`，收尾刪除。"
  - "🔴 實測方式：不需要 BAT。用 node-pty（repo 已有 `@lydell/node-pty`）或等效方式直接 spawn 內嵌 claude（`node_modules/@anthropic-ai/claude-code/bin/claude.exe`，記版本），由測試程式扮演終端：收到 `OSC 7501 ; ?` 時回覆、擷取之後所有輸出；模型一律用 `e2e/fixtures/fake-anthropic-api.ts`（或同等假 API＋阻擋真實 API 連線），**真實模型花費 0**；HOME / `CLAUDE_CONFIG_DIR` 指到暫存目錄，不碰使用者的 claude 設定與 BAT。需要時可另用安裝版 BAT（`BAT_E2E_EXECUTABLE`，`0.7.3-pre.7`）做對照，但不得用 repo 的 build 產物。"
  - "🔴 要回答：① 回覆格式：claude 接受什麼回覆（從二進位字串 / 解析程式碼反推並實測；不回覆、回錯格式、逾時的對照）。② 回覆後 claude 送出的序列：idle / working / blocked（權限對話框、AskUserQuestion、其他 elicitation 若可觸發）/ done / error / clear 的實際內容與時機（相對於 BAT hook 事件 `PermissionRequest` / `Stop` 等的先後，可在同一實驗記 hook 觸發時間），`kind` 的值、`progress`、`id`、`title` / `msg` 解碼內容與長度分布（最長多少字元，對照解析器 128 上限）。③ 副作用：回覆與不回覆的輸出差異（標題寫入、畫面、其他 OSC / DCS）、對 claude 行為的影響；`CLAUDE_CODE_DISABLE_TERMINAL_TITLE`、`disableAllHooks` 下是否仍送（後者是 BAT `blockedDetection: none` 的情境，正是 B 的價值所在）。④ 在 xterm.js 內回覆的可行點（只描述做法與風險，不實作）：xterm 的 OSC handler 能否攔截並經 `onData` / PTY 回寫、BAT 重開 replay 時會不會重複回覆、遠端 headless 怎麼辦。⑤ 結論：PLAN-061 要不要把 `claude-code` 放進白名單、解析長度上限改成多少、與 hook 判斷的優先序建議、claude 升版時的檢查方式。每項附證據；查不到寫「未確認」，不得寫成肯定句。"
  - "🔴 產出（寫在回報區）：序列實錄表（情境 / 原始序列（title / msg 只放解碼後長度與前 20 字）/ 時間 / 對應 hook）、回覆格式結論、副作用表、xterm 端做法與風險、給 PLAN-061 的建議（含工單草案：affects_files、必守規則、驗收）。PLAN-061 文末補〈T0789 結論摘要〉（只摘要、指向本單），狀態維持 IDEA。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單、PLAN-061 與探針；同一 checkout 有 T0788 並行，不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）。"
---

# T0789 — 研究：回覆 claude 的 OSC 7501 探詢

## 元資料

- **工單編號**：T0789
- **類型**：research
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T18:24:49+0800
- **預估規模**：M

## 研究目標

PLAN-059 子項 B（PLAN-061）要讓不只 codex 的程式也能回報分頁狀態。T0787 查到，目前主動送 OSC 7501 的只有 codex。claude 有完整的編碼器，但只有終端回覆它的 `OSC 7501 ; ?` 探詢時才會送，而 BAT 從來不回覆。如果 BAT 回覆，就多了一條不靠 hooks 的 blocked 來源，可以補上使用者關掉 hooks 的分頁（`blockedDetection: none`）。本單要實測：回覆格式是什麼、claude 回覆後送哪些序列、什麼時機送、有什麼副作用，作為 PLAN-061 定範圍的依據。

## 已知資訊

見 frontmatter `related` 第 1 條（T0787 Q2 / Q3 的查證結果）。

## 調查範圍

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者，判讀問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 方法論狀態回寫

### 回報時間
