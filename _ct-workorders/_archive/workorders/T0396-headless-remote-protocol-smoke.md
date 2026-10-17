---
schema_version: 1
schema_kind: workorder
id: T0396
title: "PLAN-036 P0 自動驗收（協定層）：對已部署的 WSL headless server 跑 PTY 生命週期 smoke 腳本"
type: test
status: DONE
started_at: "2026-10-05T01:15:01+08:00"
updated_at: "2026-10-05T01:23:51+08:00"
completed_at: "2026-10-05T01:23:51+08:00"
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
- **狀態**：DONE
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

**DONE** — S1-S8 對 `wsl:Ubuntu-24.04` 實跑 8/8 PASS（兩次），無殘留 smoke PTY；unit / tsc gates 通過。

**Landing check**：PASS — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 PASS（`scripts/`、`package.json`、`docs/remote-dev-overview.md` 皆存在）；C-2 無 `branch` 欄位（HEAD `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）。派發模式 `CT_MODE=on`、`CT_INTERACTIVE=0`。

### 產出摘要

| 檔案 | 內容 |
|------|------|
| `scripts/smoke-remote-headless.mjs`（新增） | 以 `ws` 自實作最小 client（auth → invoke → event）；`upgrade` 時以 `getPeerCertificate().fingerprint256` 做 SHA-256 pinning，**指紋不符或取不到指紋即 fail-close，auth frame（token）在 pin 通過前不送出**（`rejectUnauthorized: false` 僅因自簽憑證，pin 取代 chain 驗證）。`--target wsl:<distro>`（唯讀：`systemctl --user show -p Environment` 取 `BAT_SERVER_PORT` / `BAT_SERVER_DATA_DIR`、`grep -o` 只抽 `server-cert.json` 的 `fingerprint` 欄位〔私鑰不讀〕、`cat server-token.json`）、`--url` + `--token-file` + `--fingerprint`、`--host` / `--port` / `--cwd` / `--timeout-ms` / `--json`。exit 0 = 全 PASS、1 = 有 FAIL/SKIP 或殘留、2 = 參數/連線資訊錯誤。PTY id `smoke-<yyyymmddHHMMSS>-<6hex>`；`finally` 一律 `pty:kill` + 存在性探測；他人 PTY 的 broadcast 事件直接丟棄不記錄。`wsl.exe` 走 `execFile` + array args、timeout 15s、distro 白名單 `/^[A-Za-z0-9._-]+$/`。 |
| `scripts/__tests__/smoke-remote-headless.test.mjs`（新增，56 tests） | 參數解析（含 distro 白名單 7 種注入樣式、`--url` 各種錯誤）、指紋正規化、token 檔解碼、unit env / fingerprint 欄位解析、`resolveWslTarget` array args（並斷言不 `cat server-cert.json`）、**protocol.ts 漂移守門**（讀原始碼比對 `RemoteFrameType` union 與 `RemoteFrame` 欄位；import `PROXIED_CHANNELS` / `PROXIED_EVENTS` / `HEADLESS_UNSUPPORTED` 檢查使用的 channel；比對 `handler-registry.ts` 的 `No handler for channel:` 文字與 `remote-server.ts` 讀 `frame.token` / `frame.args?.[0]`）、`PtyTracker`（不記錄他人 PTY、去 ANSI）、`runSmoke` 對 in-memory fake server（全 PASS / S7 kill 失敗 → cleanup 補 kill / create 被拒 → S4-S7 SKIP / 錯指紋被接受 → S1 FAIL 即停 / S8 有回應或逾時 → FAIL）。 |
| `package.json` | 只加一行 `"smoke:remote:headless": "node scripts/smoke-remote-headless.mjs"` |
| `docs/remote-dev-overview.md` | 新增小節「Protocol smoke against a running headless server (contributors)」：用法、S1-S8 表、選項表、安全守則 |

**驗證 gates**

| lane | 結果 | 證據 |
|------|------|------|
| unit | PASS | `npm run test:unit`：79 files / **1141 passed**（基線 1085 + 本單 56） |
| type | PASS | `npx tsc --noEmit`：40 個 `error TS`（≤ 40，均非本單檔案；本單為 `.mjs` 不在 tsc 範圍） |
| helper bundle | PASS | `node scripts/verify-helper-bundle.js` → `OK — all 14 helper .mjs files ... reachable` |
| vite build | 未跑（依 memory_overrides，T0397 平行中；由塔台複驗） | — |
| runtime（協定層） | PASS | 見下節，對 WSL 實機 server 兩次 8/8 |

**與工單表格的差異**（照實作做）：
- S2：`settings:get-shell-path` 參數為 shell type（`'auto'`），回傳**字串**路徑（`resolveShellPath`），非物件。
- S3：`pty:create` 參數為 `CreatePtyOptions` 物件 `{ id, cwd, type: 'terminal', shell }`，回傳 `true`；`shell` 用 S2 結果（順帶驗 headless `validateShell`）。marker 用 `echo <nonce>-s3-$((40+2))`，只有實際執行才會輸出 `42`，避免終端回顯誤判。
- S4：`pty:resize(id, cols, rows)` 回傳 `null`（`void`）。
- S7：kill 後 `pty:write` 回 `{ ok:false, reason:'pty-not-found' }`、`pty:get-cwd` 回 `null`，此二者亦作為 S7 後的殘留存在性檢查（無 list channel，只探自己的 id）。
- S8：probe channel 選 `claude:get-supported-models`（在 `HEADLESS_UNSUPPORTED`），錯誤文字來自 `handler-registry.ts` 的 `No handler for channel: <channel>`。
- S1 負向：只測**錯誤指紋**，刻意**不**測錯誤 token —— `remote-server.ts` 5 次 auth 失敗即封 IP 10 分鐘，而使用者的 BAT client 經 WSL localhost forwarding 同樣來自 `127.0.0.1`，測錯 token 有誤封使用者的風險。

### S1-S8 實跑結果

第一次（人讀輸出，`node scripts/smoke-remote-headless.mjs --target wsl:Ubuntu-24.04`，EXIT=0）：

```
[smoke] target wsl:Ubuntu-24.04 → wss://127.0.0.1:9877 (fingerprint 22:3A:E4:C7…79:97; unit environment read; data dir /home/gower/.local/share/bat-server; port 9877 (BAT_SERVER_PORT))
PASS S1 TLS + fingerprint pin + token auth; wrong fingerprint rejected — pinned 22:3A:E4:C7…79:97, auth ok (serverPlatform=linux arch=x64 env=native node=24.21.0 bundle=0.5.9-pre.4); wrong fingerprint rejected at TLS upgrade, auth frame not sent
PASS S2 settings:get-shell-path returns a Linux shell path — settings:get-shell-path('auto') → /bin/bash
PASS S3 pty:create emits output; pty:write echo marker round-trips — pty:create(smoke-20261005012004-3c71a9, cwd=/home/gower, shell=/bin/bash) → true; first output "…ning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)⏎"; marker 2f9dc5b0-s3-42 seen
PASS S4 pty:resize 120x40 is visible to stty size — pty:resize → null; stty size → "40 120"
PASS S5 pty:create with the same id is idempotent (same $$) — second pty:create → true; $$ 654 → 654 (same shell)
PASS S6 PTY survives WS disconnect; write after reconnect + auth — closed WS, reconnected + auth; pty:write → output 2f9dc5b0-s6:42 (same $$ 654: true)
PASS S7 pty:kill emits pty:exit; later write does not break the server — pty:kill → true; pty:exit(smoke-20261005012004-3c71a9, 0); write after kill → {"ok":false,"reason":"pty-not-found"}; pty:get-cwd → null; connection alive (shell-path /bin/bash)
PASS S8 unsupported channel returns an explicit error — claude:get-supported-models → invoke-error "No handler for channel: claude:get-supported-models"
[smoke] cleanup: no smoke PTY left (existence probe pty:write(smoke-20261005012004-3c71a9) → {"ok":false,"reason":"pty-not-found"})
[smoke] RESULT: 8/8 PASS
```

第二次（`npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04 --json`，EXIT=0；節錄）：

```json
{
  "ok": true, "target": "wsl:Ubuntu-24.04", "url": "wss://127.0.0.1:9877",
  "fingerprint": "22:3A:E4:C7:4F:4F:7C:D1:23:09:11:A1:DB:62:CD:82:A9:31:66:95:48:D0:34:CD:6C:42:9C:B7:0A:D1:79:97",
  "startedAt": "2026-10-04T17:22:23.301Z", "finishedAt": "2026-10-04T17:22:23.433Z",
  "ptyId": "smoke-20261005012223-d26442",
  "checks": [
    { "id": "S1", "status": "PASS", "evidence": "pinned 22:3A:E4:C7…79:97, auth ok (serverPlatform=linux arch=x64 env=native node=24.21.0 bundle=0.5.9-pre.4); wrong fingerprint rejected at TLS upgrade, auth frame not sent" },
    { "id": "S2", "status": "PASS", "evidence": "settings:get-shell-path('auto') → /bin/bash" },
    { "id": "S3", "status": "PASS", "evidence": "pty:create(smoke-20261005012223-d26442, cwd=/home/gower, shell=/bin/bash) → true; first output \"…C_ALL: cannot change locale (en_US.UTF-8)⏎gower@GXDEVPC02:~$\"; marker f26e6a7f-s3-42 seen" },
    { "id": "S4", "status": "PASS", "evidence": "pty:resize → null; stty size → \"40 120\"" },
    { "id": "S5", "status": "PASS", "evidence": "second pty:create → true; $$ 712 → 712 (same shell)" },
    { "id": "S6", "status": "PASS", "evidence": "closed WS, reconnected + auth; pty:write → output f26e6a7f-s6:42 (same $$ 712: true)" },
    { "id": "S7", "status": "PASS", "evidence": "pty:kill → true; pty:exit(smoke-20261005012223-d26442, 0); write after kill → {\"ok\":false,\"reason\":\"pty-not-found\"}; pty:get-cwd → null; connection alive (shell-path /bin/bash)" },
    { "id": "S8", "status": "PASS", "evidence": "claude:get-supported-models → invoke-error \"No handler for channel: claude:get-supported-models\"" }
  ],
  "cleanup": { "ptyId": "smoke-20261005012223-d26442", "killedInCleanup": false, "leftover": false,
               "evidence": "existence probe pty:write(smoke-20261005012223-d26442) → {\"ok\":false,\"reason\":\"pty-not-found\"}" }
}
```

**事後唯讀確認**（未動 service）：`systemctl --user is-active bat-server` → `active`；`MainPID=293`、`ActiveEnterTimestamp=Mon 2026-10-05 01:04:23 CST`（smoke 前後未重啟）；`ps -p 654,712`（兩次 smoke 的 shell PID）→ 無此行程（exit 1）。全程只呼叫 smoke 自建 id，未寫入 `~/.local/bat-server`。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

腳本本身無 FAIL。實跑觀察到兩點產品面現象（**未修**，交塔台判斷是否開 BUG）：

1. **WSL headless PTY 啟動即印 `bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)`**：`PtyManager.create` 對直接 spawn 強制注入 `LANG` / `LC_ALL=en_US.UTF-8`，但 `Ubuntu-24.04` distro 未產生該 locale。使用者每開一個遠端終端都會看到此警告，且 locale 實際退回 `C`/`POSIX`（可能影響非 ASCII 輸出）。可能方向：headless 端偵測可用 locale（如 `C.UTF-8`）或不覆寫既有 `LANG`。
2. **auth metadata `serverEnv=native`**：WSL 上的 headless server 回 `serverEnv: 'native'`，且無 `wslDistro` / `serverHome`（`remote-server.ts` `buildAuthMetadata()` 寫死 `'native'`）。協定層無功能影響，但與 `AuthServerEnv` 已定義的 `'wsl'` 不符，client 若日後依此判斷環境會誤判。

其他備註：
- `scripts/*.mjs` 會經 `extraResources` filter 打進安裝檔；本腳本 import `ws`，在安裝檔 `resources/scripts/` 下無 `node_modules` 不能直接執行（與既有 `dev-deploy-headless.mjs` import `esbuild` 同性質，屬開發工具）。`verify-helper-bundle` 仍 OK。
- 工作樹中 `_ct-workorders/T0397-*.md`、`playwright.config.ts`、`e2e/plan036-p0.spec.ts` 為 T0397 平行改動，本單未碰、未納入 commit。

### 回報時間
2026-10-05T01:23:51+08:00
