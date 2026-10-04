---
schema_version: 1
schema_kind: workorder
id: T0383
title: "BUG-089 修復：WSL 網路模式改用 `wslinfo --networking-mode` 判定 + declared/actual 比對 + 警告 i18n"
type: implementation
status: TODO
priority: P1
sizing: S
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:18:57+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: [T0382]
related:
  - "BUG-089（修復對象）"
  - "T0380 回報區 目標 4"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - electron/wsl-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/locales/
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
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

# T0383 — WSL 網路模式判定修正

## 背景

`detectNetworkMode()`（`electron/wsl-detect.ts:220-239`）以 `ip route show default` 含 ` via ` 判 NAT；Mirrored 鏡像主機路由表，default route 一定帶閘道 ⇒ 永遠誤判。T0380 實測 `wslinfo --networking-mode` → `mirrored`。

## 決策（D128）

1. 改用 `wsl -d <distro> -- wslinfo --networking-mode`（argv 固定，distro 過白名單），解析 `nat` / `mirrored` / 其他值（`none`、`virtioproxy` 等）；指令不存在（WSL < 2.0.4）或失敗回 `'unknown'`。**移除 route 啟發式**
2. 主機端讀 `%USERPROFILE%/.wslconfig` `[wsl2] networkingMode`（鍵與值不分大小寫，**只讀**）作為 `declared`，回傳 `{ actual, declared }`（型別變更須同步 preload / `electron.d.ts` / 所有呼叫端）
3. 警告文案（走 i18n；`install-server-bundle.ts:302`、`connect-test.ts:369` 目前寫死英文）：
   - `actual=nat`：說明 NAT 下 `localhost` 經 localhostForwarding 仍可連，**不要**要求使用者必須改 Mirrored；connect-test 失敗時才提示可改 Mirrored 或用 distro IP
   - `declared=mirrored, actual=nat`：提示「已設定 Mirrored 但尚未生效，需執行 `wsl --shutdown`（會關閉所有發行版）」或 Windows 版本不支援（Win11 22H2+）；能區分就區分，不能就兩者都說
   - `actual=mirrored`：不顯示警告
   - `unknown`：不顯示或顯示中性說明（Worker 決定，寫回報區）
4. 順手查 BUG-089 附帶 UX：右側面板「目前步驟...」佔位字。若是單純 i18n key / 佔位字問題且改動 ≤ 10 行，一併修（`affects_files` 外的檔案須在回報區列出）；否則寫回報區留給 Phase 2
5. 不在本單：自動改 `.wslconfig`（Phase 2）

## 驗收

- unit：`wslinfo` 輸出解析（UTF-16 / 換行 / 未知值 / 指令不存在）；`.wslconfig` 解析（大小寫、缺檔、無 `[wsl2]`、註解）；警告選擇的 declared/actual 組合
- `npm run test:unit` 全綠（基線 **794**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：對 `Ubuntu-24.04` 呼叫新 `detectNetworkMode` → `{ actual: 'mirrored', declared: 'mirrored' }`（會啟動發行版，唯讀即可）

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 4）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
