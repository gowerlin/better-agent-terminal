---
schema_version: 1
schema_kind: workorder
id: T0377
title: "BUG-085 修復：提權 Windows 下 codex-cli 啟動指令注入 -c features.daemon_auto_start=false + 一次性提示"
type: implementation
status: TODO
priority: P2
sizing: M
created_at: "2026-10-04T20:39:03+08:00"
updated_at: "2026-10-04T20:39:03+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: [T0375]
related:
  - "BUG-085（修復對象）"
  - "T0375（研究，方案 B' 與全部證據；實作前必讀其回報區）"
  - "D124（本工單決策）"
affects_files:
  - electron/agent-runtime/agent-registry.ts
  - electron/windows-elevation.ts
  - electron/main.ts
  - src/components/WorkspaceView.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 只注入 `codex-cli` 定義；`codex-agent` / `codex-agent-worktree`（SDK 路徑）**不得**注入（T0375 證實不受影響）。"
  - "🔴 提權偵測用 `execFile` + **System32 絕對路徑** + timeout 5s（CLAUDE.md Child Process Spawning；Git Bash 的 `whoami` 是 `/usr/bin/whoami`）。禁用 shell-spawning exec API。"
  - "🔴 不改 UAC / 登錄檔 / 使用者 `~/.codex/config.toml`；不 push。"
  - "⚠️ 並行工單 T0376 改 `.vscode/scripts/release.ps1` / `scripts/build-version.js`，與本單無檔案重疊；不要碰那些檔。"
---

# T0377 — BUG-085 修復：提權 Windows 的 codex-cli daemon 旗標

## 背景

Codex CLI 0.160 的 Windows daemon 拒絕在提權權杖下啟動，BAT 的 Codex CLI 終端 preset 與以 codex-cli 派發的 Tower Worker 在提權環境（UAC 停用、或以系統管理員執行 BAT）直接 exit 1。**實作前完整讀 T0375 回報區**，所有證據與方案比較都在那裡。

## 決策（D124）：方案 B' + 一次性提示

1. **提權偵測**（新檔 `electron/windows-elevation.ts`）：Windows 以 `execFile('%SystemRoot%\\System32\\whoami.exe', ['/groups'])` 判斷是否含 `S-1-16-12288`（High Mandatory Level）；非 Windows 恆 `false`；偵測失敗 / 逾時 → `false`（不注入，維持現狀）。app ready 時偵測一次並 cache
2. **注入點**：`electron/agent-runtime/agent-registry.ts` `buildLaunchCommand()`，`definitionId === 'codex-cli'` 且 elevated 時插入 `-c features.daemon_auto_start=false`（**不用 `--no-daemon`**：PATH 上舊版 codex 0.133 會 exit 2）。registry 保持同步 API，以 setter（例如 `setElevated(bool)`）注入偵測結果。所有入口都經過此 choke point（renderer `WorkspaceView.tsx` 經 IPC `agent:build-launch-command`、`main.ts` `buildAgentPromptCommand()`）
   - 去重：customArgs 已含 `--no-daemon` 或 `daemon_auto_start` 時不注入
3. **一次性提示**：提權時首次開 Codex CLI 分頁 toast，說明「BAT 以系統管理員權限執行，Codex CLI 已自動停用背景 daemon」+ 手動繞法 `--no-daemon`；i18n 三語。提示每次 app 執行最多一次即可（不需持久化）

## 驗收

- unit（新增）：`buildLaunchCommand('codex-cli')` elevated true / false 的輸出；customArgs 含 `--no-daemon` / `daemon_auto_start` 去重；`codex-agent` 不注入；`whoami /groups` 輸出解析（High / Medium / 空 / 錯誤 → false）。測試檔位置須被 `vite.config.ts` `test.include` 涵蓋
- `npm run test:unit` 全綠（基線 673；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline 40
- 本機 runtime 可選：Worker 本身在提權 shell，可用 node 直接呼叫偵測函式印結果（不需啟動 app）
- **runtime 驗收（交使用者）**：新 build 開 Codex CLI 分頁應進 TUI 而非 exit；UAC 開啟機器的非提權 BAT 不應帶此旗標（本機無法驗）

## 範圍外

- Settings 層 codex runtime 選擇（BUG-083 S3 後排項）
- 「已有非提權 daemon」情境（T0375 標為無法判定，需 UAC 開啟機器）
- 使用者手打 `codex` 的情境（只靠提示文字）

## Sub-session 執行指示

1. 讀取本工單 + `BUG-085` + **T0375 回報區**
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG-085 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
