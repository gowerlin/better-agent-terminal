---
schema_version: 1
schema_kind: workorder
id: T0449
title: "T0445 #5/#8：auth 節流與 helper 分流——loopback 不被權杖失敗 ban 死、撤銷權杖回 Capability revoked、helper 成功不清 server token 失敗計數"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: S
created_at: "2026-10-05T06:32:48+08:00"
started_at: "2026-10-05T06:42:05+08:00"
updated_at: "2026-10-05T06:47:01+08:00"
completed_at: "2026-10-05T06:47:01+08:00"
target_version: next
depends_on:
  - T0447
related:
  - "T0445 findings #5 / #8、拆單 3"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/remote/remote-server.ts
  - electron/remote/helper-capability.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **塔台裁決**：權杖 auth 失敗與 server token auth 失敗**分開計數**；權杖失敗**不觸發 IP ban**（權杖為 256-bit 隨機值，暴力猜測不可行；ban 只會傷到同機 BAT client）。已撤銷權杖（registry 記得最近撤銷的 digest，有界、TTL）回 `Capability revoked` 且不計失敗。server token 失敗的既有節流維持，但 helper auth 成功**不得**清除 server token 失敗計數（#8）。"
  - "🔴 loopback 的 server token 失敗是否仍 ban：維持既有行為（不改），回報區說明 SSH tunnel 情境下的風險已因權杖失敗不計入而大幅縮小。"
  - "🔴 依賴 T0447（同改 `remote-server.ts`）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push。"
---

# T0449 — auth 節流分流（T0445 #5/#8）

## 驗收條件

- [ ] 測試：同 loopback IP 連續 10 次錯誤權杖後，server token auth 仍成功；撤銷權杖回 `Capability revoked`；4 次 server token 失敗 + 1 次權杖成功 + 1 次 server token 失敗 → 觸發 ban（計數未被清）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #5 / #8 + T0447 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 present（`remote-server.ts` / `helper-capability.ts` / `__tests__/` 皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 驗收條件：
  - [x] 測試：同 loopback IP 連續 10 次錯誤權杖後 server token auth 仍成功；撤銷權杖回 `Capability revoked`；4 次 server token 失敗 + 1 次權杖成功 + 1 次 server token 失敗 → ban（計數未被清）
  - [x] `npm run test:unit` 全綠：**148 files / 2382 passed / 1 skipped**；`npx tsc --noEmit` = **39**（≤ 39；本單檔案 0 筆）

### 產出摘要

**關鍵設計：怎麼判定「這是權杖失敗」**

auth frame 只有一個 `token` 欄位，失敗時 server 不知道對方「想當」client 還是 helper。純看形狀不行：權杖是 `randomBytes(32).toString('base64url')`（43 字元），而 `rotateToken()`（`remote-server.ts`）與 `headless-entry.ts` 產生的 **server token 也是同形狀**。因此：

- `issue()` 簽發的權杖改為 **`batcap.` + 32-byte base64url**（`HELPER_CAPABILITY_TOKEN_PREFIX`）。`.` 不在 base64url / hex 字母表內，產生出來的 server token 永遠不會帶此前綴。權杖對 helper 是不透明字串（經 `BAT_REMOTE_TOKEN` env 原樣送回），`bat-notify.mjs` / `bat-terminal.mjs` 無需改動
- 失敗被歸為「權杖失敗」的條件：帶前綴 **且** 目前 / rotate 寬限期內的 server token 都不帶前綴（`isCapabilityAuthFailure`）。理由：帶前綴的猜測不可能等於不帶前綴的 server token，故不計入 ban 不會給 server token 暴力破解任何好處；使用者自訂的 server token 若剛好帶前綴，則退回全部計入（有測試）

**逐條對應 T0445 / 塔台裁決**

| 項目 | 修法（落點） | 測試 |
|---|---|---|
| **#5** 權杖失敗分開計數、不觸發 IP ban | `remote-server.ts` auth 失敗分支拆三路：① 已撤銷權杖 → `Capability revoked`、關閉、**不計數**；② 權杖失敗 → 計入獨立的 `capabilityAuthFailures`（`recordCapabilityAuthFailure`，同 60 s 窗口），達 `AUTH_FAIL_THRESHOLD` 時 warn **一次**，**永不 ban**，回 `Invalid token`；③ 其餘 = server token 失敗 → 既有 `recordAuthFailure` + ban（不變） | `auth-throttle-separation.test.ts`（真 headless server、loopback）：10 次錯誤權杖 → 每次 `Invalid token`，之後 server token 與活權杖仍可認證；4 次 server token 失敗 + 10 次權杖失敗 → server token 仍可認證（權杖失敗不湊數） |
| **#5** 撤銷權杖回 `Capability revoked` | `helper-capability.ts` `HelperCapabilityRegistry`：`revokeTerminal()`（含 `issue()` 重簽時撤銷舊權杖）與 `clear()` 把 digest 記入 `revoked`（**只存 SHA-256 digest，不存權杖**），TTL `REVOKED_CAPABILITY_TTL_MS = 10 min`、容量 `REVOKED_CAPABILITY_CAPACITY = 1024`（插入序 = 到期序，超量逐出最舊）；`isRecentlyRevoked(token)` 查詢。建構子可注入 `now` / `revokedTtlMs` / `revokedCapacity`（測試用） | wire：撤銷後 10 次 auth 皆 `Capability revoked`、server token 仍可認證。單元（`helper-capability.test.ts` +5）：前綴判定、撤銷 / 重簽 / clear 皆記住、活 / 未知權杖非 revoked、TTL 到期遺忘、容量上限逐出最舊、state 內不含權杖本體 |
| **#8** helper 成功不清 server token 失敗計數 | `acceptHelper` 成功分支刪除 `this.authFailures.delete(clientIp)`；只有 server token 成功才清 | wire：4 次 server token 失敗 + 1 次權杖成功 + 1 次 server token 失敗 → 下一次連線（server token 或權杖）皆 `Too many failed attempts` |
| loopback server token 失敗仍 ban | **維持不變**（塔台裁決） | wire：5 次錯誤 server token → ban；server token 帶 `batcap.` 前綴時帶前綴的猜測照樣計入並 ban |

**關於 loopback ban（塔台裁決要求說明）**：server token 失敗在 loopback 上仍會 ban 10 分鐘，維持既有行為。T0445 #5 描述的 SSH tunnel 情境（BAT client 經 `-L` 到達時來源也是 `127.0.0.1`）之所以嚴重，是因為**主要觸發源是 helper**：PTY 結束後仍存活的背景 `bat-notify` 拿已撤銷權杖重試，或任何同機程序送錯權杖，每次都計入同一個 loopback 計數。本單後，這兩類都不再計入（撤銷 → `Capability revoked`；錯誤權杖 → 獨立計數不 ban），剩下能 ban 掉 loopback 的只有「送錯 **server token** 5 次」—— 需要對方刻意以 server token 形式猜測（同機其他 uid 的惡意行為），helper 的正常故障模式已無法觸發。殘餘風險：同機惡意程序仍可每 10 分鐘以 5 次錯誤 server token 把 SSH tunnel 上的 BAT client 擋在外（DoS，非越權），若要消除需改「loopback 不 ban」，屬塔台另議。

**對既有測試的影響**：`headless-helper-capability.test.ts` 兩個撤銷案例原斷言重新 auth 得 `Invalid token`，依裁決改為 `Capability revoked`（2 行）；`helper-capability.test.ts` 原斷言權杖 `Buffer.from(token,'base64url')` 長 32，改為先去前綴。`Invalid token` / `Capability revoked` 字串在 `src/` / `scripts/` 無任何消費者（grep 確認），BAT client 用 server token 不受影響；`remote-profile-error` 的 `Invalid token` → trust 分類不變。

**紅 → 綠證據**
- 紅：暫時把 `remote-server.ts` 換成 HEAD 版（`git show HEAD:… >` 覆寫，新版備份於 scratchpad 後原樣複製回；未用 stash / checkout / restore），新測試檔 **4 failed | 2 passed**（兩個「行為不變」基線案例通過）。訊息：`expected 'Too many failed attempts' to be 'Invalid token'`（#5 × 2）、`expected 'Invalid token' to be 'Capability revoked'`（撤銷）、`expected undefined to be 'Too many failed attempts'`（#8，計數被 helper 成功清零）
- 綠：新檔 6 passed、`helper-capability.test.ts` 67 passed；全套見下

| 證據道 | 結果 | 內容 |
|---|---|---|
| `npm run test:unit` | PASS | 148 files / 2382 passed / 1 skipped（首跑 2 failed = 上述兩個舊斷言，更新後全綠） |
| `npx tsc --noEmit` | PASS | 39（≤ 39；本單檔案 0） |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁止 |
| 部署 / 實機 | 未做 | 工單未要求 |

**變更檔案**：`electron/remote/helper-capability.ts`、`electron/remote/remote-server.ts`、`electron/remote/__tests__/helper-capability.test.ts`、`electron/remote/__tests__/headless-helper-capability.test.ts`、`electron/remote/__tests__/auth-throttle-separation.test.ts`（新）、本工單。工作樹內其他 session 的平行改動（`main.ts` / `preload.ts` / Agent panels / 其他工單等）未碰。

### 遭遇問題

1. **權杖格式變更（`batcap.` 前綴）超出 #5 字面描述**：為了可靠區分權杖失敗與 server token 失敗所必需（見「關鍵設計」）。影響面已確認：權杖只在 headless 記憶體內簽發、經 env 交給 helper、helper 原樣送回，無格式驗證；新 server 行程以空 registry 起跑，不存在新舊格式混用
2. **`clear()` 也記入撤銷 digest**：server `stop()` 後若同一 registry 再 `start()`，舊權杖得 `Capability revoked`（而非計失敗）；新行程 / 新 registry 仍是 `Invalid token`（既有「restart 後舊權杖全拒」測試不變）
3. **權杖失敗不再有任何 ban**：依裁決。256-bit 權杖無暴力破解可行性；獨立計數僅用於達門檻時 warn 一次（每窗口），不會因大量失敗灌 log（與 #9 方向一致）
4. **未處理（範圍外）**：#6 `pty:write` 內容過濾、#7 tower 子 PTY 上限、#9 拒絕 log 的 `channel` 限長 / 每權杖連線數 / heartbeat 涵蓋 helper；loopback server token ban 依裁決維持
5. `AttachConsole failed` stderr 雜訊（Windows conpty）在全套執行時仍出現，測試全綠，與 T0447 回報相同，未另查

**Commit**：`git add` 新測試檔後以 `git commit --only` 提交本單 6 個路徑；不 push。hash 見 `git log`（回報區於 commit 前寫入，不自我引用）。

### 回報時間

2026-10-05T06:46:14+08:00
