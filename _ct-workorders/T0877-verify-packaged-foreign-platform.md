---
schema_version: 1
schema_kind: workorder
id: T0877
title: "verify-packaged-native：安裝包內出現其他平台／架構的平台套件時失敗"
type: implementation
status: PENDING
created_at: "2026-11-17T10:27:04+0800"
started_at: ""
updated_at: "2026-11-17T10:27:04+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
priority: P2
sizing: M
depends_on: [T0876]
related:
  - "D298（T0873〈建議後續〉4、〈環境與驗證方式〉）；T0546（安裝檔瘦身、`duplicate-claude`）；BUG-118"
affects_files:
  - _ct-workorders/T0877-verify-packaged-foreign-platform.md
  - scripts/verify-packaged-native.js
  - scripts/__tests__/**
  - package.json（只限 `build.files`，且只在任務 3 判定要收緊時）
  - docs/agent-guide/packaging-release-checks.md
  - CLAUDE.md（只限〈Packaging / Release 前置檢查〉節的一行說明）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 新檢查不得讓目前正常的安裝包失敗：Windows x64、Linux x64、macOS arm64 的合法內容（各自平台的 `claude-code-<平台>-<架構>`、`node-pty` 的 prebuilds、whisper `dist/<平台>-*` 等）都要放行。規則以「套件名或目錄名帶有平台／架構，且不是目標平台／架構」判定，判定清單集中一處、註明來源。"
  - "🔴 `build.files`：🔴 不得使用 `build.<platform>.files`（CLAUDE.md〈Packaging / Release 前置檢查〉，T0546 實測整個 repo 被打進 asar）；平台差異只能用頂層 `files` 的 `${os}`／`${arch}`。收緊 `build.files` 只在能以 `asar-runtime-deps.test.mjs` 與本機 `build:dir` 證明不漏打必要檔時才做；不確定就只加檢查，收緊列為後續。"
  - "🔴 不得觸發 workflow；Linux／macOS 包只能由塔台之後派 `desktop-build.yml` 驗證，回報區寫明需要驗的項目。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0877 — verify-packaged-native 擋住其他平台的平台套件

## 元資料
- **工單編號**：T0877｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：M｜**依賴**：T0876（同一個 checkout，依序執行）｜**決策**：D298

## 背景
T0873 在 Windows 上為了打 linux server bundle，臨時把 `@lydell/node-pty-linux-x64`、`@anthropic-ai/claude-code-linux-x64` 放進 `node_modules`；之後 `build:dir` 把 linux 版 `claude`（328 MB）打進 Windows 的 `app.asar.unpacked`，而 `verify-packaged-native` 通過了。現有的 `duplicate-claude` 只看 `claude-code-win32-*/claude.exe`（`scripts/verify-packaged-native.js` 約 L560）。CI 的乾淨 runner 通常不會裝到別平台的套件，但開發機打包、或 npm 日後改變 optional 依賴的安裝行為時，就會靜默變大。

## 任務
1. 盤點安裝包內所有「帶平台／架構」的套件與目錄（從 `build.files`、`asarUnpack`、lock 中 `os`／`cpu` 欄位的套件找），整理成判定清單。
2. 在 `verify-packaged-native.js` 加檢查（例：`foreign-platform-package`）：目標平台／架構以外的平台套件出現就失敗，錯誤訊息指出可能原因（開發機殘留的別平台 optional 依賴）。比照既有檢查的結構與輸出格式。
3. 評估 `build.files` 是否該同時以 `${os}`／`${arch}` 排除別平台的平台套件（見 memory_overrides）；做或不做都寫理由。
4. 單元測試：以假的檔案清單測三個平台的合法內容通過、混入別平台套件失敗（放 vitest 收得到的位置，D177）。
5. 更新 docs `packaging-release-checks.md` 的檢查項目表；CLAUDE.md 只在〈Packaging / Release 前置檢查〉補必要的一句（若 docs 已足夠可不改）。

## 關卡
- `npm run test:unit`、`npm run test:legacy`（與前一張比較）
- `npx vite build` ＋ `npm run build:dir` ＋ `verify-packaged-native --platform win --arch x64`：乾淨的 `node_modules` → 通過
- 重現 T0873 的污染（暫時放入 linux 平台套件後 `build:dir`）→ 新檢查失敗；驗證完刪除那些套件、重新 `build:dir` 確認恢復通過（暫放的套件不得留在 `node_modules`，也不得進 lock）
- 若改了 `build.files`：`asar-runtime-deps.test.mjs` 通過

## 驗收條件
- [ ] 判定清單（套件／目錄、平台、來源）
- [ ] 新檢查：乾淨包通過、污染包失敗（附輸出）
- [ ] `build.files` 收緊與否的結論
- [ ] 單元測試涵蓋 win／linux／mac
- [ ] 回報區寫明需要塔台派 `desktop-build.yml` 確認 Linux／macOS 包也通過
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
