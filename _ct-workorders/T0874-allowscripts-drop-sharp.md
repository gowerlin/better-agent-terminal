---
schema_version: 1
schema_kind: workorder
id: T0874
title: "allowScripts 拿掉已無作用的 sharp 項目，並核對其餘項目"
type: implementation
status: PENDING
created_at: "2026-11-17T10:27:04+0800"
started_at: ""
updated_at: "2026-11-17T10:27:04+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
priority: P3
sizing: S
depends_on: [T0873]
related:
  - "D298（T0873〈建議後續〉2）；D297；CLAUDE.md〈本機開發：npm 12 install scripts〉"
affects_files:
  - _ct-workorders/T0874-allowscripts-drop-sharp.md
  - package.json
  - package-lock.json（只在 npm 自動改寫時）
  - CLAUDE.md（只限〈本機開發：npm 12 install scripts〉節）
  - docs/agent-guide/npm12-install-scripts.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 `allowScripts` 是政策：本單只依 D298 拿掉 `sharp`。其他項目（`esbuild`、`@anthropic-ai/claude-code`）只核對、不改；若發現它們也已沒有 install script，或有新套件需要放行，寫在回報區由塔台決定。不得用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts`。`electron-winstaller`、`fsevents` 照舊不列、不寫 `false`。"
  - "🔴 不改任何套件版本。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0874 — allowScripts 拿掉已無作用的 sharp 項目

## 元資料
- **工單編號**：T0874｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：S｜**依賴**：T0873｜**決策**：D298

## 背景
T0873 把 `sharp` 升到 0.35.5，新版沒有 install script（T0873 回報區〈三個 major 的判斷〉）。`package.json` 的 `allowScripts` 目前是 `{"esbuild":true,"sharp":true,"@anthropic-ai/claude-code":true}`。`sharp` 項目已沒有作用；留著的風險是日後 `sharp` 若又加 install script，會在沒有塔台決策的情況下被放行。

## 任務
1. 確認 lock 中的 `sharp`（0.35.5）與 `@img/*` 平台套件都沒有 `install`／`preinstall`／`postinstall`（讀 `package-lock.json` 的 `hasInstallScript` 與套件的 `package.json`）。
2. 從 `allowScripts` 拿掉 `sharp`。
3. 核對 `esbuild`、`@anthropic-ai/claude-code` 仍有 install script（記錄結果，不改）。
4. 更新 CLAUDE.md〈本機開發：npm 12 install scripts〉的放行清單文字，以及 `docs/agent-guide/npm12-install-scripts.md`（放行清單、手動補跑表中 `sharp` 的說明）。CLAUDE.md 只改該節必要的字。

## 驗收條件
- [ ] `npm ci` exit 0；結尾 install-scripts 警告只有 `electron-winstaller`（與 T0873 最終相同）
- [ ] `node scripts/generate-icons.js` 能執行（輸出到暫存位置或執行後確認 `git status` 沒有圖示變更；若腳本會寫回 repo，執行後比對位元組／像素與 T0873 相同，不 commit 圖示）
- [ ] `npm run test:unit` 不比 T0873 最終差（若有讀 `allowScripts` 的守門測試，一併確認）
- [ ] 回報區附 `esbuild`、`@anthropic-ai/claude-code` 的核對結果
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
