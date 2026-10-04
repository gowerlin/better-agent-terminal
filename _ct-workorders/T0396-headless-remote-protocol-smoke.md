---
schema_version: 1
schema_kind: workorder
id: T0396
title: "PLAN-036 P0 自動驗收（協定層）：對已部署的 WSL headless server 跑 PTY 生命週期 smoke 腳本"
type: test
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T01:13:27+08:00"
target_version: next
depends_on:
  - T0390
  - T0391
  - T0395
related:
  - "PLAN-036 §「P0 實機驗收準備（2026-10-05 01:01）」"
  - "T0397（同批平行：Electron UI 層 e2e）"
affects_files:
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - package.json
  - docs/remote-dev-overview.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **WSL `bat-server.service` 不得 restart / stop / 重新部署**，`~/.local/bat-server` 不得寫入（目前跑 `ea52b03`，使用者驗收中）。smoke 只能以 client 身分連線。"
  - "🔴 smoke 只能操作**自己建立的 PTY**（id 一律帶唯一前綴，例如 `smoke-<timestamp>-`），結束時（含失敗路徑，用 `finally`）全部 `pty:kill`；不得列舉 / 關閉 / 寫入任何其他 PTY（使用者的遠端終端可能正連在同一台 server）。"
  - "🔴 **不執行 `npx vite build`**：T0397 同時在跑 Playwright，會從 `dist-electron/` 啟動 app，平行 build 會互相覆寫輸出。本單只動 `.mjs` / `package.json` scripts 一行 / 文件，不影響 vite 輸入；vite build 由塔台複驗時跑。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args（`wsl.exe` 亦同），timeout 必設；distro 名稱過白名單 `/^[A-Za-z0-9._-]+$/`。禁用 shell-spawning exec API。不 push。"
---

# T0396 — headless 遠端協定層 smoke

## 元資料
- **工單編號**：T0396
- **任務名稱**：PLAN-036 P0 自動驗收（協定層）
- **狀態**：PENDING
- **建立時間**：2026-10-05 01:13 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`、`package.json`（只加一行 script）、`docs/remote-dev-overview.md`

## 背景

PLAN-036 P0（T0388-T0391、T0393）已完成，WSL `Ubuntu-24.04` 的 headless server 已部署 HEAD `ea52b03`（`127.0.0.1:9877`，指紋 `22:3A:E4:…`）。使用者問實機驗收能不能自動化，裁決為兩層都做：本單做**協定層**（直接以 client 身分打正在跑的 server，屬 runtime 證據），T0397 做 Electron UI 層。

## 範圍

新增 `scripts/smoke-remote-headless.mjs`（`npm run smoke:remote:headless`），參數至少：
- `--target wsl:<distro>`：從 WSL 唯讀取得連線資訊（埠、`server-token.json`、憑證指紋；位置參考 `electron/remote/headless-entry.ts:142` 的 dataDir 與 `electron/remote/ssh-wizard-verify.ts` 既有的讀法）
- `--url wss://host:port --token-file <path> --fingerprint <sha256>`：直接指定（供日後 SSH / Docker 目標用）
- `--json`：機器可讀輸出；exit code 0 = 全部 PASS

**連線實作限制**：`electron/remote/remote-client.ts` import 了 `electron`（`BrowserWindow`），**不能**直接在 Node 裡重用。請用 `ws` 依 `electron/remote/protocol.ts` 的 frame 格式自行實作最小 client（auth → invoke → 收事件），並對**伺服器憑證做 SHA-256 fingerprint pinning**（不可 `rejectUnauthorized: false` 後不驗指紋）。frame 格式若在 `.mjs` 內重寫，要有測試防止與 `protocol.ts` 漂移（例如測試讀 `protocol.ts` 原始碼比對 frame type 字串 / 欄位名稱，或以 esbuild 轉譯 import）。

## 檢查項目（每項輸出 PASS / FAIL / SKIP + 證據）

| # | 檢查 | 對應 |
|---|------|------|
| S1 | TLS 連線 + 指紋相符 + token auth 成功；指紋錯誤時拒絕連線（負向） | T0182 / T0385 |
| S2 | `settings:get-shell-path`（或 T0390 實際提供的 shell 相關 channel）回傳 Linux shell 路徑 | T0390 / T0393 |
| S3 | `pty:create`（`smoke-` 前綴 id）→ 收到 output 事件；`pty:write` `echo <隨機 marker>` → output 中出現 marker | T0390 |
| S4 | `pty:resize` 到 120x40 → 寫入 `stty size` → output 出現 `40 120` | T0390 |
| S5 | 同 id 再 `pty:create` 一次 → 不新開 shell（冪等；以 `echo $$` 前後 PID 相同判定） | T0390 |
| S6 | 斷開 WS 再重連 + auth → 對同 id `pty:write` 仍收到 output（server 端 PTY 活過斷線） | T0390 / P1 回放前提 |
| S7 | `pty:kill` → 收到 exit 事件；之後對該 id write 不使 server 崩潰（連線仍可用） | T0390 |
| S8 | 一個 P1 未支援的 channel（例如任一 `claude:*`）→ 回傳明確的 unsupported 錯誤，不是逾時 / 斷線 | T0388 `HEADLESS_UNSUPPORTED` |

channel 名稱與參數形狀以 `electron/remote/headless-handlers.ts` / `protocol.ts` 實際定義為準；上表與實作不符時照實作做，並在回報區列出差異。

## 驗收條件

- [ ] unit：參數解析、指紋格式正規化、frame 與 `protocol.ts` 的漂移守門、`--target` distro 白名單
- [ ] **對 `wsl:Ubuntu-24.04` 實跑一次**，S1-S8 結果與原始輸出（或 `--json`）附在回報區；結束後確認 server 上沒有殘留 `smoke-` PTY（可在 S7 後補一次存在性檢查）
- [ ] `npm run test:unit` 全綠（基線 1085）；`npx tsc --noEmit` ≤ 40；**不跑 vite build**（見 memory_overrides）
- [ ] `docs/remote-dev-overview.md` 補一小節用法

## 不在範圍

- 不改任何 `electron/` / `src/` 產品程式碼。smoke 發現產品 bug → 回報區列出，**不要順手修**（塔台會另開 BUG）
- 不碰 Electron UI（T0397）

## Sub-session 執行指示

1. 讀本工單 + `electron/remote/protocol.ts`、`headless-handlers.ts`、`headless-entry.ts`、`remote-client.ts`（只讀，參考 auth / pinning 流程）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 實跑 → 驗收
4. 填回報區；完成寫 **`DONE`**；S 項有 FAIL 但腳本本身正確 → 仍寫 `DONE`，FAIL 列入「遭遇問題」交塔台開 BUG
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### S1-S8 實跑結果

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
