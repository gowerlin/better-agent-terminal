---
schema_version: 1
schema_kind: workorder
id: T0687
title: "BAT MCP 權限政策（PLAN-054 B4）：日後若新增寫入型 tool，不得開放給 workflow 子 agent（只寫文件）"
type: docs
status: TODO
repo: better-agent-terminal
project: PLAN-054
priority: P3
sizing: XS
created_at: "2026-10-21T22:00:10+0800"
depends_on: []
related:
  - "PLAN-054 B4（使用者 2026-10-20 決定併入下一次發版批次）；D179（v0.7.1-pre.5 發版前的小批：T0687／T0688／T0689）"
  - "EXP-WFMINE-001 / T0673（BAT 的 Workflow 試點）"
  - "既有唯讀規則：CLAUDE.md「BAT MCP shim」節、「Worker 問塔台」節的 🔴「BAT MCP 維持全唯讀」（D155 / D156）；`scripts/__tests__/bat-mcp.test.mjs` 斷言所有 tool `readOnlyHint: true`"
affects_files:
  - docs/agent-guide/bat-mcp-shim.md
  - CLAUDE.md
  - _ct-workorders/T0687-bat-mcp-write-tool-policy-doc.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只寫文件，不改程式、不改測試。政策原文（PLAN-054 B4，使用者決定，不得改意思）：「日後若新增寫入型 tool，不得開放給 workflow 子 agent」。"
  - "🔴 `docs/agent-guide/bat-mcp-shim.md`：加一小段（或一條）權限政策：① 目前 8 個 tool 全部唯讀（`readOnlyHint: true`），問答寫入只走 helper（D155 / D156，既有規則不改）；② 政策原文；③ 一兩句理由（workflow 子 agent 平行執行、使用者沒有逐一確認，寫入動作的副作用會被放大）；④ 日後真要新增寫入型 tool 時須另開工單並經塔台決策，設計時說明 workflow 子 agent 如何拿不到這個 tool。位置放在 tool 說明附近，文字精簡。若要寫「子 agent 會繼承主 session 的 MCP tool」之類的技術說明，必須有出處（Claude Code 官方文件）或標【推論】；不確定就不寫機制，只寫規則。"
  - "🔴 CLAUDE.md「BAT MCP shim」節加一條 🔴 規則（一行，含 PLAN-054 B4），遵守 CLAUDE.md 開頭的撰寫規則（必守規則在本檔與 docs 檔各留一份；`##` 標題不改名）。"
  - "🔴 CLAUDE.md 與同批 T0689 重疊（T0689 改「Packaging / Release 前置檢查」節）。commit 前先跑 `git diff -- CLAUDE.md`：只能有本單的 hunk。若出現別的 hunk，不要 commit CLAUDE.md，用 BAT 通道問塔台。"
  - "🔴 Git：`git commit --only <檔案>`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台。"
---

# T0687 — BAT MCP 權限政策（PLAN-054 B4）

## 目標

PLAN-054 B4：在 BAT MCP 文件寫一條政策「日後若新增寫入型 tool，不得開放給 workflow 子 agent」。目前 8 個 tool 全部唯讀，本單只寫文件、不改程式。這條政策併入 `v0.7.1-pre.5` 發版批次（D179）。

## 要做的事

1. `docs/agent-guide/bat-mcp-shim.md` 加權限政策（見 `memory_overrides` 第 2 條）。
2. CLAUDE.md「BAT MCP shim」節加一條 🔴 規則。
3. commit 前確認 CLAUDE.md 只含本單的修改（與 T0689 重疊）。

## 驗收

- 兩個檔案都有這條政策，原文意思不變；docs 有理由與「新增時須另開工單、塔台決策」。
- 沒有改程式或測試；只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 修改內容

### 驗證結果

### Commit

### 遭遇問題

### 互動紀錄

### 回報時間
