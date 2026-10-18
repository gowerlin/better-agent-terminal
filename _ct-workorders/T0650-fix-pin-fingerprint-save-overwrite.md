---
schema_version: 1
schema_kind: workorder
id: T0650
title: "BUG-157：「編輯連線」釘選新指紋後按「儲存」不再寫回舊指紋；釘選失敗要顯示錯誤"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-157
priority: P2
sizing: S
created_at: "2026-10-18T18:33:43+0800"
started_at: "2026-10-18T18:36:00+0800"
updated_at: "2026-10-18T18:41:43+0800"
completed_at: "2026-10-18T18:41:43+0800"
depends_on: [T0646]
related:
  - "BUG-157（T0646 程式碼追蹤）；T0182 / CLAUDE.md「Remote 資安」節（TOFU 指紋）；`docs/agent-guide/remote-security.md`"
  - "網站 `site/remote/index.md` 指紋段落目前建議「重跑精靈」（T0646）；修正後是否改回由塔台另案決定，本單不改 `site/**`"
affects_files:
  - "src/components/EditRemoteProfileModal.tsx"
  - "src/components/ProfilePanel.tsx"
  - "electron/** 中釘選指紋的 IPC handler（只在根因在主行程時）"
  - "src/**/__tests__/**、electron/__tests__/**（新增 / 更新測試）"
  - "docs/agent-guide/remote-security.md（只在行為說明需要時補一句）"
  - _ct-workorders/T0650-fix-pin-fingerprint-save-overwrite.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先確認根因再修：讀程式碼確認「Pin expected fingerprint」寫入路徑與 `handleSaveRemote` 寫入的欄位；用 vitest + RTL 重現「釘選 → 儲存」後指紋回退（先寫失敗測試）。確認不是 bug → 不改程式碼，回報 `FAILED` 並附證據。"
  - "🔴 安全不變式：指紋只能由使用者明確動作（精靈 / 釘選）更新；修正不得讓連線流程自動接受新指紋，也不得在指紋不符時送出權杖（`remote-client.ts` 的既有順序不變）。"
  - "🔴 不改 i18n 字串（「Pin expected fingerprint」等英文由 BUG-158 處理）；釘選失敗的錯誤訊息先用既有 key，沒有合適的 key 就在回報列出需要的 key 與建議文案，交給 BUG-158。"
  - "🔴 非隔離工單。T0649（BUG-156，Docker 精靈）與 T0648（唯讀探針）可能同時進行，不碰它們的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0650 — 釘選的指紋不被「儲存」蓋回

## 背景

T0646 依程式碼改寫 `/remote/` 時發現：`EditRemoteProfileModal` 的「Pin expected fingerprint」立即寫入新指紋，但對話框 state `editRemoteFingerprint` 仍是舊值；按「儲存」時 `ProfilePanel.tsx` `handleSaveRemote` 以對話框 state 寫回 → 新指紋被覆蓋。釘選失敗也沒有提示。詳見 BUG-157。

## 要做的事

1. 確認根因並先寫重現測試（失敗）。
2. 修正：釘選成功後對話框顯示並持有新指紋（或「儲存」不再覆寫指紋欄位，擇一，回報說明理由）；釘選失敗顯示錯誤，不關閉對話框。
3. 檢查同一對話框其他「立即寫入」的欄位是否有同樣的覆寫問題，有就一併修、沒有就寫明。
4. 測試：釘選 → 儲存後指紋為新值；釘選失敗有錯誤提示；只改其他欄位時指紋不變。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5384 / 311）
- `npx vite build` 成功

## 驗收

- 「釘選 → 儲存」後保留新指紋；釘選失敗有提示；安全不變式不變
- 三項驗證通過；回報區附根因確認、修正說明、測試清單、commit，以及網站 `/remote/` 指紋段落是否可改回「在編輯連線裡重新釘選」（給塔台）
- 只改 `affects_files`；未 push

## 回報區

### 結果摘要

**FIXED**。根因與 BUG-157 描述一致，已先以 vitest + RTL 重現（4 項失敗）再修正。修正方式：釘選成功後對話框 state 改持有新指紋（不採「儲存不寫指紋」，理由見下）；釘選失敗 / IPC 拒絕 / 回應沒有指紋時在對話框內顯示原因，不寫入、不關閉。product commit `5594ec57`。

### Landing check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS
- C-3：C-0 已 PASS，僅記錄：`src/components/ProfilePanel.tsx` 存在；`src/components/EditRemoteProfileModal.tsx` 不存在（實際位置 `src/components/profiles/EditRemoteProfileModal.tsx`，見「偏差」）
- C-2：工單無 `branch` 欄位；目前 `main`
- 非隔離派工（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 根因確認

- `EditRemoteProfileModal` 的「Pin expected fingerprint」→ `ProfilePanel.tsx` `handlePinFingerprint`：`remote.testConnection(host, port, token, undefined)` 取得當下指紋後 `profile.update(id, { remoteFingerprint })` 立即寫入，但**沒有**更新對話框 state `editRemoteFingerprint`（對話框仍顯示舊值）。
- 「儲存」→ `handleSaveRemote` 以對話框 state 寫 `remoteFingerprint: editRemoteFingerprint.trim() || undefined` → 新指紋被舊值覆寫。
- 釘選失敗（`result.ok === false` 或沒有 `fingerprint`）直接略過；IPC 例外被 `catch { // ignore }` 吞掉 → 沒有任何提示。
- 根因在 renderer，主行程 `remote:test-connection`（`electron/main.ts`）未改。

### 修正說明

- `src/components/ProfilePanel.tsx`
  - `handlePinFingerprint`：寫入 profile 後 `setEditRemoteFingerprint(result.fingerprint)`；失敗時以既有 `formatRemoteStatusTitle`（`profiles.statusReason.probeFailed` + `profiles.statusProbeError.*`）組錯誤字串，例如 `Connection failed: unreachable (connect ECONNREFUSED …)`；例外 → `Connection failed: error (<訊息>)`；`ok` 但沒有指紋 → `Connection failed: error`。
  - 新增 `editPinning` / `editPinError` state 與 `editingRemoteIdRef`：釘選進行中按鈕停用；釘選結束時若對話框已關閉或換成另一個 profile，不改對話框 state（釘選本身仍寫入它發起的那個 profile）。開啟 / 關閉對話框時重設兩者。
- `src/components/profiles/EditRemoteProfileModal.tsx`：新增 props `pinning` / `pinError`；按鈕 `disabled` 加 `pinning`；錯誤以 `<span role="alert">` 顯示在按鈕列下方（樣式同 ProfilePanel 既有的 `remoteProfileError`）。
- `docs/agent-guide/remote-security.md`：ProfilePanel UI 那一條補一句釘選行為。
- **選擇「對話框持有新指紋」而非「儲存不寫指紋」的理由**：對話框裡還有兩條合法修改指紋的路徑會靠「儲存」落地——貼上連線 URL（`fp=` 參數）與「Fetch profiles」在欄位空白時的 TOFU 填入；若「儲存」不再寫指紋，這兩條會失效。
- **安全不變式**：指紋仍只由使用者明確動作（釘選 / 貼 URL / 欄位空白時 Fetch 的 TOFU，皆既有行為）更新；未改 `remote-client.ts`，指紋不符時中斷連線、不送權杖的順序不變；沒有任何連線流程自動接受新指紋。

### 同一對話框其他「立即寫入」的欄位（步驟 3）

已逐一檢查 `EditRemoteProfileModal` 的所有動作：只有「Pin expected fingerprint」會立即呼叫 `profile.update`。host / port / token / 貼 URL / 遠端 profile 選擇都只改對話框 state、由「儲存」寫入；「Fetch profiles」（`handleFetchEditRemoteProfiles`）只讀，欄位空白時的 TOFU 也只填對話框 state。→ 沒有其他同類覆寫問題。

### 測試清單

新增 `src/components/__tests__/profile-panel-pin-fingerprint.test.tsx`（6 項，修正前 4 項失敗、2 項通過）：

1. 釘選 → 儲存後指紋為新值（對話框顯示新值；釘選請求不帶舊指紋；儲存寫入 `fp-new`）— 修正前 ×
2. 釘選失敗（`network`）顯示錯誤、對話框不關、不寫入；之後儲存仍是舊指紋 — 修正前 ×
3. IPC 拒絕與 `ok` 但沒有指紋都顯示錯誤、不寫入 — 修正前 ×
4. 釘選成功會清掉前一次的錯誤 — 修正前 ×
5. 只改其他欄位（host）時指紋不變、不觸發釘選 — 修正前 ✓（防回歸）
6. 對話框關閉後才完成的釘選不污染下一個編輯中的 profile — 修正前 ✓（守住本次新增的 ref 判斷）

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS | 0 errors |
| `npm run typecheck:electron` | PASS | 0 errors |
| `npm run test:unit` | PASS | Test Files 312 passed (312)；Tests 5390 passed / 3 skipped（基線 5384 / 311，+6 / +1 = 本單新增檔） |
| `npx vite build` | PASS | exit 0（`✓ built in 4.84s` 等） |

- 驗證時工作樹另含其他 Worker（T0649 等）尚未 commit 的 `electron/**`、`src/components/setup-wizard/**`、`src/types/electron.d.ts` 變更；上述結果是合併工作樹的結果，本單 commit 只含本單檔案。
- 未做實機 runtime smoke（需要可連的遠端伺服器並換掉憑證）；人工驗收步驟：編輯連線 → Pin expected fingerprint → 欄位應立即變成新指紋 → 儲存 → 重新開啟編輯應為新值；把 host 改成連不到的位址後儲存，再按 Pin 應出現紅字錯誤。

### Commit

- `5594ec57` fix(profiles): keep the pinned fingerprint on Save and show pin errors (T0650, BUG-157)
  - `src/components/ProfilePanel.tsx`、`src/components/profiles/EditRemoteProfileModal.tsx`、`src/components/__tests__/profile-panel-pin-fingerprint.test.tsx`、`docs/agent-guide/remote-security.md`
- 工單檔另以一個 commit 收尾（`git commit --only`）。未 push。

### 偏差

- `affects_files` 寫 `src/components/EditRemoteProfileModal.tsx`，實際檔案在 `src/components/profiles/EditRemoteProfileModal.tsx`（T0288 搬移），已改後者。
- i18n：未新增 / 修改任何字串。錯誤訊息完全由既有 key 組成（`profiles.statusReason.probeFailed`、`profiles.statusProbeError.*`）。按鈕與欄位既有的英文硬字串（`Pin expected fingerprint`、`Pinned fingerprint (read-only)` 與兩個 `title`）照舊，留給 BUG-158。

### 給塔台：網站 `/remote/` 指紋段落

可以把「在編輯連線裡重新釘選」寫回去作為選項，但建議**不要取代**「重跑精靈」，並附兩點說明：

1. 釘選是 TOFU：以 profile **已儲存**的 host / port / token 連線、**不帶預期指紋**（`testConnection(…, undefined)`），會接受當下回應的伺服器，且權杖會送給它（`remote-client.ts` 只有在有預期指紋時才在送權杖前比對）。適合「確定是自己剛重裝的伺服器」的情況；不確定為何指紋變了時應先查原因。這是既有行為，本單未改（安全不變式要求不改連線順序）。
2. 釘選用的是已儲存的連線資料，不是對話框裡尚未儲存的修改；若同時要改 host / token，要先儲存再釘選。
- WSL / SSH / Docker 精靈另會更新權杖，伺服器資料被刪、權杖也換掉時仍要重跑精靈。

### 後續建議

- （可選，交塔台決定）釘選按鈕改用對話框內目前的 host / port / token，或在有未儲存修改時提示——本單未做，屬行為變更。
- BUG-158 需處理的字串：`Pin expected fingerprint`、`Pinned fingerprint (read-only)`、兩個按鈕 / 欄位 `title`；本單無新增需求 key。

### 互動紀錄

- 無（yolo，未向塔台提問）。
