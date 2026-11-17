---
schema_version: 1
schema_kind: workorder
id: T0877
title: "verify-packaged-native：安裝包內出現其他平台／架構的平台套件時失敗"
type: implementation
status: DONE
created_at: "2026-11-17T10:27:04+0800"
started_at: "2026-11-17T10:58:17+08:00"
updated_at: "2026-11-17T11:09:16+08:00"
completed_at: "2026-11-17T11:09:16+08:00"
session_ids:
  - "02b97908-4e6b-469e-865d-dea84d6b00e2"
repo: better-agent-terminal
priority: P2
sizing: M
depends_on: [T0876]
related:
  - "D298（T0873〈建議後續〉4、〈環境與驗證方式〉）；T0546（安裝檔瘦身、`duplicate-claude`）；BUG-118"
affects_files:
  - _ct-workorders/T0877-verify-packaged-foreign-platform.md
  - scripts/verify-packaged-native.js
  - scripts/__tests__/**
  - package.json（只限 `build.files`，且只在任務 3 判定要收緊時）
  - docs/agent-guide/packaging-release-checks.md
  - CLAUDE.md（只限〈Packaging / Release 前置檢查〉節的一行說明）
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 新檢查不得讓目前正常的安裝包失敗：Windows x64、Linux x64、macOS arm64 的合法內容（各自平台的 `claude-code-<平台>-<架構>`、`node-pty` 的 prebuilds、whisper `dist/<平台>-*` 等）都要放行。規則以「套件名或目錄名帶有平台／架構，且不是目標平台／架構」判定，判定清單集中一處、註明來源。"
  - "🔴 `build.files`：🔴 不得使用 `build.<platform>.files`（CLAUDE.md〈Packaging / Release 前置檢查〉，T0546 實測整個 repo 被打進 asar）；平台差異只能用頂層 `files` 的 `${os}`／`${arch}`。收緊 `build.files` 只在能以 `asar-runtime-deps.test.mjs` 與本機 `build:dir` 證明不漏打必要檔時才做；不確定就只加檢查，收緊列為後續。"
  - "🔴 不得觸發 workflow；Linux／macOS 包只能由塔台之後派 `desktop-build.yml` 驗證，回報區寫明需要驗的項目。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0877 — verify-packaged-native 擋住其他平台的平台套件

## 元資料
- **工單編號**：T0877｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-17 10:27 (UTC+8)
- **規模**：M｜**依賴**：T0876（同一個 checkout，依序執行）｜**決策**：D298

## 背景
T0873 在 Windows 上為了打 linux server bundle，臨時把 `@lydell/node-pty-linux-x64`、`@anthropic-ai/claude-code-linux-x64` 放進 `node_modules`；之後 `build:dir` 把 linux 版 `claude`（328 MB）打進 Windows 的 `app.asar.unpacked`，而 `verify-packaged-native` 通過了。現有的 `duplicate-claude` 只看 `claude-code-win32-*/claude.exe`（`scripts/verify-packaged-native.js` 約 L560）。CI 的乾淨 runner 通常不會裝到別平台的套件，但開發機打包、或 npm 日後改變 optional 依賴的安裝行為時，就會靜默變大。

## 任務
1. 盤點安裝包內所有「帶平台／架構」的套件與目錄（從 `build.files`、`asarUnpack`、lock 中 `os`／`cpu` 欄位的套件找），整理成判定清單。
2. 在 `verify-packaged-native.js` 加檢查（例：`foreign-platform-package`）：目標平台／架構以外的平台套件出現就失敗，錯誤訊息指出可能原因（開發機殘留的別平台 optional 依賴）。比照既有檢查的結構與輸出格式。
3. 評估 `build.files` 是否該同時以 `${os}`／`${arch}` 排除別平台的平台套件（見 memory_overrides）；做或不做都寫理由。
4. 單元測試：以假的檔案清單測三個平台的合法內容通過、混入別平台套件失敗（放 vitest 收得到的位置，D177）。
5. 更新 docs `packaging-release-checks.md` 的檢查項目表；CLAUDE.md 只在〈Packaging / Release 前置檢查〉補必要的一句（若 docs 已足夠可不改）。

## 關卡
- `npm run test:unit`、`npm run test:legacy`（與前一張比較）
- `npx vite build` ＋ `npm run build:dir` ＋ `verify-packaged-native --platform win --arch x64`：乾淨的 `node_modules` → 通過
- 重現 T0873 的污染（暫時放入 linux 平台套件後 `build:dir`）→ 新檢查失敗；驗證完刪除那些套件、重新 `build:dir` 確認恢復通過（暫放的套件不得留在 `node_modules`，也不得進 lock）
- 若改了 `build.files`：`asar-runtime-deps.test.mjs` 通過

## 驗收條件
- [ ] 判定清單（套件／目錄、平台、來源）
- [ ] 新檢查：乾淨包通過、污染包失敗（附輸出）
- [ ] `build.files` 收緊與否的結論
- [ ] 單元測試涵蓋 win／linux／mac
- [ ] 回報區寫明需要塔台派 `desktop-build.yml` 確認 Linux／macOS 包也通過
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE（Worker 範圍的驗收條件全部完成；Linux / macOS 包需塔台另派 `desktop-build.yml` 確認，見〈後續〉）
- **完成時間**：2026-11-17 11:07 (UTC+8)
- **session_id**：02b97908-4e6b-469e-865d-dea84d6b00e2

### 落點檢查
- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS；C-3：`scripts/verify-packaged-native.js`、`docs/agent-guide/packaging-release-checks.md` 存在 → PASS；C-2：工單無 `branch` 欄位，目前 `main`
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）、`BAT_REMOTE_TOKEN` 已設定；未設 `CT_HOME`（非 worktree）

### 結果摘要
`scripts/verify-packaged-native.js` 新增 `foreign-platform-package` 檢查（三平台共用的 `verifyPackagedLayout`）：安裝包（app.asar ＋ app.asar.unpacked）內出現目標平台／架構以外的平台套件或目錄即失敗，逐項列出 `<平台>-<架構>: <路徑>`（巢狀的只列最外層），並在 CLI 結尾提示一行可能原因與處置。判定集中在 `foreignPlatformEntries` 與同檔的 `PACKAGE_PLATFORMS` / `PACKAGE_ARCHS` / `PACKAGE_LIBCS` / `CODEX_TARGET_TRIPLES`。`build.files` 不收緊（理由見下）。

### 判定清單（任務 1）
盤點來源：`package-lock.json` 中帶 `os` / `cpu` 的套件、`build.files` 白名單與 `asarUnpack`、實際 `release/win-unpacked` 內所有帶平台字樣的目錄（乾淨包只有 5 個：`claude-code-win32-x64`、`node-pty-win32-x64`、`codex-win32-x64` 與其 `vendor/x86_64-pc-windows-msvc`、whisper `dist/win32-x64`）。

| 規則 | 套件／目錄 | 判定依據 | 來源 |
|---|---|---|---|
| 1 套件名 `-<platform>-<arch>[-<libc>]` | `@anthropic-ai/claude-code-{win32,darwin}-{x64,arm64}`、`-linux-{x64,arm64}[-musl]` | 名稱 | lock `os`/`cpu`/`libc`；`claude-code` 的 optionalDependencies |
| 1 | `@anthropic-ai/claude-agent-sdk-*`（同上 8 個；另有 C2a `sdk-binary`） | 名稱 | lock `os`/`cpu` |
| 1 | `@lydell/node-pty-{win32,darwin,linux}-{x64,arm64}` | 名稱 | lock `os`/`cpu` |
| 1 | `@openai/codex-{win32,darwin,linux}-{x64,arm64}`（`npm:@openai/codex@0.166.0-<平台>-<架構>` 別名） | 名稱 | lock `os`/`cpu`；`@openai/codex` 的 optionalDependencies |
| 2 `@openai/codex*/vendor/<triple>/` | `x86_64-pc-windows-msvc` 等 6 個 triple | triple 對照表 | `codexTargetTriple()`（`electron/codex-agent-manager.ts`） |
| 3 `prebuilds/<platform>-<arch>[+<arch>]/` | 目前沒有套件使用（現行 `@lydell/node-pty-*` 直接放 `pty.node`） | 目錄名 | node-gyp-build 慣例 |
| — | whisper `dist/<platform>-<arch>/` | — | 已由 C5 `whisper-platforms` 負責，不重複判定 |

放行：目標平台＋架構，任何 libc（`-musl` 視為同平台同架構）。名稱解析不出平台＋架構的不判定：`@openai/codex-sdk`、`@anthropic-ai/claude-code`，以及 lock 中 dev 專用的 sharp `@img/*-linuxmusl-*`（4 個，不會打包）。

### 新檢查的輸出（任務 2）
- 乾淨 `node_modules`：`npm run build:dir` exit 0 → `node scripts/verify-packaged-native.js --platform win --arch x64` exit 0（`✅ every windows package passed (x64)`，含 stdio addon 載入檢查）。
- 重現 T0873 污染：`npm pack @lydell/node-pty-linux-x64@1.1.0 @anthropic-ai/claude-code-linux-x64@2.1.316` 到 scratchpad，直接解壓進 `node_modules`（不經 `npm install`）→ `build:dir` exit 0（Windows 包內出現 `claude-code-linux-x64`、`node-pty-linux-x64`）→ verify **exit 1**：
  ```
  [verify-packaged-native] ❌ win x64: 2 package(s) / director(ies) built for another platform or arch packaged (target win32-x64; T0877). Usually another platform's optional dependency left in the build host's node_modules (e.g. installed by hand to build a server bundle): remove it from node_modules (or run npm ci) and package again
        linux-x64: node_modules/@anthropic-ai/claude-code-linux-x64
        linux-x64: node_modules/@lydell/node-pty-linux-x64
  …
  [verify-packaged-native] T0877 foreign-platform-package: another platform / arch package is in the build host's node_modules (e.g. installed by hand for a server bundle); delete it (or `npm ci`) and package again — never add it to package-lock.json.
  ```
- 恢復：刪除兩個暫放套件 → `node_modules/@anthropic-ai`、`@lydell` 只剩 win32-x64；`package.json` / `package-lock.json` 的 sha256 與污染前相同（`sha256sum -c` OK）→ 重新 `build:dir` exit 0 → verify exit 0。scratchpad 的 tarball 已刪除。
- 第一次解壓時 Git Bash 的 GNU tar 把 `C:` 路徑當成遠端主機而失敗（目錄是空的，該次 build 等同乾淨包，verify 通過）；改用 `--force-local` 重做，上面的輸出是第二次。

### `build.files` 收緊結論（任務 3）
**不收緊**，只加檢查；寫進 docs〈`foreign-platform-package`〉。理由：
1. 套件名用 Node 名稱（`win32` / `darwin` / `linux`），`${os}` 是 `win` / `mac` / `linux`；要寫成 whisper 那種 `${os}32-${arch}|darwin-${arch}` 才對得上，而 `darwin-${arch}` 在每個平台都會放行（whisper 無害只因 addon 沒有 `darwin-*` 目錄；`claude-code-darwin-x64` 等平台套件真的存在，Windows x64 包仍會漏）。
2. `@openai/codex-*` 的排除還要避開 `codex-sdk`，pattern 更複雜、易錯。
3. 本機只能以 `build:dir` 驗 Windows；Linux / macOS 要 `desktop-build.yml`，不符合 memory_overrides「能以 `asar-runtime-deps.test.mjs` 與本機 `build:dir` 證明不漏打才做」。
4. CI 是乾淨的 `npm ci`，npm 只裝主機平台的 optional 依賴；問題只在開發機手動放套件時發生，fail-fast 已足夠。

未改 `package.json`，所以 `asar-runtime-deps.test.mjs` 的額外關卡不適用（它照常在 `test:unit` 內通過）。

### 單元測試（任務 4）
- 新檔 `scripts/__tests__/verify-packaged-foreign-platform.test.mjs`（15 tests）：win32-x64 / linux-x64 / darwin-arm64 的合法內容通過；混入另外兩個目標的平台套件與 codex vendor 目錄失敗；T0873 案例；同平台不同架構；libc（musl / msvc）放行；巢狀 `node_modules`；`prebuilds` 多架構目錄；不判定的名稱；來源一致性（lock `os`/`cpu`、`@anthropic-ai` / `@lydell` / `@openai` 平台套件都能解析、`CODEX_TARGET_TRIPLES` = `codexTargetTriple()`）。
- `scripts/__tests__/verify-packaged-native.test.mjs` 新增 `foreign-platform-package (T0877)` 4 tests（假的 electron-builder 輸出：win 的 T0873 殘留含 CLI exit 1 與輸出、win 的 arm64 套件與別的 codex triple、linux 的 asar 內 darwin codex 套件＋放行 musl、mac 的 win32 node-pty 只靠名稱擋）。既有的三平台健康 fixture 照舊通過（等於三平台合法內容的整合驗證）。
- 既有案例調整 1 個：mac「x86_64 Mach-O mixed into the arm64 .app」的 fixture 是 `node-pty-darwin-x64/prebuilds/darwin-x64/pty.node`（BUG-117 情境），現在同時被 `foreign-arch` 與 `foreign-platform-package` 擋，期望改成 `['foreign-arch', 'foreign-platform-package']`。

### 驗證證據
| 關卡 | 結果 | 與 T0876 比較 |
|---|---|---|
| `npm run test:unit`（vitest json reporter，一次跑完） | 8415 個：**8373 passed / 0 failed / 42 skipped**，0 個 suite failed | T0876 第二次全量 8354 passed / 42 skipped；+19 = 本單新增（15 + 4） |
| `npm run test:legacy` | 33 檔／472 tests 全過 | 相同 |
| 乾淨 `node_modules`：`npm run build:dir`（含 `vite build`）＋ verify win x64 | build exit 0、verify exit 0 | — |
| 污染（linux node-pty ＋ linux claude）＋ `build:dir` ＋ verify | build exit 0、verify **exit 1**（輸出如上） | — |
| 刪除污染後 `build:dir` ＋ verify | exit 0 / exit 0；lock 未變 | — |
| docs / CLAUDE.md 修改後，讀 CLAUDE.md 的 7 個測試檔＋兩個 verify 測試檔 | 9 檔 245 tests 全過 | — |

### 修改檔案
- `scripts/verify-packaged-native.js`：`foreignPlatformEntries` 與判定清單常數、`verifyPackagedLayout` 的 `foreign-platform-package`、CLI 提示一行、檔頭說明、exports
- `scripts/__tests__/verify-packaged-foreign-platform.test.mjs`（新增）
- `scripts/__tests__/verify-packaged-native.test.mjs`：新 describe、mac 案例期望、檔頭說明
- `docs/agent-guide/packaging-release-checks.md`：檢查項目列表加 id、新增〈`foreign-platform-package`〉小節（判定表、放行規則、測試、處置、`build.files` 不收緊的理由）
- `CLAUDE.md`：〈Packaging / Release 前置檢查〉的「Build fail-fast」那一行補一句

### Commit
- 產品：`379f1dec` feat(packaging): fail verify-packaged-native on other platforms' packages (T0877)
- 工單：本次回報的 commit（產品 commit 之後）；未 push

### 偏差與問題
- 無範圍外修改。`package.json` 未改。
- 工單提到的「`node-pty` 的 prebuilds」現行套件沒有（`@lydell/node-pty-<平台>-<架構>` 直接放 `pty.node`），仍保留 `prebuilds/<platform>-<arch>` 規則以涵蓋 node-gyp-build 版面。

### 後續（需塔台）
- 🔴 **請塔台派 `desktop-build.yml`**（`-f ref=main` 或含 `379f1dec` 的 SHA）確認 Linux x64 與 macOS arm64 包也通過 `verify-packaged-native`。要看的項目：Linux job 的 `--platform linux --arch x64` 與 mac job 的 `--platform mac --arch arm64` 都沒有出現 `foreign-platform-package`（CI 乾淨 runner 預期 0 項）；若出現，看 details 是哪個套件、是否為 npm 在該 runner 多裝的 optional 依賴。
- 若日後要以 `build.files` 收緊，需另開單，以 `asar-runtime-deps.test.mjs` 與三平台 `desktop-build.yml` 證明不漏打（理由見上）。

### 互動紀錄
- 無（yolo，未向塔台提問；執行期間無塔台補充段落）
