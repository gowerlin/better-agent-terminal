---
schema_version: 1
schema_kind: workorder
id: T0410
title: "PLAN-037 D：RemoteToolsPanel + InstallConfirmDialog + i18n（API 以注入方式取得，先不接 preload）"
type: impl
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T03:10:44+08:00"
started_at: "2026-10-05T03:12:18+08:00"
updated_at: "2026-10-05T03:12:18+08:00"
target_version: next
depends_on:
  - T0408
  - T0409
related:
  - "T0407 回報區 §5 UI 整合、§6 確認框內容；T0408 / T0409 回報區「給後續工單的備註」"
  - "D133 波次；T0411（同批平行，提供 preload API）"
affects_files:
  - src/components/remote-tools/
  - src/components/__tests__/
  - src/styles/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/locales/__tests__/i18n-completeness.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 T0411 平行中：不得碰 `electron/`、`src/types/electron.d.ts`、`electron/preload.ts`。面板以 props 注入 `detect()` 與 `onInstall(plan)` 等回呼，**不直接呼叫 `window.electronAPI`**；接上 preload 是 T0412 / T0413 的事。"
  - "🔴 不得修改 `src/types/remote-tools.ts`、`src/lib/remote-tools/*`（T0408 / T0409 擁有）；需要調整時在回報區提出。"
  - "🔴 不得把 report 的 `version` / `path` 等字串插進任何指令；指令一律來自 `buildInstallPlan()`。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0410 — RemoteToolsPanel + 確認框（PLAN-037 D）

## 元資料
- **工單編號**：T0410
- **任務名稱**：remote-tools 面板 UI
- **狀態**：IN_PROGRESS
- **建立時間**：2026-10-05 03:10 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0408（型別 / probe / parse）與 T0409（`buildInstallPlan` / `buildUpdatePlan` / sentinel）已完成。本單做純 UI，之後由 T0413 放進精靈完成區塊與 `ProfileCard.expandedExtras`、由 T0412 接上實際安裝執行。**規格以 T0407 §5 / §6 為準。**

## 範圍

1. `src/components/remote-tools/RemoteToolsPanel.tsx`
   - props（建議）：`{ host: 'wizard' | 'profile' | 'remote-window', detect: () => Promise<RemoteToolsDetectResult>, onInstall?: (plan: InstallPlan) => void, onLogin?: (toolId) => void }`
   - 依 `remoteToolTier()` 分組（必要 / 建議 / 可選；rg 在 musl 上升為必要）；每列：狀態、路徑、版本、登入狀態、server PATH 可見性
   - 操作：「重新檢查」、「安裝」（由 `buildInstallPlan(toolId, env)` 產生；unsupported 時顯示原因與 docs 連結）、claude「更新」（`buildUpdatePlan`，`too-old` 時強調）
   - 狀態特別處理：`interop-only`（說明是 Windows 版遮蔽，安裝 Linux 版）、`not-on-path`（提示開新終端分頁）、`curl` missing 時停用 install.sh 類（claude / codex / uv）並提示
   - 登入：只顯示狀態；`onLogin` 存在時給按鈕（實際引導用 T0402 的流程，由上層接）。macOS 上 `credentialFilePresent: false` 不代表未登入，以 `login` 為準
   - 錯誤狀態：`host-platform`、`spawn-failed`、`timeout`、`no-markers`、舊 server（T0411 會提供可辨識的 errorCode；先以 `unsupportedRemoteChannel()` 的既有判斷處理）
2. `src/components/remote-tools/InstallConfirmDialog.tsx`：顯示完整指令（可複製）、官方文件 URL、腳本 URL（「檢視腳本內容」連結）、是否需 sudo、安裝位置、完整性說明、`unofficial` 警示、prerequisites；按「確認」才呼叫 `onInstall(plan)`。URL 以外部瀏覽器開啟的方式沿用 repo 既有作法（若需要 electronAPI，改以 prop 注入）
3. i18n：`remoteTools.*`（三語），涵蓋 T0409 的 `INTEGRITY_KEYS` / `LOCATION_KEYS` / `NOTE_KEYS`、`remoteTools.unsupported.<reason>`（`UNSUPPORTED_REASONS`）、狀態 / 分級 / 工具名稱 / 確認框；擴充 `i18n-completeness.test.ts` 檢查 `remoteTools.*` 與上述 key 集合一一對應
4. 樣式：沿用既有 CSS 變數

## 驗收條件

- [ ] 元件測試（以 fixture report：T0408 的 WSL 實測、Alpine root、macOS、全未裝、舊 server 錯誤）：分組、各狀態文案、curl missing 停用、interop 說明、unsupported 原因
- [ ] 確認框測試：顯示的指令與 `buildInstallPlan` 完全相同；取消不呼叫 `onInstall`；unofficial 警示
- [ ] i18n completeness 涵蓋新 key
- [ ] `npm run test:unit` 全綠（基線 1442）；`npx tsc --noEmit` ≤ 40；**不跑 `npx vite build`**（T0411 平行跑 build + e2e，同時 build 會互相覆寫輸出；由塔台複驗時跑）
- [ ] 回報區附元件 props 介面（給 T0412 / T0413）

## Sub-session 執行指示
1. 讀本工單 + T0407 §5 / §6 + T0408 / T0409 回報區 + `src/types/remote-tools.ts`、`src/lib/remote-tools/*`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 5 項驗收全部 PASS（純 UI，未接 preload、未放進任何畫面）。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3（資訊性）：可測 6 項皆 present（`src/components/remote-tools/` → 最近祖先 `src/components/`；其餘 5 項本身存在）
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=0`

**驗收**

| # | 項目 | 結果 | 證據 |
|---|------|------|------|
| 1 | 元件測試（5 組 fixture） | ✅ PASS | `src/components/__tests__/remote-tools-panel.test.tsx` 41 項：<br>• WSL（T0408 實測值）：分組順序、列內容、codex `interop-only` 說明 + 可裝 Linux 版、node `no-recipe` + nodejs.org 連結、無 `onInstall` 不出按鈕、重新檢查<br>• Alpine root：rg 升為必要、curl 缺但 apk 食譜自帶 curl ⇒ 不停用、gh 確認框顯示 unofficial 警示<br>• macOS：claude 更新鈕（非強調）、Keychain ⇒ 不顯示「無認證檔」、codex 登入鈕呼叫 `onLogin('codex')`、`not-on-path` 提示、server 視角不可用時只顯示一次說明、`brew install gh`<br>• 全未裝（Debian slim root）：curl 缺 ⇒ claude / codex / uv 安裝鈕停用 + 提示；git 不帶 sudo<br>• 舊 server：throw `No handler for channel` 與包在 result 裡兩種都顯示「請重新部署」；4 個 errorCode 各自文案 + detail；未知 errorCode ⇒ 通用失敗；舊請求結果不覆寫新結果<br>• 其他：claude `too-old` 強調更新 + 提示、`error` 狀態、`sudo-missing` ⇒ `needs-root-no-sudo`、竄改 env ⇒ 停用安裝並顯示錯誤、auth 環境變數只列名稱 |
| 2 | 確認框測試 | ✅ PASS | 同檔：顯示的指令 `textContent` 與 `buildInstallPlan(...).command` 完全相同（claude、gh apt 長指令）；確認後 `onInstall` 收到與 `buildInstallPlan` deep-equal 的 plan；取消 / Escape / 點遮罩皆不呼叫 `onInstall`；unofficial 警示；docs / 腳本連結、完整性、位置、sudo、notes、prerequisites、複製鈕、host 文案 |
| 3 | i18n completeness | ✅ PASS | `i18n-completeness.test.ts` 新增 4 項：三語 `remoteTools.*` 攤平後的 key 集合與預期集合**完全相等**（預期集合 = UI key 清單 + `INTEGRITY_KEYS` / `LOCATION_KEYS` / `NOTE_KEYS` + `UNSUPPORTED_REASONS` / tier / tool id / status / login（不含 `n/a`）/ privilege / `REMOTE_TOOLS_DETECT_ERROR_CODES` 各自展開），且每個值為非空字串 |
| 4 | test:unit / tsc | ✅ PASS | • `npm run test:unit`：100 files、**1514 passed**、1 skipped。本單 +45（元件 41 + i18n 4）；其餘差額是工作目錄中 T0411 尚未 commit 的測試（`electron/__tests__/remote-tools-handlers.test.ts`、`electron/remote/__tests__/headless-remote-tools.test.ts` 等）<br>• `npx tsc --noEmit`：**40**（= 基線），新檔 0 筆<br>• 依工單**未跑** `npx vite build` |
| 5 | 回報區附 props 介面 | ✅ PASS | 見下方「元件 props 介面」 |

> runtime smoke：本單元件尚未放進任何畫面（T0413），無法在實際 app 中觀察，僅有 jsdom 測試。

### 產出摘要

**新檔**
| 檔案 | 內容 |
|------|------|
| `src/components/remote-tools/RemoteToolsPanel.tsx` | 面板：掛載即 `detect()`、重新檢查；依 `remoteToolTier()` 分 4 組（必要 / 建議 / 可選 / 前置條件，空組不顯示）；每列：名稱、狀態、版本、登入（只對 claude / codex / gh 且非 `n/a`）、server 可見性、路徑、提示與操作；環境摘要列（os / arch / WSL / musl / 套件管理器 / 權限 / 已設定的 auth 變數名稱） |
| `src/components/remote-tools/tool-actions.ts` | 純函式 `toolAction(tool, env, curlUsable)` → `none` / `install` / `update` / `unsupported`；`isCurlUsable(report)` |
| `src/components/remote-tools/InstallConfirmDialog.tsx` | 確認框：完整指令（原樣、可複製）、prerequisites、是否需 sudo、安裝位置 + 路徑、完整性 + 「腳本未釘雜湊」誠實說明、官方文件 / 檢視腳本連結、unofficial 警示、notes、在哪裡執行（依 host）；只有「確認」鈕呼叫 `onConfirm(plan)`；Escape / 遮罩 / 取消皆走 `onCancel` |
| `src/components/remote-tools/ExternalLink.tsx` | `<a target="_blank" rel="noopener noreferrer">`；有注入 `onOpenUrl` 時改呼叫它。不碰 `window.electronAPI`：`target="_blank"` 由 `main.ts` 既有的 `setWindowOpenHandler` → `shell.openExternal` 處理 |
| `src/styles/remote-tools.css` | 只用既有 CSS 變數；確認框延伸共用的 `.dialog` / `.dialog-actions` / `.dialog-btn`（`panels.css`）。由 `RemoteToolsPanel.tsx` 直接 import（比照 `GitHubPanel.tsx`），因此**不需改 `main.tsx`** |
| `src/components/__tests__/remote-tools-panel.test.tsx` | 41 項 |

**修改**
- `src/locales/{en,zh-TW,zh-CN}.json`：各新增 `remoteTools` 一個區塊（各 +151 行，純新增，其他內容 byte 不變）
- `src/locales/__tests__/i18n-completeness.test.ts`：新增 `remoteTools.*` 一一對應檢查

**操作規則（`toolAction`）**
| 狀態 | 操作 |
|------|------|
| claude `ok` / `too-old` | 「更新」= `buildUpdatePlan('claude')`；`too-old` 時按鈕強調 + 提示 |
| `missing` / `interop-only` | 「安裝」= `buildInstallPlan(id, env)`；unsupported ⇒ 顯示 `remoteTools.unsupported.<reason>` + docs 連結（有的話） |
| `not-on-path` / `error` / 其他 `ok` | 不給按鈕，只顯示提示 |
| curl 不是 `ok` 且食譜有 `scriptUrl` 且 `pkgManager !== 'apk'` | 安裝鈕停用 + `remoteTools.hint.curlMissing`（apk 食譜會自己 `apk add curl`） |

**安全**
- 指令與 URL 一律取自 `buildInstallPlan()` / `buildUpdatePlan()` 回傳的 plan；report 的 `path` / `version` / `osId` 等字串只當 React 文字節點顯示（自動跳脫），不進任何指令。
- report 的 env 先過 `normalizeRecipeEnv()`；不合法（server 被竄改或格式錯）⇒ 顯示 `remoteTools.error.invalidReport`，所有安裝 / 更新鈕都不出現。
- 面板只在確認框按「確認」時把 plan 交給 `onInstall`。

### 元件 props 介面

```ts
// src/components/remote-tools/RemoteToolsPanel.tsx
export type RemoteToolsPanelHost = 'wizard' | 'profile' | 'remote-window'

export interface RemoteToolsPanelProps {
  /** 決定確認框的「在哪裡執行」文案：remote-window ⇒ 本視窗新分頁；其他 ⇒ 開遠端 profile 視窗 */
  host: RemoteToolsPanelHost
  /** 掛載時與「重新檢查」時呼叫。換一個 detect（新 identity）會重新偵測，舊請求結果被丟棄 */
  detect: () => Promise<RemoteToolsDetectResult>
  /** 確認後收到 plan（T0412 執行）。不傳 ⇒ 不顯示安裝 / 更新鈕（T0413 在 E 未完成前可先不傳） */
  onInstall?: (plan: InstallPlan) => void
  /** 登入流程（T0402）。不傳 ⇒ 只顯示登入狀態 */
  onLogin?: (toolId: RemoteToolWithLogin) => void   // 'claude' | 'codex' | 'gh'
  /** 開 docs / 腳本連結；不傳 ⇒ <a target="_blank">（setWindowOpenHandler → shell.openExternal） */
  onOpenUrl?: (url: string) => void
  /** 確認框的複製；不傳 ⇒ navigator.clipboard.writeText */
  copyText?: (text: string) => Promise<void> | void
}

// src/components/remote-tools/InstallConfirmDialog.tsx（面板內部使用；也可單獨使用）
export interface InstallConfirmDialogProps {
  plan: InstallPlan
  host: RemoteToolsPanelHost
  onConfirm(plan: InstallPlan): void
  onCancel(): void
  onOpenUrl?: (url: string) => void
  copyText?: (text: string) => Promise<void> | void
}
```

**接線建議**
- **T0413**：精靈 / ProfileCard 傳 `detect={() => window.electronAPI.remote.detectTools(profileId)}`（以 T0411 實際 API 名為準），用 `useCallback` 固定 identity，避免每次 render 重新偵測。
- **T0412**：`onInstall(plan)` 收到後 `wrapWithSentinel(plan.command, generateNonce())`；完成後重新偵測可由上層換一個 `detect` identity 或改 `key` 重掛面板（面板本身沒有對外的 refresh handle）。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. **與 T0411 的耦合（commit 時序）**：T0411 平行中，在 `src/types/remote-tools.ts`（工作目錄，未 commit）的 `REMOTE_TOOLS_DETECT_ERROR_CODES` 新增了 `invalid-profile` / `connect-failed` / `server-too-old` / `invoke-failed`。本單的 i18n 一一對應測試由該常數展開，三語已含這 8 個 code 的文案。
   - ⇒ 若只看本單 commit（T0411 型別尚未 commit 時），`i18n-completeness` 的 `remoteTools` 一一對應會因 4 個多出的 `remoteTools.error.*` 失敗；兩單都 commit 後即一致。**塔台複驗請在兩單都 commit 後跑 `npm run test:unit`。**
   - 若 T0411 最終改名或撤回這些 code，需同步改三語的 `remoteTools.error.*`（測試會指出差異）。
   - 本單**沒有**修改 `src/types/remote-tools.ts`。
2. **偏離 T0407 §5 的 key 名**：舊 server 文案改用 `remoteTools.error.server-too-old`（與 T0411 的 errorCode 同名），不另設 `remoteTools.serverTooOld`。面板對「throw `No handler for channel`」、「result.error 含該字串」、「errorCode = `server-too-old`」三種情況都顯示這則。
3. **分組多一組「前置條件」**：`REMOTE_TOOL_TIERS` 含 `prerequisite`（curl / bash），工單只寫必要 / 建議 / 可選三組；照型別多顯示一組，排最後。
4. **`error` 狀態不給安裝鈕**：binary 在 PATH 上但 `--version` 沒輸出；裝到 `~/.local/bin` 不一定能蓋過，所以只顯示提示。
5. **確認框的確認鈕文字與列上的「安裝」相同**：測試以 `within(dialog)` 區分；若 UX 覺得易混，可改 `remoteTools.confirm.confirmInstall` 的文案（例如「確認安裝」）。
6. ESLint：專案沒有 eslint 設定，未跑。

### 回報時間
2026-10-05T03:19:55+08:00
