---
schema_version: 1
schema_kind: workorder
id: T0830
title: "PLAN-043：WSL keep-alive 每個 profile 可關閉（預設開）＋設定精靈每一步可中止"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: "2026-11-04T09:21:08+0800"
updated_at: "2026-11-04T09:27:09+0800"
completed_at: ""
session_ids: []
depends_on: [T0829]
related:
  - "PLAN-043 範圍 3；D271；T0384（keep-alive holder；per-profile 開關或 lazy 的候選）；T0381（runner 層 step abort 的候選）；T0552 / T0554（精靈升級 rollback）"
affects_files:
  - _ct-workorders/T0830-wsl-keepalive-toggle-and-step-abort.md
  - electron/wsl-keepalive.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/profile-manager.ts
  - src/types/electron.d.ts
  - src/components/profiles/details/WslDetails.tsx
  - src/components/setup-wizard/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/components/profiles/__tests__/
  - docs/wsl-deployment.md
  - docs/agent-guide/multi-remote-profiles.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 keep-alive 預設維持現行行為（開）；既有 profile 沒有新欄位 = 開。不做 lazy 模式（D271 選 per-profile 開關）。"
  - "🔴 profile index 寫入照 CLAUDE.md「多 remote profile 同時連線」：`profiles/index.json` 讀改寫一律經 `withIndexLock()`，鎖內不得呼叫 `ProfileManager` 公開方法。"
  - "🔴 精靈 step abort：中止後必須走既有 rollback / 清理路徑，不得留下半裝狀態；SSH / Docker 精靈若共用 runner，行為變化要逐一確認不回歸（現有取消行為若已涵蓋某些步驟，回報寫明）。Dialog 規則照 CLAUDE.md（ModalOverlay、Esc）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0830 — keep-alive 開關＋精靈 step abort（PLAN-043）

## 元資料

- **工單編號**：T0830
- **類型**：implementation
- **狀態**：IN_PROGRESS
- **建立時間**：2026-11-04 08:52 (UTC+8)
- **依賴**：T0829（同改 `electron/wsl-keepalive.ts` / `main.ts`）
- **預估規模**：M；Context Window 風險：中
- **降級策略**：A、B 各自獨立；只完成一項時回 PARTIAL 並寫明

## 任務指令

### 前置條件
- `electron/wsl-keepalive.ts`、`electron/main.ts` `syncWslKeepAlive`、`electron/profile-manager.ts`
- `src/components/profiles/details/WslDetails.tsx`、`src/components/setup-wizard/`（`wizard-runner.ts`、`wsl-flow.ts`、`ssh-flow.ts`、`docker-flow.ts`、`steps/`）
- `_ct-workorders/_archive/workorders/T0384-wsl-keepalive-holder.md`、`T0381` 回報區（runner step abort 的候選說明）
- `CLAUDE.md`「多 remote profile 同時連線（PLAN-039）」節

### 任務

**A. keep-alive 每個 WSL profile 可關閉**
- WSL profile 新增設定「保持 WSL 執行（keep-alive）」，預設開；關閉後該 profile 對應的 distro 不由 BAT 持有 `wsl.exe`（若多個 profile 指向同一 distro，任一開著就保持，規則寫進 docs）。
- UI：`WslDetails`（或 profile 編輯處）一個開關＋一句說明（關閉後 WSL 閒置時可能自動關機，下次連線較慢）。
- 變更立即生效（`syncWslKeepAlive`）。

**B. 精靈每一步可中止**
- 先盤點現況：精靈「取消」目前在步驟執行中按下會怎樣（等步驟跑完？子程序是否被終止？rollback 是否執行？）。
- 實作：執行中的步驟可被中止（`AbortSignal` 傳到步驟，子程序 `execFile` / `spawn` 收到後終止），中止後跑該步與先前步驟既有的 rollback；UI 顯示「正在中止…」→ 完成。逾時或中止失敗時的處置寫清楚。
- 範圍：WSL 精靈必做；SSH / Docker 共用 runner 時一併受惠，但要確認不回歸。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] A：既有 profile（無新欄位）keep-alive 照舊的測試；關閉後不持有的測試
- [ ] B：中止執行中步驟會終止子程序並 rollback 的測試（mock runner）；既有精靈 e2e / mock 測試（如 `tests/wsl-wizard-e2e.test.ts`，若 `test:legacy` 涵蓋）通過
- [ ] docs 同步、`CHANGELOG.md` `[Unreleased]`；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：B 項「子程序收到中止後終止」需改 `electron/wsl-detect.ts` / `electron/wsl-systemd.ts`（不在 affects_files），要擴大範圍嗎？
- **提問時間**：2026-11-04 09:27 (UTC+8)
- **背景**：精靈步驟在 renderer 跑，子程序都在主行程。WSL 精靈的長步驟：`wsl:install-bundle`（`wsl-detect.ts` `installBundle`，execFile timeout 300 s）、`wsl-systemd:start-service`（`wsl-systemd.ts` 輪詢，約 10 s＋每次 probe 15 s）、server bundle 下載（`server-bundle-distributor.ts` 已支援 `signal`，只缺 main.ts handler 接線，在範圍內）、fetch-fingerprint（5 s）。兩個 `execFileBuffered` 目前沒有 `signal` 參數。
- **選項**：
  - A. 擴大 affects_files 加入 `electron/wsl-detect.ts`、`electron/wsl-systemd.ts`：`execFileBuffered` 加選用 `signal`（不給 = 行為完全不變），`installBundle` / `startService` 加選用 `{ signal }`；main.ts 以 operation id 登錄 AbortController，新 IPC `wizard:abort-operation` 中止；下載也接上。
  - B. 不擴大：只做範圍內的部分（runner 層 abort＋輸入步驟中止＋下載中止）；install-bundle / start-service 的子程序照舊等各自 timeout 結束，runner 等該步結束（上限見下）再 rollback，回報寫為已知限制。
  - 其他。
- **建議**：A。理由：工單明寫「子程序收到後終止」，最長的就是 install-bundle（300 s）；只多一個選用參數，未帶時行為不變，既有測試守得住。SSH / Docker 精靈的主行程模組（ssh 安裝、docker-lifecycle）不改，只受惠於 runner 層 abort。
- **影響**：A 多改 2 個檔＋其測試；B 的中止在 install-bundle 期間最久要等到 300 s timeout 才能 rollback（runner 等步驟結束才 rollback，避免 rollback 與還在解壓的 tar 競爭）。
- **是否阻擋後續步驟**：只阻擋 B 項主行程的 wsl-detect / wsl-systemd 部分；A 項已完成，runner 層 abort 兩案都要做。

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
