---
schema_version: 1
schema_kind: workorder
id: T0398
title: "BUG-102：PtyManager 的 UTF-8 locale env 依平台決定，不再對 Linux 寫死 en_US.UTF-8"
type: fix
status: DONE
started_at: "2026-10-05T01:38:17+08:00"
updated_at: "2026-10-05T01:42:22+08:00"
completed_at: "2026-10-05T01:42:22+08:00"
repo: better-agent-terminal
project: BUG-102
priority: P2
sizing: S
created_at: "2026-10-05T01:36:55+08:00"
target_version: next
depends_on: []
related:
  - "BUG-102（T0396 smoke 發現）"
  - "T0399（同批平行，e2e；只動 e2e/）"
affects_files:
  - electron/pty-manager.ts
  - electron/pty-locale-env.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得部署到 WSL、不得 restart `bat-server.service`**：修完由塔台以 `npm run deploy:headless:dev` 部署並跑 `npm run smoke:remote:headless` 驗證（需先徵得使用者同意，會中斷使用者的遠端終端）。"
  - "🔴 **不執行 `npx vite build`**：T0399 平行在跑 vite build + Playwright；build 由塔台複驗時跑。"
  - "🔴 child_process（若需探測 `locale -a`）一律 `execFile` + array args、timeout 5s、結果快取；禁用 shell-spawning exec API。探測失敗不可讓 PTY 建立失敗。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0398 — PTY locale env 依平台決定（BUG-102）

## 元資料
- **工單編號**：T0398
- **任務名稱**：BUG-102 修復
- **狀態**：DONE
- **建立時間**：2026-10-05 01:36 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`electron/pty-manager.ts`、`electron/pty-locale-env.ts`（新增，名稱可調整，回報區說明）、`electron/__tests__/`

## 背景

`electron/pty-manager.ts` 三個 spawn 路徑（:506 附近 terminal-server 路徑、:566 附近 direct、:647 附近 child_process fallback）組 `envWithUtf8` 時，**在 `...customEnv` 之後**寫死 `LANG` / `LC_ALL: 'en_US.UTF-8'`。

- WSL Ubuntu 24.04 預設只有 `C.UTF-8`，沒有 `en_US.UTF-8` ⇒ 每個遠端終端開頭印 `bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)`，locale 退回 `C`（T0396 smoke 實測，對象為 headless server，PtyManager 經 T0389 DI 共用）
- 寫在 `customEnv` 之後 ⇒ 使用者在設定裡自訂的 `LANG` 也會被蓋掉

## 範圍

1. 抽出單一 helper（例如 `electron/pty-locale-env.ts` 的 `resolvePtyLocaleEnv(...)`），三個路徑共用，消除三份重複
2. 決策規則（塔台指定，Worker 照做；有更好理由要偏離時在回報區說明）：
   - **win32**：維持現行行為（`LANG` / `LC_ALL=en_US.UTF-8`），避免 Git Bash / MSYS 既有行為回歸
   - **customEnv 優先**：使用者自訂的 `LANG` / `LC_ALL` / `LC_CTYPE` 一律不覆寫
   - **darwin**：維持 `en_US.UTF-8`（macOS 一律有，且無 `C.UTF-8`）
   - **linux**（含 WSL headless）：
     - 繼承的 `LANG` 已是 UTF-8 且可用 → 沿用
     - 否則依序挑第一個可用：`C.UTF-8` → `en_US.UTF-8`（以 `locale -a` 探測，結果快取，比對時忽略大小寫與 `utf8` / `UTF-8` 寫法差異）
     - 探測失敗 → `C.UTF-8`
     - **不設 `LC_ALL`**（除非 customEnv 指定），只設 `LANG`，讓使用者 shell 的 `LC_*` 設定仍有效
3. `PYTHONIOENCODING` / `PYTHONUTF8` / `TERM*` 等其他 env 不動

## 驗收條件

- [ ] unit：helper 依 platform × 繼承 env × customEnv × `locale -a` 結果（含失敗）的矩陣測試；win32 與 darwin 的輸出與修改前完全相同
- [ ] unit：三個 spawn 路徑都改走 helper（可用既有 PtyManager 測試的 spawn mock 斷言 env）
- [ ] `npm run test:unit` 全綠（基線 1141）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附「修改前 / 修改後」三平台 env 對照表

## Sub-session 執行指示

1. 讀本工單 + BUG-102 + `electron/pty-manager.ts` 三處 env 組裝 + 既有 `electron/__tests__/` 中 PtyManager 相關測試
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不要寫 `FIXED`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
✅ DONE（unit / tsc 驗收全過；runtime WSL smoke 依 memory_overrides 留給塔台 `deploy:headless:dev` + `smoke:remote:headless`）

**Landing Zone Check**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`electron/pty-manager.ts` present、`electron/pty-locale-env.ts` 新檔（祖先 `electron/` present）、`electron/__tests__/` present → informational PASS
- C-2：工單無 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=on`、`CT_INTERACTIVE=0`

### 產出摘要

**新增 `electron/pty-locale-env.ts`**（名稱沿用工單建議）
- `resolvePtyLocaleEnv({ platform, inheritedEnv, customEnv, listLocales? })` → 回傳要 spread 在 `customEnv` **之後**的 locale entries；customEnv 已設的 key 一律不回傳，所以 spread 位置不變也不會蓋掉使用者設定
- `createCachedLocaleLister(run?)`：`execFileSync('locale', ['-a'])` + array args、`timeout: 5000`、`stdio` 丟棄 stderr、結果（含失敗 = `null`）per-process 快取一次；失敗只 `logger.warn` 一次，**不 throw、不影響 PTY 建立**。只有 linux 分支、且 customEnv 未設 `LANG` 時才觸發探測
- 比對正規化：`trim().toLowerCase()` + `.utf-8` → `.utf8`；UTF-8 判斷 `/\.utf-?8(@|$)/i`

**`electron/pty-manager.ts`**
- 新 private `localeEnv(customEnv)`（與既有 `helperDirEnv()` 同 idiom），三個 spawn 路徑（Terminal Server :515、node-pty :575、child_process fallback :655）的寫死 `LANG` / `LC_ALL: 'en_US.UTF-8'` 改為 `...this.localeEnv(customEnv)`，位置不變
- 傳給 helper 的 `inheritedEnv` 是 `this.inheritedEnv()`（已套 T0390 `dropInheritedEnv` filter）
- `PYTHONIOENCODING` / `PYTHONUTF8` / `TERM*` 等其他 env 未動

**測試（+36）**
- `electron/__tests__/pty-locale-env.test.ts`（33）：win32 / darwin × 繼承 env 4 種（無 / UTF-8 / 非 UTF-8 / 繼承 LC_ALL）輸出 = 修改前、不觸發探測；customEnv `LANG` / `LC_ALL` / `LC_CTYPE` 各自不被覆寫；linux 11 列決策矩陣（含 WSL Ubuntu 24.04 實測清單、`utf8`/`UTF-8` 與大小寫等價、非 UTF-8 繼承、只有 en_US、兩者皆無、空清單）、探測失敗 2 列、不設 `LC_ALL`、customEnv 優先且跳過探測；`createCachedLocaleLister` 解析 / 快取 / 失敗快取 + 只 warn 一次
- `electron/__tests__/pty-manager-locale-env.test.ts`（3）：mock `../pty-locale-env` 回 sentinel，斷言三路徑的 spawn env 都含 sentinel、無寫死 `LC_ALL`、customEnv 照傳、helper 收到的 `inheritedEnv` 已過 drop filter。node-pty 由 pty-manager 以原生 `require` 載入（vi.mock 攔不到），故在 dynamic import pty-manager 前把 fake 塞進 `require.cache`；fallback 路徑以 fake `pty.spawn` throw 一次觸發

**偏離 / 解讀說明**
1. **「customEnv 優先」套用到所有平台**（包含 win32 / darwin）：工單驗收寫「win32 與 darwin 的輸出與修改前完全相同」，我解讀為「customEnv 未設 locale key 時」完全相同（已有測試鎖住）；customEnv 有設時改為尊重使用者值 —— 這正是背景第 2 點要修的行為
2. win32 / darwin：customEnv 設了 `LANG` / `LC_ALL` / `LC_CTYPE` 任一時**不注入 `LC_ALL`**（`LC_ALL` 會覆蓋使用者的 `LC_CTYPE` / `LANG`，等於仍在覆寫）；`LANG` 只在 customEnv 未設 `LANG` 時注入
3. linux 探測失敗時，即使繼承的 `LANG` 是 UTF-8 也照工單規則改 `C.UTF-8`（無法驗證可用；最常見失敗場景是精簡容器，那裡繼承的 `en_US.UTF-8` 往往正是不存在的那個）
4. 探測用 `execFileSync` 而非 async `execFile`：`create()` 是同步 API，且每個 process 只跑一次、僅 linux；仍為 execFile 家族 + array args + 5s timeout + 快取，無 shell
5. 非 win32 / darwin / linux 平台（freebsd 等）走 win32/darwin 分支，即維持修改前輸出

### env 對照表

假設 customEnv 未設 locale key（設了的話三平台皆一律保留使用者值，見偏離 1-2）：

| 平台 | 修改前 | 修改後 |
|------|--------|--------|
| win32 | `LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8` | **相同**（`LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8`） |
| darwin | `LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8` | **相同**（`LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8`） |
| linux（WSL Ubuntu 24.04 headless，繼承 `LANG=C.UTF-8`） | `LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8` → bash `setlocale` 警告、退回 `C` | `LANG=C.UTF-8`（繼承值沿用）；不設 `LC_ALL` |
| linux（無 / 非 UTF-8 繼承 `LANG`，有 C.UTF-8） | 同上 | `LANG=C.UTF-8`；不設 `LC_ALL` |
| linux（繼承 `LANG=zh_TW.UTF-8` 且已安裝） | 同上（使用者語系被蓋） | `LANG=zh_TW.UTF-8`；不設 `LC_ALL` |
| linux（只有 en_US.UTF-8，無 C.UTF-8） | 同上 | `LANG=en_US.UTF-8`；不設 `LC_ALL` |
| linux（`locale -a` 失敗 / 兩者皆無） | 同上 | `LANG=C.UTF-8`；不設 `LC_ALL` |

WSL 實測佐證（唯讀，未部署）：`wsl -d Ubuntu-24.04 -- locale -a` → `C` / `C.utf8` / `POSIX`；login shell `LANG=C.UTF-8`、`LC_ALL` 空 —— 與測試 fixture `WSL_UBUNTU_2404` 一致。

### 驗證

| 證據道 | 結果 | 內容 |
|--------|------|------|
| unit（新增） | PASS | `npx vitest run electron/__tests__/pty-locale-env.test.ts electron/__tests__/pty-manager-locale-env.test.ts` → 2 files / 36 tests passed |
| unit（全量） | PASS | `npm run test:unit` → 81 files / **1177** passed（基線 1141 + 36） |
| tsc | PASS | `npx tsc --noEmit` → **40** errors（= 上限 40；新檔與 pty-manager 0 筆） |
| vite build | 未跑（依 memory_overrides，T0399 平行使用；塔台複驗時跑） | — |
| runtime（WSL headless smoke） | 未跑（依 memory_overrides，需塔台徵得使用者同意後 `npm run deploy:headless:dev` + `npm run smoke:remote:headless`） | 預期：首段輸出不再有 `setlocale: LC_ALL` 警告 |

### Commit
見本工單 commit（`git commit --only electron/pty-manager.ts electron/pty-locale-env.ts electron/__tests__/pty-locale-env.test.ts electron/__tests__/pty-manager-locale-env.test.ts _ct-workorders/T0398-pty-locale-env-per-platform.md`）；未 push。工作區內 T0399 的 `e2e/*` 與其工單改動未納入。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. node-pty 以原生 `require` 載入，`vi.mock` 無法攔截 → 測試改用 `require.cache` 預先植入 fake 再 dynamic import（見產出摘要）
2. **殘留風險（未修，範圍外）**：linux 若**繼承**的 `LC_ALL` / `LC_CTYPE` 本身指向未安裝 locale（例如 SSH `SendEnv LC_*` 從 client 帶來 `en_US.UTF-8`），本修復不再用寫死的 `LC_ALL` 蓋掉它，該 shell 仍可能出 setlocale 警告。這屬使用者環境設定；修改前是被寫死值遮住（但寫死值本身在 WSL 也無效）。若塔台認為要處理，建議另開工單決定是否清除不可用的繼承 `LC_*`
3. Electron 桌面 Linux 行為改變（預期內）：不再強制 `LC_ALL=en_US.UTF-8`，使用者 shell 的 `LC_*` 與繼承的 UTF-8 `LANG` 會生效

### 回報時間
2026-10-05T01:42:09+08:00
