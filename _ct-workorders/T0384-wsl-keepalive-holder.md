---
schema_version: 1
schema_kind: workorder
id: T0384
title: "BUG-092 修復：BAT 對 WSL profile 持有長駐 `wsl.exe` 保活，避免發行版閒置關閉"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:18:57+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: [T0383]
related:
  - "BUG-092（修復對象）"
  - "T0380 回報區 目標 3"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - electron/wsl-keepalive.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / port 等外部輸入先過既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 不得改使用者 `%USERPROFILE%/.wslconfig`、不得 `wsl --shutdown` / `--install` / `--unregister`、不得刪除或重建 `Ubuntu-24.04`。本機 runtime 驗證只做唯讀查詢或暫存檔，驗完清乾淨。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer 端 log 用 `window.electronAPI.debug.log`，main 端用 `logger`（CLAUDE.md Logging）。"
  - "⚠️ PLAN-035 Phase 1 四張單（T0381→T0382→T0383→T0384）**串行**，都會改 `electron/main.ts`；只改本單範圍，不預先做後面單的內容。不 push。"
---

# T0384 — WSL keep-alive holder

## 背景

T0380 證實：沒有 `wsl.exe` 連線時，WSL 約 15 秒（`instanceIdleTimeout` 預設）就關閉發行版，systemd user service + linger 也擋不住（WSL 2.6.1+，WSL#13416）。使用者裁決：**只需 BAT 執行時可用**。

## 決策（D128）

1. 新增 `electron/wsl-keepalive.ts`：對每個需要的 distro 持有一個 `spawn('wsl.exe', ['-d', distro, '--', 'sleep', 'infinity'], { windowsHide: true, stdio: 'ignore' })`（distro 先過既有白名單）；同一 distro 只持有一個
2. 生命週期：
   - app ready 後，若已有 WSL remote profile → 對其 distro 啟動 holder（或延到第一次連線前，Worker 擇一並寫理由；建議 app ready 啟動，避免第一次連線失敗）
   - 新增 / 刪除 WSL profile 時同步啟停
   - holder 意外結束 → backoff 重啟（上限與間隔由 Worker 決定，避免 WSL 不存在時無限重啟刷 log）
   - `before-quit` / `will-quit` 時 kill 全部 holder，不留孤兒 `wsl.exe`
3. 精靈：`write-systemd-unit` 成功後立即對該 distro 啟動 holder（經 IPC），避免第 6、7 步期間發行版被關閉
4. **不改** `.wslconfig` `instanceIdleTimeout`（全機設定，屬 Phase 2 的選用項目）
5. 本單**不做**設定開關 UI；holder 只在有 WSL profile 時啟動，沒有 WSL profile 的使用者零影響。回報區評估記憶體影響並建議 Phase 2 是否加開關
6. Windows 以外平台：no-op

## 驗收

- unit：spawn mock（啟動、同 distro 不重複、profile 刪除時停止、意外結束 backoff、quit 時全部 kill、非 Windows no-op、distro 白名單拒絕）
- `npm run test:unit` 全綠（基線 **853**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：對 `Ubuntu-24.04` 啟動 holder → 等 60 秒以上 `wsl -l -v` 仍 `Running` → 停止 holder → 約 15-20 秒後 `Stopped`；確認無殘留 `wsl.exe` holder 程序
- **runtime 驗收（交使用者）**：安裝版完成 WSL 精靈後閒置 2 分鐘仍可連線

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 3）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
