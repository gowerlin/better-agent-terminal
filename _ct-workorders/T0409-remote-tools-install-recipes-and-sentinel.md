---
schema_version: 1
schema_kind: workorder
id: T0409
title: "PLAN-037 C：安裝食譜（tool × pkgManager × 權限 × musl → InstallPlan）+ 完成標記 wrap / match + 來源 host 白名單"
type: impl
status: DONE
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T02:51:49+08:00"
started_at: "2026-10-05T02:53:32+08:00"
updated_at: "2026-10-05T03:01:09+08:00"
completed_at: "2026-10-05T03:01:09+08:00"
target_version: next
depends_on:
  - T0407
related:
  - "T0407 回報區 §2 官方安裝方式表、§4 完成標記、§6 安全（本單規格來源）"
  - "T0408（同批平行；提供 `src/types/remote-tools.ts`）"
  - "D133"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/sentinel.ts
  - src/lib/remote-tools/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只做純邏輯**：不改 `electron/`、元件、locales；不接線。"
  - "🔴 型別以 T0408 的 `src/types/remote-tools.ts` 為準；若 T0408 尚未 commit，先在本單檔內宣告最小必要的本地型別並在回報區標註，**不要自己建立或修改 `src/types/remote-tools.ts`**（T0408 擁有該檔）。"
  - "🔴 **偵測結果只能映射成 enum**（pkgManager / privilege / musl / os family）：版本、路徑等字串**絕不**插進產出的指令。"
  - "🔴 不在任何機器上實際執行安裝指令。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0409 — 安裝食譜 + 完成標記（PLAN-037 C）

## 元資料
- **工單編號**：T0409
- **任務名稱**：remote-tools recipes + sentinel
- **狀態**：DONE
- **建立時間**：2026-10-05 02:51 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

使用者裁決（T0407 Q2 / Q3）：安裝前顯示**確認框**（完整指令、官方文件 URL、腳本 URL、是否需 sudo、安裝位置、完整性機制、非官方來源警示），確認後在遠端終端分頁打入並送出；**使用者空間優先**（claude / codex / uv 用官方 install.sh 裝 `~/.local/bin`，免 sudo），git / gh / rg 走發行版套件管理器（gh 用官方簽章 repo）。指令尾端附完成標記，偵測到標記即重新偵測。**完整規格以 T0407 回報區 §2 / §4 / §6 為準。**

## 範圍

1. `src/lib/remote-tools/recipes.ts`
   - `buildInstallPlan(toolId, env)` → `InstallPlan | { unsupported: reason }`；`env` 只含 enum（pkgManager、privilege、musl、osFamily）
   - `InstallPlan`：`command`（單行或以 `&&` 串接）、`needsSudo`、`installLocation`、`docsUrl`、`scriptUrl?`、`integrity`（說明文字 key，供 i18n）、`unofficial?`（Alpine gh）、`prerequisites?`（Alpine claude 需先 `apk add bash curl libgcc libstdc++ ripgrep`）
   - 權限處理：`root` ⇒ 去掉 `sudo` 前綴；`sudo-missing` 且需要 root ⇒ unsupported；`password-required` ⇒ 照常帶 sudo（使用者在分頁輸入）
   - macOS 無 brew 時 git 只給手動指引（unsupported + reason）
   - 更新食譜：claude `claude update`
   - 常數表中所有 URL 的 host 僅限白名單：`claude.ai`、`code.claude.com`、`chatgpt.com`、`github.com`、`cli.github.com`、`astral.sh`、`docs.astral.sh`、`git-scm.com`、`nodejs.org`（docs 用）；以測試守門
2. `src/lib/remote-tools/sentinel.ts`
   - `wrapWithSentinel(command, nonce)`：附加 `; printf '\n__BAT_TOOL_DONE_%s_%s__\n' '<nonce>' "$?"`；`nonce` 必須符合 `^[0-9a-f]{16}$`，否則 throw
   - `createSentinelMatcher(nonce)`：餵入 pty output chunk（可跨 chunk、含 ANSI），偵測到 `__BAT_TOOL_DONE_<nonce>_<code>__` 回傳 exit code；**終端回顯的 printf 格式字串不得被誤判**
   - `generateNonce()`（crypto random 16 hex）

## 驗收條件

- [ ] 食譜矩陣測試：每個工具 × {apt, dnf, apk, brew, none} × {root, passwordless, password-required, sudo-missing} × musl 的預期結果（可用 snapshot，但關鍵案例要有明確斷言：root 去 sudo、Alpine claude 前置、Alpine gh unofficial、macOS 無 brew 的 git unsupported）
- [ ] 安全測試：URL host 白名單；以惡意 env（非 enum 值、含 `;` / `$(` 的字串）呼叫時 throw 或 unsupported，產出指令不含任何來自輸入的字串
- [ ] sentinel 測試：跨 chunk、ANSI 夾雜、回顯的格式字串不誤判、錯 nonce 不匹配、exit code 0 / 非 0 / 多位數
- [ ] `npm run test:unit` 全綠（基線 1309）；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + **T0407 回報區 §2 / §4 / §6** +（若已存在）`src/types/remote-tools.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 4 項驗收條件全部 PASS（純邏輯，不接線）。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3：3 個 entry 皆不存在，但最近的上層目錄 `src/lib/` 存在 ⇒ present（本單新建 `src/lib/remote-tools/`）
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE` / `CT_INTERACTIVE` 未設定，依 `mode_hint: on`、`interactive: false`

### 產出摘要

**新檔**
| 檔案 | 內容 |
|------|------|
| `src/lib/remote-tools/recipes.ts` | `buildInstallPlan(toolId, env)` / `buildUpdatePlan(toolId, env)` → `InstallPlan \| { unsupported, docsUrl? }`；`normalizeRecipeEnv()`；`ALLOWED_URL_HOSTS`；i18n key 常數 `INTEGRITY_KEYS` / `LOCATION_KEYS` / `NOTE_KEYS` / `UNSUPPORTED_REASONS`（供 T0410 補三語與 completeness 測試） |
| `src/lib/remote-tools/sentinel.ts` | `wrapWithSentinel(command, nonce)`、`createSentinelMatcher(nonce)`（`feed(chunk)` → exit code \| null，`exitCode` getter）、`generateNonce()`（Web Crypto `getRandomValues`，renderer / Node 都可用）、`stripAnsi()`、`SENTINEL_PREFIX` / `SENTINEL_NONCE_RE` |
| `src/lib/remote-tools/__tests__/recipes.test.ts` | 24 項 |
| `src/lib/remote-tools/__tests__/sentinel.test.ts` | 14 項 |
| `src/lib/remote-tools/__tests__/__snapshots__/recipes.test.ts.snap` | Linux 矩陣快照（10 工具 × 6 pkgManager × 4 權限，apk 時 musl=true，共 240 行） |

**型別**：T0408 已於執行中 commit `src/types/remote-tools.ts`（`ab30fff`），本單**直接引用**其 `REMOTE_TOOL_IDS` / `REMOTE_PKG_MANAGERS` / `REMOTE_PRIVILEGES` / `REMOTE_OS_FAMILIES` 與型別，`RecipeEnv = Pick<RemoteToolsEnv, 'osFamily' | 'pkgManager' | 'privilege' | 'musl'>`。沒有本地型別宣告，也沒有改動該檔。`osFamily` 依 T0408 為 `linux | darwin | unknown`。

**InstallPlan 欄位**：`toolId`、`kind`（`install` / `update`）、`command`（單行，**已含** prerequisites，以 `&&` 串接）、`needsSudo`、`installLocation`（i18n key）、`installPath?`（如 `~/.local/bin/claude`）、`docsUrl`、`scriptUrl?`、`integrity`（i18n key）、`unofficial?`、`prerequisites?`（另列給確認框顯示）、`notes?`（i18n key）。

**食譜摘要**
| 工具 | apt | dnf / yum | apk | brew | none |
|------|-----|-----------|-----|------|------|
| claude | `curl -fsSL https://claude.ai/install.sh \| bash -s stable` | 同左 | `[sudo ]apk add bash curl libgcc libstdc++ ripgrep && <install.sh>` + note `alpineUseSystemRipgrep` | install.sh | install.sh（musl 且非 apk ⇒ `musl-without-apk`） |
| codex | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` | 同左 | `[sudo ]apk add curl && <install.sh>` | install.sh | install.sh |
| uv | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | 同左 | `[sudo ]apk add curl && <install.sh>` | install.sh | install.sh |
| git | `apt-get update && apt-get install -y git` | `dnf/yum install -y git` | `apk add git` | `brew install git` | darwin ⇒ `manual-only`（git-scm.com/install/mac）；其他 ⇒ `no-package-manager` |
| gh | 官方 keyring + signed apt repo（`integrity: ghRepoGpg`） | 直接放 `gh-cli.repo` 再 `install -y gh` | `apk add github-cli`，`unofficial: true` | `brew install gh` | `no-package-manager` |
| rg | `apt-get install -y ripgrep` | 同上 + note `rgNeedsEpel` | `apk add ripgrep` | `brew install ripgrep` | `no-package-manager` |
| node | `no-recipe` + docsUrl nodejs.org（v1 不給按鈕） | | | | |
| curl / bash / python3 | `no-recipe` | | | | |

權限：`root` ⇒ 去掉所有 `sudo`；`passwordless` / `password-required` ⇒ 帶 `sudo`（`needsSudo: true`）；`sudo-missing` 且需 root ⇒ `needs-root-no-sudo`；install.sh 類在任何權限都不需要 sudo。brew 遇 `root` ⇒ `brew-as-root`。
更新：`buildUpdatePlan('claude')` ⇒ `claude update`；其他工具 `no-recipe`。

**安全**
- `normalizeRecipeEnv()` 只複製 4 個 enum 欄位，非 enum 值（含 `;`、`$(`、反引號、大小寫變體、前後空白、`__proto__` / `toString`）一律 throw `TypeError`，錯誤訊息**不回顯**輸入值；`musl` 必須是 boolean。
- 物件上的額外欄位（`version` / `path` / `id` 帶惡意字串）不會被讀取：產出與乾淨 env 完全相同，測試斷言輸出不含這些字串。
- URL 白名單雙重守門：① 全矩陣（10 工具 × 3 os × 6 pm × 4 權限 × 2 musl × install/update = 2880 組）產出的所有 URL；② 直接掃 `recipes.ts` 原始碼中的所有 URL 字面值。皆須 `https://` 且 host ∈ `ALLOWED_URL_HOSTS`。

**完成標記**
- `wrapWithSentinel` 產出 `<cmd>; printf '\n__BAT_TOOL_DONE_%s_%s__\n' '<nonce>' "$?"`；nonce 不符 `^[0-9a-f]{16}$` ⇒ throw。另拒絕多行（`\r` / `\n`，會提早送出）、空字串、以 `;` / `&` / `|` 結尾的指令（會造成 shell 語法錯誤）。
- matcher：保留最多 4096 字元的原始輸出尾段，每個 chunk 進來後對整段重新去 ANSI 再比對，因此標記本身或 ANSI 序列被切在 chunk 邊界都能正確拼回。只接受 `\d{1,3}` 且 ≤ 255；只回報一次。

### 驗收證據
| 驗收條件 | 結果 | 證據 |
|----------|------|------|
| 食譜矩陣測試 + 關鍵案例 | PASS | root 去 sudo、Alpine claude 前置、Alpine gh unofficial、macOS 無 brew 的 git `manual-only` 皆有明確斷言；全矩陣不變式（`needsSudo` ⇔ 指令含 `sudo`、root / sudo-missing 永不出現 sudo、key 都在匯出清單內、prerequisites 是 command 前綴）+ Linux 快照 |
| 安全測試 | PASS | 白名單（全矩陣產出 + 原始碼掃描）、惡意 env throw 且不回顯、額外欄位不影響輸出 |
| sentinel 測試 | PASS | 跨 chunk（每個切點都試）、單字元 chunk、ANSI 夾雜（含切在 escape 中間）、回顯的格式字串不誤判、錯 nonce / `_%s__` / `_1000__` 不匹配、exit code 0 / 1 / 2 / 42 / 127 / 130 / 255 |
| `npm run test:unit` | PASS | 95 files / **1347 tests** 全綠（基線 1309 + 本單 38）。輸出中 `conpty_console_list_agent.js` 的 stack trace 是既有雜訊，與本單無關 |
| `npx tsc --noEmit` ≤ 40 | PASS | **40**（不變），`remote-tools` 相關 0 個 |

未執行任何安裝指令；沒有改 `electron/`、元件或 locales。

### 給後續工單的備註
- **T0410（面板）**：
  - i18n key 以 `INTEGRITY_KEYS` / `LOCATION_KEYS` / `NOTE_KEYS` / `UNSUPPORTED_REASONS` 為準，可直接用來擴充 completeness 測試。`UNSUPPORTED_REASONS` 是 enum 值，不是 key，建議對應到 `remoteTools.unsupported.<reason>`。
  - install.sh 類食譜**假設遠端有 `curl`**（只有 apk 會補裝）。Debian / Ubuntu 的精簡 Docker image 可能沒有 curl ⇒ 建議偵測到 `curl` 為 `missing` 時停用 claude / codex / uv 的安裝鈕並提示。curl 本身沒有食譜，因為它的官方文件 host（curl.se）不在白名單內。
- **T0412（執行）**：
  - 寫進 PTY 的字串是 `wrapWithSentinel(plan.command, nonce)` 再加 `\r`；`createSentinelMatcher(nonce).feed()` 掛在 `pty.onOutput` 上。
  - 安裝分頁的 shell 需要是 POSIX 系（gh apt 食譜用到 `out=$(mktemp)`、`$?`）。fish 這類 shell 不相容。
- **T0414（實機驗收）**：見下方「剩餘風險」。

### 偏離規格 / 自行補充（皆在本單範圍內）
1. **codex / uv 在 apk 上加了前置 `apk add curl`**：規格只寫了 Alpine claude 的前置。依據 T0407 §1「Alpine 預設沒有 bash / curl，所有 install.sh 都需要」補上。
2. **gh 的 dnf / yum 食譜不用 `dnf config-manager`**：dnf4 與 dnf5 的語法不同，而 env 只有 enum 分不出版本。改成 `curl -o /etc/yum.repos.d/gh-cli.repo <官方 .repo>` 再安裝，這就是 `config-manager --add-repo` 實際寫入的檔案；repo 本身仍是 GPG 驗證。
3. **gh 的 apt 食譜與官方文件的差異**：`apt` 改成 `apt-get`；`type -p wget` 改成 `command -v wget`，讓非 bash 的 login shell 也能執行；變數加上引號；下載用的暫存檔用完後 `rm -f`。
4. **新增 unsupported 理由**：`brew-as-root`（Homebrew 拒絕以 root 執行）、`musl-without-apk`（非 Alpine 的 musl 系統無法補 claude 的執行期依賴）。
5. **`osFamily: unknown`**（T0408 型別有這個值）：與 linux 走同一套規則；只有 `darwin` 會讓沒有 brew 的 git 變成 `manual-only`。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
- 開工時 T0408 的型別還沒 commit；執行途中 T0408 commit 了（`ab30fff`），所以改成直接引用，沒有留下本地型別宣告。
- **剩餘風險（列入 T0414 實機驗收）**：
  - `curl … | sh` 的 `$?` 是管線最後一個指令的狀態。curl 失敗（`-f`）時 shell 收到空輸入、回 0，標記會報成功。完成後會自動重新偵測，所以結果仍會顯示 `missing`，但 toast 可能先顯示「成功」。
  - gh 的 rpm repo 首次安裝會自動匯入 GPG key（`-y`），指紋沒有另外核對。
  - RHEL 家族的 ripgrep 需要 EPEL，食譜只附提示，不會自動啟用 EPEL。

### 回報時間
2026-10-05T03:00:17+08:00
