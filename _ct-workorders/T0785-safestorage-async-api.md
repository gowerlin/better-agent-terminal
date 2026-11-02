---
schema_version: 1
schema_kind: workorder
id: T0785
title: "safeStorage 改用 async API（Electron 45 棄用同步 API、46 移除）：`electron/remote/secrets.ts` 與呼叫端"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T14:46:38+0800"
started_at: "2026-11-02T16:59:33+0800"
updated_at: "2026-11-02T16:59:33+0800"
depends_on: [T0784]
related:
  - "PLAN-053；D223（使用者選「分開另開一張單」）；T0781 回報區（45 那列 safeStorage、工單草案 2）"
  - "CLAUDE.md「Remote 資安（PLAN-018 T0182）」節（`server-token.json` 以 `safeStorage` 加密）；`docs/agent-guide/remote-security.md`"
affects_files:
  - electron/remote/secrets.ts
  - "electron/remote/*（`server-token.json` 讀寫的呼叫端，以實際 grep 為準）"
  - "electron/**/__tests__/*（對應單元測試）"
  - e2e/pre5-acceptance.spec.ts
  - docs/agent-guide/remote-security.md
  - CLAUDE.md
  - _ct-workorders/T0785-safestorage-async-api.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
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

- [ ] typecheck 0 / 0、`test:unit`、`pre5-acceptance`
- [ ] 舊密文可解（樣本實測）
- [ ] 棄用警告消失
- [ ] 文件

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

### 完成狀態

### 產出摘要

### 驗證

### 遭遇問題

### 互動紀錄

### commit 狀態

### 回報時間
