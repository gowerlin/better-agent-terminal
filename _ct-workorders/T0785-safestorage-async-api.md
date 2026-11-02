---
schema_version: 1
schema_kind: workorder
id: T0785
title: "safeStorage 改用 async API（Electron 45 棄用同步 API、46 移除）：`electron/remote/secrets.ts` 與呼叫端"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T14:46:38+0800"
started_at: "2026-11-02T16:59:33+0800"
updated_at: "2026-11-02T17:08:32+0800"
completed_at: "2026-11-02T17:08:32+0800"
session_ids:
  - "e5204526-1c16-47ba-8aa4-eaca98863481"
depends_on: [T0784]
related:
  - "PLAN-053；D223（使用者選「分開另開一張單」）；T0781 回報區（45 那列 safeStorage、工單草案 2）"
  - "CLAUDE.md「Remote 資安（PLAN-018 T0182）」節（`server-token.json` 以 `safeStorage` 加密）；`docs/agent-guide/remote-security.md`"
affects_files:
  - electron/remote/secrets.ts
  - "electron/remote/*（`server-token.json` 讀寫的呼叫端，以實際 grep 為準）"
  - "electron/**/__tests__/*（對應單元測試）"
  - e2e/pre5-acceptance.spec.ts
  - "e2e/*.spec.ts（塔台答覆 Q-1 補：讀隔離實例 token 的同步 decryptString，實際 19 支列在回報區）"
  - docs/agent-guide/remote-security.md
  - CLAUDE.md
  - _ct-workorders/T0785-safestorage-async-api.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：T0784（Electron 45）合回 main 之後才派；時限是 Electron 46 stable（暫定 2027-01-05）之前。塔台派工前若 T0784 未合併，本單維持 PENDING。"
  - "🔴 改法：`safeStorage.isEncryptionAvailable` / `encryptString` / `decryptString` 改用 `isAsyncEncryptionAvailable` / `encryptStringAsync` / `decryptStringAsync`；`SecretStrategy` 等同步介面一路改成 async 到所有呼叫端。🔴 既有密文不得重新產生或失效（官方：同步 API 加密的密文可用 `decryptStringAsync` 解）；Linux 無 keychain 時的 fallback（`warnFallbackOnce`）行為不變；權杖與密文永不寫日誌。"
  - "🔴 塔台補充（2026-11-02 派工前）：T0784 已合回 main（`9f2ed99c`，Electron 45.2.1）。`pre5-acceptance` 的 A4 會讀使用者真實 `Logs` 找 `[userdata-migration] marker: written`，那份日誌已被輪替刪掉，T0784 已確認 A4 失敗與版本無關；本單只看 safeStorage 相關段落（A1 等），A4 失敗照實記錄、不算本單失敗。BUG-195（`worktree-status-after-close` 逾時）由 T0786 並行處理，本單遇到就單檔重跑並記錄。T0786 只改那支測試與 BUG-195 檔，不要碰。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`test:unit` 全綠；`e2e/pre5-acceptance.spec.ts`（舊 token 仍能解、遠端連線照常）；以舊版本加密的 `server-token.json` 樣本實測可解（隔離 userData，不碰使用者的檔案）；45 啟動時不再出現 safeStorage 棄用警告。"
  - "🔴 文件：`remote-security.md` 與 CLAUDE.md「Remote 資安」節補一行（async API、唯一實作位置）。不發版、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0785 — safeStorage 改用 async API

## 元資料

- **工單編號**：T0785
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T14:46:38+0800
- **預估規模**：M
- **派工順序**：T0784 合回 main 之後；Electron 46 之前

## 背景

T0781 查證：Electron 45 把 `safeStorage` 的同步 API 標為棄用、46 移除。BAT 的遠端 server token（`server-token.json`）用它加密。使用者決定不併入 45 升級，另開本單（D223）。

## 範圍

1. 同步介面改 async 到所有呼叫端。
2. 舊密文相容驗證。
3. 文件。

## 驗收

- [x] typecheck 0 / 0、`test:unit`、`pre5-acceptance`（`test:unit` 的 real-git 逾時與 A4 見回報區）
- [x] 舊密文可解（樣本實測）
- [x] 棄用警告消失
- [x] 文件

---

## 回報區

> 以下由 sub-session 填寫

### 待塔台決策

#### Q-1：其他 19 支 e2e spec 的同步 `safeStorage.decryptString` 要不要在本單一起改？
- **提問時間**：2026-11-02T17:01:38+0800
- **問題**：`affects_files` 只列 `e2e/pre5-acceptance.spec.ts`，但另有 19 支 e2e spec 以 `app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(...))` 讀隔離實例的 `server-token.json`（`pre6-ui-remote-acceptance`、`t0523`、`t0529`、`t0535`、`t0537`、`t0538`、`t0551`、`t0553`、`t0562`、`t0575`、`t0583`、`t0598`、`t0609`、`t0694`、`t0735`、`t0761`、`t0766`、`t0767`、`v072-pre6-codex-resumed`）。Electron 45 仍可用（棄用），46 移除後這些 spec 會全部失敗。
- **選項**：
  - A：本單一起改（每支一行，改成 `(await safeStorage.decryptStringAsync(...)).result`），只跑 `pre5-acceptance` 與 1–2 支代表 spec 實測，其餘只做 typecheck／語法檢查。
  - B：本單只改 `pre5-acceptance`，其餘 19 支記為後續工單（46 之前做）。
  - 其他。
- **建議**：A。理由：改法機械、每支一行、與本單同一個棄用；拆單要再派一次 Worker，且容易在 46 前漏掉。
- **影響**：A 會讓本單多改 19 個 `affects_files` 外的檔（只動那一行）。
- **是否阻塞後續步驟**：否（`pre5-acceptance`、樣本實測、文件照做，等答覆期間繼續）。

- **塔台答覆 Q-1**（BAT 通道 `q-99100c39-d6d0a54a0c670380`，choice 1）：採 A，本單一起改這 19 支 e2e spec。條件：只改讀 `server-token.json` 那一處（可抽共用 helper，但不改 spec 其他內容）；實測 `pre5-acceptance` ＋ 至少 2 支代表 spec（1 支遠端／權杖路徑、1 支一般），其餘 tsc ＋ 全 repo grep；`affects_files` 補 e2e 檔並列實際清單；T0786 只改 `worktree-status-after-close.test.ts`。（Worker 轉錄）

### 完成狀態

**DONE**

- **session_id**：e5204526-1c16-47ba-8aa4-eaca98863481
- 落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 下；C-3 PASS（`electron/remote/secrets.ts` 等存在）；C-2 工單無 `branch` 欄位（目前 `main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

1. **`electron/remote/secrets.ts`**（唯一實作）：只用 `isAsyncEncryptionAvailable` / `encryptStringAsync` / `decryptStringAsync`。`SecretStrategy`（`isAvailable` / `encrypt` / `decrypt`）、`detectSecretStrategy`、`getSecretStrategy`、`encryptString`、`decryptPersisted`、`readSecretFile`、`writeSecretFile`、`isSafeStorageAvailable` 全部改回 Promise。`tryLoadElectronSafeStorage` 改成只在三個 async 方法都存在時採用（否則 plaintext，與 headless／測試環境相同）。`warnFallbackOnce` 文字與「只警告一次」不變；判斷改看 `isAsyncEncryptionAvailable()`（reject 視為不可用）。`decryptStringAsync` 回的 `shouldReEncrypt` 不處理：讀取不改檔（`RemoteServer.start()` 本來每次啟動就以同一 token 重寫密文）。新增測試接縫 `createElectronSafeStorageStrategy`、`resetSecretsForTests`。權杖與密文不進任何日誌。
2. **呼叫端**（grep `secrets` 只有這兩處）：`electron/remote/remote-server.ts` `loadPersistedToken` / `persistToken` 改 async，`start()` 與 `rotateToken()` 內 `await`（`persistToken` 失敗仍只 warn）；`electron/remote/headless-entry.ts` `loadOrGenerateToken` `await` 讀寫、`createHeadlessServer` `await detectSecretStrategy()`。外部介面（`start` / `rotateToken` / `createHeadlessServer` 本來就 async）不變。
3. **單元測試** `electron/remote/__tests__/secrets.test.ts`（新，9 個）：假 safeStorage 的同步方法一律 throw；async 讀寫來回、舊同步 API 版面的檔可讀且讀取不改檔（含 `shouldReEncrypt: true`）、不可用時 plaintext ＋ 只警告一次且警告不含祕密、`isAsyncEncryptionAvailable` reject、加密檔但不可用 → `null`、解密失敗 → `null`、plaintext／舊 `{ token }` 版面、無 electron → plaintext、**source guard**（掃 `electron/` 非測試檔不得有 `safeStorage.isEncryptionAvailable(` / `encryptString(` / `decryptString(`）。
4. **e2e（Q-1 答覆 A）**：20 支 spec 讀隔離實例 token 的那一行改成 `app.evaluate(async ({ safeStorage }, data) => (await safeStorage.decryptStringAsync(Buffer.from(data, 'base64'))).result, record.data as string)`，每支只改這一行（20 insertions / 20 deletions），未抽 helper（避免動 import）。實際清單：`pre5-acceptance`、`pre6-ui-remote-acceptance`、`t0523-dispatch-workspace`、`t0529-workspace-agent-launch`、`t0535-close-worker`、`t0537-worker-ownership-persistence`、`t0538-worker-tab-batch-close`、`t0551-close-worker-focus`、`t0553-worker-tab-title`、`t0562-tower-tab-title`、`t0575-local-scoped-token`、`t0583-worktree-isolated-dispatch`、`t0598-dispatch-input-before-command`、`t0609-worker-attention-badge`、`t0694-worker-resumed-badge`、`t0735-workspace-waiting-badge`、`t0761-detached-workspace-waiting`、`t0766-interrupted-agents-recovery`、`t0767-interrupted-codex-resume`、`v072-pre6-codex-resumed`（皆 `e2e/*.spec.ts`）。
5. **文件**：`docs/agent-guide/remote-security.md` 新增「safeStorage 只用 async API（T0785）」一條（唯一實作、呼叫端、source guard、舊密文相容實測、`shouldReEncrypt` 處理、Linux 未實測），「降級情境」改寫成 async 判斷；CLAUDE.md「Remote 資安」節補一行（async API、唯一實作位置、🔴 不得再呼叫同步 API）。

### 驗證

| 證據道 | 項目 | 結果 |
|---|---|---|
| build / 型別 | `npm run typecheck` | **0** |
| build / 型別 | `npm run typecheck:electron` | **0** |
| build / 型別 | 20 支 e2e：`npx tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node <20 檔>` | 2 個錯誤，**都在未改動的行**（`pre6-ui-remote-acceptance.spec.ts:666` TS2339、`t0598-dispatch-input-before-command.spec.ts:127` TS2538），改動的 20 行 0 錯誤 |
| build | `npx vite build` | 成功 |
| tests | `npm run test:unit` 全量 | 381 / 383 檔、6714 passed、10 skipped、**9 failed**：全在 `electron/__tests__/ct-worktree-status.test.ts`（7）與 `ct-worktree.test.ts`（2），real git 約 5 s 逾時。兩檔不 import `secrets` / remote 模組；單檔重跑：兩檔一起 43/44（又 1 個逾時），`ct-worktree-status.test.ts` 單獨 **21/21**。判定為負載下的 real-git 逾時（與 BUG-195 同類，T0786 同時在跑），與本單無關 |
| tests | `secrets.test.ts` ＋ `headless-server.test.ts` ＋ `headless-electron-free.test.ts`（＋ `auth-throttle-separation.test.ts`） | 全過（最後一次 25/25） |
| source | 全 repo grep `safeStorage?.(encryptString／decryptString／isEncryptionAvailable)(`（`electron` `src` `scripts` `e2e` `tests`，`.ts/.tsx/.mjs/.js/.cjs`） | **0 處**（產品與測試皆無；測試檔裡一處註解已改寫） |
| runtime smoke | `e2e/pre5-acceptance.spec.ts`（`BAT_E2E_PRE5_ACCEPTANCE=1`，source build，隔離實例） | A1 / A3x / **A5 PASS**（A5 以 `decryptStringAsync` 讀隔離實例 token，22 次 helper 派工 exit 0、0 lost）；**A4 FAIL**：`a log with the migration report` 找不到 `[userdata-migration] marker: written`，即塔台預告的日誌已輪替問題，與本單無關 |
| runtime smoke | `e2e/t0575-local-scoped-token.spec.ts`（權杖路徑）＋ `e2e/t0735-workspace-waiting-badge.spec.ts`（一般） | **2/2 PASS** |
| runtime smoke | 舊密文樣本（Electron 45.2.1，隔離 userData 在 scratchpad）：程序 1 用同步 `encryptString` 寫舊版面 `server-token.json`（`v10`）；程序 2 用新 `secrets.ts`（esbuild bundle）讀 | strategy `electron-safe-storage`、讀出 token 與舊 token 相同（只比 SHA-256 前 8 碼）、`shouldReEncrypt: false`、讀取不改檔；新模組寫的檔同步 `decryptString` 也能解（降版相容） |
| runtime smoke | 實際 app（source build，`--runtime=t0785s`、`BAT_REMOTE_PORT=19785`，`%APPDATA%` 下隔離 runtime 目錄，先以同步 API 放入舊密文）啟動 | `[RemoteServer] Started on 127.0.0.1:19785`；stderr **0 行** `(electron) … safeStorage … deprecated`；啟動後檔案由 `start()` 重寫，解出的 token 仍等於舊 token（遠端 client 的舊 token 照常有效）。對照：同一 Electron 呼叫同步 API 時 stderr 會印 `(electron) 'safeStorage.encryptString' is deprecated and will be removed…`（樣本程序 1 實測）。隔離 runtime 目錄已刪除、無殘留 electron 程序 |
| release / 部署 / 外部 | — | 不在範圍（不發版、不 push） |

### 遭遇問題

1. **`affects_files` 外的 19 支 e2e**：同樣呼叫同步 `safeStorage.decryptString`，46 會壞。以 Q-1 問塔台，答覆 A（一起改），已照條件完成。
2. **`test:unit` 9 個 real-git 逾時**：見〈驗證〉，與本單無關；單檔重跑通過。未改任何測試逾時（BUG-195 由 T0786 處理，未碰其檔）。
3. **`pre5-acceptance` A4 失敗**：塔台已說明（日誌輪替），照實記錄。
4. **已知限制**：Linux（無 keychain／`basic_text`）上 `isAsyncEncryptionAvailable()` 的實際回傳未實測；程式路徑（不可用 → plaintext ＋ `warnFallbackOnce`）與 T0785 前相同，但判斷來源從同步改 async。macOS 未實測（只在 Windows 實測）。
5. 舊程式碼啟動時印棄用警告的「改前」對照沒有用舊 build 實跑，是以同一 Electron 呼叫同步 API 會印警告（實測）＋ 舊程式啟動時呼叫同步 API（`detectSecretStrategy` / `readSecretFile` / `writeSecretFile`）推得。

### 互動紀錄

- [17:01] Q-1: 其他 19 支 e2e spec 的同步 `decryptString` 要不要一起改？ → A（塔台，BAT 通道 answered，等待 19.7 s）: 採 A，附條件（見上方轉錄） → Action: 20 支逐行改 `decryptStringAsync`，實測 pre5 ＋ t0575 ＋ t0735，其餘 tsc ＋ grep，`affects_files` 補 `e2e/*.spec.ts`。

### commit 狀態

- `9e9842c6` chore: T0785 in progress, Q-1 for tower（工單，`git commit --only`）
- `ca0d1509` fix(remote): T0785 safeStorage async API（產品＋測試＋e2e＋文件，26 檔，`git commit --only`；驗證在等同此 commit 內容的工作樹上跑）
- 工單結案 commit：本回報寫入後另一個 `git commit --only _ct-workorders/T0785-safestorage-async-api.md`
- 未 push。未碰 T0786 的檔（`_ct-workorders/T0786-*.md`、`electron/__tests__/worktree-status-after-close.test.ts`）。

### 回報時間

2026-11-02T17:08:32+0800
