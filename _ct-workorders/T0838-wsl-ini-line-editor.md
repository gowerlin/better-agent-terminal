---
schema_version: 1
schema_kind: workorder
id: T0838
title: "PLAN-043 W1：INI 逐行編輯器（`.wslconfig` / `/etc/wsl.conf` 共用，純函式）＋備份檔名規則；`KNOWN_NETWORK_MODES` 補 `consomme`"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T09:21:12+0800"
updated_at: "2026-11-04T09:28:39+0800"
completed_at: "2026-11-04T09:28:39+0800"
session_ids:
  - "7d9a1a72-13c8-4031-b831-228c742e3103"
depends_on: []
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（〈建議下一步〉W1、〈調查結論〉2 P-2 / P-5、5 測試策略）"
affects_files:
  - _ct-workorders/T0838-wsl-ini-line-editor.md
  - electron/ini-line-editor.ts
  - electron/wsl-detect.ts
  - electron/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 純函式模組（不 import electron、不讀寫檔）：輸入文字＋要設定的 section / key / value，輸出新文字；只改目標行，其他行（含註解、空行、未知 key、順序）原樣保留。解析失敗回明確結果（呼叫端不得寫入）。本單不接進任何流程（W3 / W4 才用）。"
  - "🔴 `wsl-detect.ts` 只補 `KNOWN_NETWORK_MODES` 的 `consomme`（`virtioproxy` 保留相容），其他偵測行為不變。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。其他 Worker 同時在 main 執行。"
---

# T0838 — PLAN-043 W1：INI 逐行編輯器

## 元資料
- **工單編號**：T0838｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **規模**：S｜可與其他工單並行（不碰共用檔）

## 任務指令
1. 讀 `_ct-workorders/T0831-research-wsl-phase2-3.md` 回報區（W1 與測試策略）。
2. `electron/ini-line-editor.ts`：`setIniValue(text, section, key, value)` 一類 API；處理 CRLF / LF（保留原換行）、UTF-8 BOM、UTF-16（`.wslconfig` 可能是 UTF-16 LE：偵測並回報編碼，寫回時保持）、`#` / `;` 註解、section / key 大小寫（WSL 的規則寫進註解與測試）、重複 key（改最後一個或全部，依 WSL 行為決定並說明）、缺 section 時新增在檔尾、key 不存在時加在該 section 最後。
3. 備份檔名規則：`<原檔名>.bat-backup-<YYYYMMDD-HHMMSS>`（時間由呼叫端傳入，模組內不取時鐘）。
4. `KNOWN_NETWORK_MODES` 補 `consomme`。
5. 單元測試覆蓋上述情況；`npm run typecheck:electron` = 0、`npm run test:unit` 全過。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE
- **session_id**：7d9a1a72-13c8-4031-b831-228c742e3103
- **落點檢查**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/`；C-3：`electron/`、`electron/__tests__/` 存在（`electron/ini-line-editor.ts` 為新檔，祖先存在）；C-2：無 `branch` 欄位（實際 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定；`CT_HOME` 未設（非 worktree）。
- **產品 commit**：`919a006e74f79d5784a5fde365db94d562fd1efb`（只含下列 4 個檔，`git add` 明確路徑；不 push）。工單檔另一個 commit。
- **相關通過案例**：工單無此段，不適用。

### 產出摘要

**新檔 `electron/ini-line-editor.ts`**（純函式：沒有任何 import、不讀寫檔、不取時鐘；本單不接進任何流程）

| API | 用途 |
|---|---|
| `setIniValue(text, section, key, value)` | 只改目標行；回 `{ ok: true, text, changed, action: 'unchanged' \| 'replaced' \| 'added-key' \| 'added-section', line, ignoredDuplicateLines }` 或 `{ ok: false, reason, message, line? }`（呼叫端不得寫入） |
| `getIniValue(text, section, key)` | 以 WSL 的規則讀值（第一個生效），給 W2 / W3 驗證用 |
| `decodeIniBuffer(buf)` / `encodeIniText(text, encoding)` | 偵測並回報編碼：`utf8` / `utf8-bom` / `utf16le-bom` / `utf16le`（無 BOM，以零位元組啟發式判斷）/ `utf16be-bom`；寫回時同編碼、逐位元組 round-trip；無效 UTF-8、奇數長度 UTF-16 → `invalid-encoding` |
| `formatIniBackupStamp(date)` / `iniBackupPath(path, date \| stamp)` | 備份檔名 `<原路徑>.bat-backup-<YYYYMMDD-HHMMSS>`（時間由呼叫端傳入；同一秒兩次會同名，由呼叫端決定拒絕或覆寫，已寫在註解） |

**WSL 行為依據**（microsoft/WSL `src/shared/configfile/configfile.cpp`，2026-11-04 讀；`.wslconfig` 與 `/etc/wsl.conf` 共用此 parser）——寫在模組開頭註解與測試：
- section / key 大小寫不分（`strcasecmp` 比對 `section.key`）；名稱 = 字母開頭、其後字母或數字 → 本模組以 `^[A-Za-z][A-Za-z0-9]*$` 驗證。
- **重複 key：第一個生效**，後面的被 WSL 忽略並警告（重複的 `[section]` 區塊也算同一個 section）⇒ 只改第一個，後面的不動，以 `ignoredDuplicateLines` 回報。WSL 自己的 update mode 也只改第一個。
- 註解：WSL 只認 `#`；`;` 開頭的行在 WSL 是被忽略的無效行。本模組兩者都當註解、不動。值後面未加引號的 `#` 是行尾註解，取代時保留（含前面的空白）。
- 原值有引號 → 新值也加引號；`#` 在引號內不是註解。
- 缺 key → 加在該 section 第一個區塊的最後一個 key 之後（沒有 key 則緊接標頭；複製前一個 key 的縮排）；缺 section → 檔尾，與前文空一行。
- 換行：每行原本的 CRLF / LF 原樣保留；新增的行用檔案第一個換行符號（沒有則 LF）；原檔最後沒有換行時不額外加。文字開頭的 U+FEFF 保留。
- 解析失敗（不寫入）：壞掉的 section 標頭、沒有 `=` 的行、不合法的 key 名、目標行引號沒關、任何 key 行以 `\` 結尾（WSL 會把下一行接進值，可能吞掉下一個標頭）。新值限制為不需引號 / 跳脫的字元（不得含前後空白、`"`、`#`、`\`、控制字元）。

**`electron/wsl-detect.ts`**：`WslNetworkMode` 型別與 `KNOWN_NETWORK_MODES` 加 `consomme`（`virtioproxy` 保留相容），其他偵測行為不變。

**測試**：新檔 `electron/__tests__/ini-line-editor.test.ts`（36 案例：LF / CRLF / 無結尾換行、縮排與行尾註解、引號、大小寫、unchanged、重複 key 與重複 section、新增 key / section、空檔、BOM、各種失敗、5 種編碼 round-trip、UTF-16 LE 端到端、備份檔名、純函式 source guard）；`electron/__tests__/wsl-detect.test.ts` 加 1 案例（`consomme` 於 `wslinfo` UTF-8 / UTF-16 與 `.wslconfig`，`virtioproxy` 仍可）。

### 驗證證據分道

| 分道 | 結果 |
|---|---|
| source | PASS：模組無 import / require / `Date.now()` / `new Date()`（source guard 測試） |
| 單元測試 | PASS：`npx vitest run electron/__tests__/ini-line-editor.test.ts electron/__tests__/wsl-detect.test.ts` 2 檔 73 測試全過；`npm run test:unit` 413 檔通過 / 3 skipped，7234 測試通過 / 39 skipped，0 失敗 |
| 型別 | PASS：`npm run typecheck:electron` = 0；`npm run typecheck` = 0 |
| runtime / 實機 | 不適用（本單不接進流程；W3 / W4 實作時才實測讀寫 `.wslconfig` / `/etc/wsl.conf`） |

### 互動紀錄

- 沒有向塔台提問：重複 key 的處理依 WSL 原始碼決定（第一個生效），不需裁決。
- 三個塔台補充檢查節點（驗證前、產品 commit 前、填回報前）都沒有新的 `## 塔台補充（…）`。沒有 compact / resume。

### 遭遇問題

- **行為變化（預期內，記錄給塔台）**：`wslinfo` 回 `consomme` 時，原本 `actual = unknown`（精靈不出警告），現在是 `consomme` → 精靈的 `selectNetworkModeWarning`（`src/components/setup-wizard/steps/wsl/install-server-bundle.ts:32`）走 `default` 分支，顯示與 `virtioproxy` 相同的 `wizard.wsl.warning.networkUnverified`（mode = `consomme`）。這與 T0831 的意圖一致（`consomme` 即改名的 `virtioproxy`）。
- **後續（不在本單範圍）**：
  1. renderer 端的型別鏡像沒有 `consomme`：`electron/preload.ts:589-590`、`src/types/electron.d.ts:57`、`install-server-bundle.ts:11` 的 `NETWORK_MODES`、`src/components/setup-wizard/wizard-runner.ts:85`。目前 runtime 照常（`default` 分支處理），但型別少一個值；建議併入 W2（本來就要改 `preload.ts` / `electron.d.ts`）。另外這兩個檔目前有其他 Worker（T0830）未 commit 的變更。
  2. 既有的 T0383 讀取函式與 WSL 規則有差異：`parseWslConfigNetworkingMode`（`electron/wsl-detect.ts`）重複 key 取**最後一個**（WSL 取第一個），且把 `;` 與引號內的 `#` 當註解；`systemdEnabled` 的 `/etc/wsl.conf` 備援 regex 不看 section。W2 / W3 可改用 `getIniValue` 統一。
  3. 本模組不判斷 WSL 能不能讀無 BOM 的 UTF-16 LE / UTF-16 BE（推論：CRT 只認有 BOM 的 UTF-8 / UTF-16 LE，未實測）；只保證不改變原編碼。

### 回報時間

- 2026-11-04T09:27:44+0800
