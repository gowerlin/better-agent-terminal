---
schema_version: 1
schema_kind: workorder
id: T0751
title: "BUG-185 修正：e2e `t0512-profile-panel-layout` 第 2 項補 `wsl-systemd:snapshot-unit` stub，並核對 `WIZARD_STUBS` 與精靈現況"
type: implementation
status: FIXED
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: XS
created_at: "2026-11-01T22:26:23+0800"
started_at: "2026-11-01T22:27:48+0800"
updated_at: "2026-11-01T22:32:20+0800"
completed_at: "2026-11-01T22:32:20+0800"
session_ids:
  - "b4720162-3235-4e2e-a6e0-7d8ee95aff50"
depends_on: []
related:
  - "BUG-185（T0750 回報區〈發現的問題〉1）；T0750（`8a432d40`）；T0554（新增 `wsl-systemd:snapshot-unit`）；T0512（原 spec）；D205（與 T0750 / T0752 一起發版）"
affects_files:
  - e2e/t0512-profile-panel-layout.spec.ts
  - _ct-workorders/T0751-fix-bug185-t0512-wizard-stub.md
  - _ct-workorders/BUG-185-t0512-wizard-e2e-missing-snapshot-unit-stub.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標（BUG-185）：`e2e/t0512-profile-panel-layout.spec.ts` 第 2 項（setup wizard completion block）重新通過。先確認失敗原因（T0750 Worker 判讀：`WIZARD_STUBS` 缺 T0554 新增的 `wsl-systemd:snapshot-unit`，精靈第 5 步 alert「無法讀取目前的 BAT 服務」）；stub 回傳值依 handler 實際契約（讀 `electron/main.ts` / `electron/preload.ts` / 精靈 step 的呼叫端）。同時核對 `WIZARD_STUBS` 與精靈目前呼叫的所有 channel，還有其他落差就一併補，回報列出。"
  - "🔴 只改測試：產品程式碼不動。若查出是產品缺陷（stub 補齊後仍失敗且原因在產品端），停下，記在回報區〈發現的問題〉，回 PARTIAL，由塔台開單。斷言不得放寬來湊綠（版面斷言意圖保留）。"
  - "🔴 build 順序（D205，與 T0752 並行）：本單先跑 `npx vite build`，T0752 等本單 commit 後才 build。本單 commit 後就不要再 build。"
  - "🔴 驗證：`npx vite build` 成功；`t0512-profile-panel-layout` 兩項連跑 2 次綠；以拿掉新 stub 的版本確認第 2 項會失敗（突變檢查，結果寫回報區，還原後再 commit）。不需跑 `test:unit`（只改 e2e 檔）。完成後 BUG-185 改 FIXED（附 commit、`fixed_at` 取系統時間）。不發版、不 push、不改 CHANGELOG。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑、使用者名稱或主機名。"
  - "🔴 範圍：只修 BUG-185；發現其他缺陷記在回報區〈發現的問題〉。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0751 — BUG-185 修正：t0512 精靈 e2e 補 stub

## 元資料

- **工單編號**：T0751
- **類型**：implementation（test fix）
- **優先級**：P3
- **建立時間**：2026-11-01T22:26:23+0800
- **預估規模**：XS

## 背景

T0750 重跑相關 e2e 時發現 `t0512-profile-panel-layout` 第 2 項失敗：spec 的 `WIZARD_STUBS` 沒有 T0554 新增的 `wsl-systemd:snapshot-unit`，精靈第 5 步讀不到 BAT 服務就停下。只影響測試。使用者指示修，並與 T0750 / T0752 一起發版（D205）。

## 範圍

1. 確認失敗原因、補 stub，核對 `WIZARD_STUBS` 與精靈現況。
2. 突變檢查 + 連跑 2 次。
3. BUG-185 → FIXED。

## 不做

- 不改產品程式碼、不放寬斷言。

## 驗收

- [ ] 第 2 項通過、第 1 項不受影響（連跑 2 次）
- [ ] 突變檢查：拿掉 stub 會失敗
- [ ] `WIZARD_STUBS` 核對結果

## 回報區

### 完成狀態

- **狀態**：FIXED（BUG-185 修正完成，待塔台驗收 / 隨 D205 發版）
- **session_id**：b4720162-3235-4e2e-a6e0-7d8ee95aff50
- **產品 commit**：`f9072e16` test(e2e): T0751 stub wsl-systemd:snapshot-unit in t0512 wizard spec (BUG-185)

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`e2e/t0512-profile-panel-layout.spec.ts` 存在 → PASS；C-2：工單無 `branch` 欄位，目前 `main`
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 失敗原因確認

- 修正前跑 spec：第 1 項 PASS、第 2 項 FAIL（`remote-tool-claude` 30 s 內未出現）。頁面 alert「無法讀取目前的 BAT 服務」，詳細內容 `Could not read the current BAT service in E2E Fake before changing it: Invalid WSL distro name: E2E Fake`。
- 即 T0750 Worker 的判讀：`write-systemd-unit` 步驟（`src/components/setup-wizard/steps/wsl/write-systemd-unit.ts` `takeUnitSnapshot`）先呼叫 `wslSystemd.snapshotUnit` → `wsl-systemd:snapshot-unit`（T0554 新增）；`WIZARD_STUBS` 沒有它，真 handler（`electron/main.ts` → `wslSystemd.snapshotServiceUnit`）拒絕含空白的假 distro 名稱。屬測試缺 stub，不是產品缺陷。

### 修改內容（只改 `e2e/t0512-profile-panel-layout.spec.ts`）

1. 補 `'wsl-systemd:snapshot-unit': { ok: true, content: null, active: false, enabled: false }`：依 `electron/preload.ts` 的回傳型別 `{ ok: true; content: string | null; active: boolean; enabled: boolean }`；`content: null` = 沒有既有 unit（首次安裝），與其他 stub（`install-bundle` 不回 `previous`）一致，取消時 rollback 走既有的 `remove-unit`。
2. 另補 4 個 T0554 升級 / rollback 路徑的 channel（目前的 stub 值下走不到，補上讓 spec 註解「Every WSL wizard channel is stubbed」維持成立、任何路徑都不碰 wsl.exe）：`wsl:restore-bundle` `{ ok: true, outcome: 'missing' }`、`wsl:discard-previous-bundle` `{ ok: true }`、`wsl-systemd:restore-unit` `{ ok: true }`、`wsl-systemd:restart-service` `{ ok: true }`（回傳值皆依 preload 型別）。
3. 斷言未改（`listDisplay` = `flex`、`columns` = 1 照舊）；產品程式碼未動。

### `WIZARD_STUBS` 核對結果

以 `src/components/setup-wizard/steps/wsl/*.ts` 與 `src/components/setup-wizard/*.ts(x)` 所有 `window.electronAPI.*` 呼叫，對照 `electron/preload.ts` 的 channel：

| 精靈呼叫 | channel | 路徑 | 修正前 | 修正後 |
|---|---|---|---|---|
| `wsl.list` / `systemdEnabled` / `resolveHome` / `installBundle` / `detectNetworkMode` / `pickServerPort` / `keepAlive` / `fetchFingerprint` | `wsl:*` | 正常路徑 | 有 stub | 不變 |
| `remote.serverBundle.distribute` / `remote.testConnection` | `server-bundle:distribute` / `remote:test-connection` | 正常路徑 | 有 stub | 不變 |
| `wslSystemd.writeUnit` / `enableLinger` / `startService` | `wsl-systemd:*` | 正常路徑 | 有 stub | 不變 |
| **`wslSystemd.snapshotUnit`** | **`wsl-systemd:snapshot-unit`** | **正常路徑（T0554）** | **缺（BUG-185）** | **補上** |
| `wsl.uninstallBundle` / `wslSystemd.removeUnit` / `wsl.releaseKeepAlive` | rollback | 取消時 | 有 stub | 不變 |
| `wsl.restoreBundle` / `wsl.discardPreviousBundle` / `wslSystemd.restoreUnit` / `wslSystemd.restartService` | T0554 升級 / rollback | 僅 `previous: 'kept'` 或 snapshot 有 unit 時 | 缺（走不到） | 補上（防禦） |
| `profile.listLocal` / `create` / `update` / `delete` | `profile:*` | write-profile | 不 stub（spec 刻意用真 profile；distro 名含空白，keep-alive 同步會略過） | 不變 |
| `update.getVersion` | `update:get-version` | install-server-bundle | 不 stub（唯讀，不碰 WSL） | 不變 |
| `docker.status` | `docker:status` | 只限 `docker-linux` | 走不到 | 不變 |
| `shell.openExternal` | — | 使用者點連結 | 走不到 | 不變 |

除 `snapshot-unit` 外，正常路徑沒有其他落差。

### 驗證

| 項目 | 結果 |
|---|---|
| `npx vite build`（修改前、本單唯一一次 build；commit 後未再 build，D205） | ✅ exit 0 |
| 修正前重現 | 第 1 項 PASS、第 2 項 FAIL（alert「無法讀取目前的 BAT 服務」） |
| 修正後第 1 輪 | ✅ 2 passed（wide / narrow wizard tools `listDisplay: flex`、`columns: 1`） |
| 修正後第 2 輪 | ✅ 2 passed（同上） |
| 突變檢查：只拿掉 `snapshot-unit` stub、跑第 2 項 | ✅ 如預期 FAIL（`toBeVisible` 逾時；error-context 為同一句 `Could not read the current BAT service … Invalid WSL distro name: E2E Fake`）。之後以備份檔還原，`git diff` 確認與通過兩輪的內容相同，才 commit |
| `test:unit` | 未跑（只改 e2e 檔，工單指示不需要） |

- 驗證時的內容即 commit `f9072e16` 的內容（validated = committed）。
- 去識別化：本回報與 spec 不含使用者家目錄路徑、使用者名稱或主機名（log 中的 userData 路徑未抄入）。

### 相關通過案例判定

- 工單無〈相關通過案例〉節；只改 e2e 測試檔，產品行為不變。

### 發現的問題

1. （既有，未修，範圍外）spec 的 `'server-bundle:distribute'` stub 中 `tarballPath` 在原始碼裡寫成 `C:` + 單一反斜線 + `fake` + 單一反斜線 + `bat-server.tgz`：JS 字串把反斜線 + `f` 解讀成 form feed、反斜線 + `b` 解讀成 backspace，結果不是預期的路徑。下游 `wsl:install-bundle` 已 stub，不影響結果；要修可改成雙反斜線或 `/fake/bat-server.tgz`，建議塔台視需要併入他單。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 遭遇問題

- 無。

### 後續建議

- BUG-185 → FIXED（已改）；隨 D205 與 T0750 / T0752 一起發版後可 CLOSED。
