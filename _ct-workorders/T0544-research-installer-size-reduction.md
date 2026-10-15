---
schema_version: 1
schema_kind: workorder
id: T0544
title: "研究：安裝檔過大（dmg 871 MB / exe 693 MB / AppImage 1030 MB，D094 上限 280 MB）——實測各平台組成，評估縮減方案與取捨"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-10-15T20:06:48+0800"
updated_at: "2026-10-15T20:32:48+0800"
started_at: "2026-10-15T20:07:09+0800"
completed_at: "2026-10-15T20:32:48+0800"
commit: "0c3c79e9"
target_version: "未定（研究結論後由塔台開實作單）"
depends_on: []
related:
  - "D094（mac installer 280 MB 上限，長期超標未復議，L130）"
  - "D092（server bundle per-host baseline matrix，安裝檔內建 baseline tarball）；D093 / D095 / D120"
  - "D057 / D136（mac 只打 arm64、不做 universal）"
  - "CLAUDE.md「Server bundle baseline（PLAN-031）」「Packaging / Release 前置檢查」；docs/server-bundle-distribution.md"
  - "決策日誌 T-B 註記：codex 平台套件 unpackedSize win 223 → 451 MB"
affects_files:
  - _ct-workorders/T0544-research-installer-size-reduction.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：不改任何產品程式碼、`package.json`、workflow、腳本；只寫本工單檔。commit 用 `git commit --only _ct-workorders/T0544-research-installer-size-reduction.md`（`src/styles/settings.css` 的 M 狀態不是你的變更）。"
  - "🔴 下載與解壓一律放在 repo 之外（例：`%TEMP%\\t0544\\`），每個下載檔各自一個空目錄；**不得**執行下載內容裡的任何程式（只讀檔案大小 / 檔頭 / asar 清單）。研究結束後保留目錄並在回報區寫出完整路徑，不要放進 repo。"
  - "🔴 不 push、不觸發 workflow、不建 tag；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；不要在本機跑 electron-builder 打包（需要時只讀既有 release 產物）。"
---

# T0544 — 研究：安裝檔過大的組成與縮減方案

## 研究目標

回答兩件事，結論必須可決策：

1. **各平台安裝檔實際由什麼組成**（以 `v0.6.1-pre.3` 的 release 產物實測，不以推估代替）。
2. **有哪些縮減方案、各省多少、代價是什麼**，並給推薦組合與預估結果大小；說明 280 MB（D094）是否可達，達不到時建議的新上限。

## 已知資訊（塔台 2026-10-15 20:0x 取得）

`v0.6.1-pre.3` release 資產（`gh release view -R gowerlin/better-agent-terminal`）：

| 資產 | 大小 |
|---|---|
| `BetterAgentTerminal-0.6.1-pre.3-arm64.dmg` | 871 MB |
| `BetterAgentTerminal-0.6.1-pre.3-win.zip` | 868 MB |
| `BetterAgentTerminal.Setup.0.6.1-pre.3.exe` | 693 MB |
| `BetterAgentTerminal-0.6.1-pre.3.AppImage` | 1030 MB |

`server-bundle-v0.6.1-pre.3`：`bat-server-linux-x64` 228 MB、`linux-arm64` 228 MB、`darwin-arm64` 200 MB（皆 `.tar.gz`）。

線索（未驗證，請以實測確認或推翻）：

- `package.json` `build` 的 per-platform `extraResources` 含 `dist-baseline`（server bundle tarball，D092 matrix：Win → linux-x64；Mac arm64 → linux-x64 + darwin-arm64；Linux x64 → linux-x64）。已壓縮的 tarball 再包進安裝檔幾乎不會變小 ⇒ mac 可能約 428 MB、Win / Linux 約 228 MB 來自這裡。
- `build.files` 為 `node_modules/**/*`；`asarUnpack` 含 `@anthropic-ai/claude-code*`、`@anthropic-ai/claude-agent-sdk*`、`@openai/codex-*`、`@lydell/node-pty*`、`@kutalia/whisper-node-addon`。
- runtime 有下載 fallback：`electron/remote/server-bundle-distributor.ts`（baseline / cache 都缺時從 GitHub Release 下載，T0492）。
- claude-agent-sdk 的平台子套件自帶 claude binary，但 BAT 每個 spawn 點都傳 `pathToClaudeCodeExecutable`，不會執行它（CLAUDE.md「bundle 內容限制」，指的是 server bundle；desktop 安裝檔是否也打包了它請實測）。

## 調查範圍

1. **實測組成**：下載 pre.3 的 win zip、AppImage、dmg（dmg 可用 7-Zip 或 WSL `Ubuntu-24.04` 讀；AppImage 可用 WSL `--appimage-extract` 以外的方式，如 `unsquashfs` 讀 squashfs offset，**不要執行 AppImage**）。列出：
   - 前 15 大目錄 / 檔案（解壓後大小）與其在安裝檔中的壓縮後貢獻（估法寫明）
   - `resources/dist-baseline/`、`app.asar`、`app.asar.unpacked/node_modules/` 下各大套件
   - 是否含**用不到**的東西：其他平台 / arch 的 binary、`claude-agent-sdk-<platform>` 內建 claude、sourcemap、測試檔、型別檔、文件、`.bin/`、重複的套件版本等
2. **方案評估**（至少涵蓋以下，可加）：
   - **A** 安裝檔不附 server bundle baseline，首次設定遠端時下載（既有 distributor fallback 是否已足夠？離線 / 內網的退路？與 D092 的關係）
   - **B** codex 改為隨需下載或改用系統 codex（使用者體驗、版本綁定、BUG-083 / 084 的教訓）
   - **C** 清除用不到的檔案（electron-builder `files` 排除規則；逐項列可省大小與風險）
   - **D** 其他：whisper 模型 / addon、壓縮格式（dmg `ULMO` / NSIS `lzma` / AppImage 壓縮）、按需下載的 claude 等
   - **E** 若組合後仍超過 280 MB：建議的 D094 新上限與理由
3. 每個方案寫：可省大小（每平台）、實作範圍（會動哪些檔）、風險 / 退路、需要推翻或新增哪個決策（D###）、驗證方式。

## 研究指引

- 數字一律標來源（實測指令 / 檔案）；推估要標「推估」並寫算法。
- 本單 `interactive: false`：遇到需要使用者決定的取捨，寫進「建議方向」讓塔台問，不要停下來等。
- 不要開始實作；推薦方案由塔台與使用者決定後另開實作單。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**：四個 pre.3 安裝檔全部實測組成（未執行任何下載內容，只讀檔頭 / 封存清單 / asar header），方案 A–E 都有每平台的可省大小、實作範圍、風險與驗證方式。產品程式碼、`package.json`、workflow、腳本都沒有改。

Landing check：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符
- C-1：工單位於 `REPO_ROOT/_ct-workorders/`，PASS
- C-3：`affects_files` 只有工單本身，不適用
- C-2：工單沒有 `branch` 欄位，HEAD 為 `main`
- 觀察到的 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）

執行環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`，Worker 分頁在 BAT 內。

### 互動紀錄

無。`interactive: false`，需要使用者決定的取捨都寫在「建議方向」。

### 調查結論

#### 0. 方法與單位

- **單位一律 MiB**（1 MiB = 1,048,576 bytes）。工單表內的「871 MB / 693 MB」實際上就是 MiB：dmg 914,218,948 B = 871.9 MiB；exe 727,635,522 B = 693.9 MiB；zip 911,017,345 B = 868.8 MiB；AppImage 1,080,734,297 B = 1030.7 MiB。下載大小與 `gh release view` 的 `size` 逐位元一致。
- **證據目錄**（保留，約 11 GB，不在 repo 內）：`C:\Users\Gower\AppData\Local\Temp\t0544\`
  - 下載：`dl-zip\`、`dl-exe\`、`dl-appimage\`、`dl-dmg\`、`dl-sb-linux-x64\`、`dl-sb-darwin-arm64\`（每個檔案各自一個目錄）
  - 解壓：`x-zip\`、`x-exe\`、`x-dmg\`、`x-asar-win\`、`x-sb-linux-x64\`
  - 清單：`exe-files.tsv`、`zip-files.tsv`、`appimage-files.tsv`、`dmg-zest.tsv`，格式為「解壓大小 \t 壓縮後大小 \t 路徑」
- **分析腳本**（session scratchpad）：`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\c77c1c99-fb08-45d0-b92a-970f6bb248fe\scratchpad\`。`analyze.js` 讀 asar header，`group.js` 依元件加總，`zest.js` 估算 dmg，`misc.js` 統計 locales 等雜項。

**各平台的壓縮後貢獻怎麼算**
| 產物 | 算法 | 性質 |
|---|---|---|
| exe（NSIS） | `$PLUGINSDIR\app-64.7z` 是非 solid 7z（`Solid = -`，221 blocks，LZMA2:20 / BCJ2）。`7z l -slt` 的 `Packed Size` 就是每個檔案的實際壓縮後大小 | **實測** |
| zip | deflate，每檔 `Packed Size` | **實測** |
| AppImage | squashfs 4.0、`Method = ZLIB`、128 KiB block。7-Zip 以 offset 188392 讀 squashfs，每檔 `Packed Size` | **實測**，沒有執行 AppImage |
| dmg | UDZO（`Method = Copy Zero2 ZLIB CRC`，HFS+，1 MiB chunk）沒有每檔壓縮大小。改用 7-Zip 解出 HFS 內容，每檔以 zlib 預設等級、1 MiB 分塊壓縮來估（`zest.js`） | **推估**。總和 884.1 MiB，實際 871.9 MiB，誤差 +1.4% |
| app.asar 內可移除部分 | 7z LZMA2 `-mx=7` 壓「可移除清單」19.0 MiB 與「全部 packed 內容」20.6 MiB，比例 0.924，再乘以各平台 app.asar 的實測壓縮後大小 | **推估**（比例法） |

#### 1. 各平台組成（壓縮後 MiB，依大小排序）

| 元件 | exe（NSIS 實測） | zip（實測） | AppImage（實測） | dmg（推估） |
|---|---:|---:|---:|---:|
| server bundle baseline（`resources/bat-server-baseline/`） | **227.6** | 227.9 | **455.2**（linux-x64 228.0 + linux-arm64 227.2） | **428.2**（linux-x64 + darwin-arm64） |
| codex 平台套件（`@openai/codex-<plat>`） | 102.9 | 144.7 | 154.8 | 127.0 |
| Electron 本體（Chromium、locales 等） | 94.4 | 131.3 | 113.5 | 111.4 |
| claude 主 binary（`claude-code-<plat>` 或 `claude-code/bin/claude.exe`） | 86.0 | 112.0 | 113.7 | 104.8 |
| 🔴 **第二份相同的 claude.exe**（只有 Windows） | **86.0** | **112.0** | — | — |
| 🔴 **`claude-agent-sdk-<plat>` 內建 claude（不會執行）** | **48.1** | 68.6 | **138.6**（glibc + musl 兩份） | 57.4 |
| `app.asar` | 31.2 | 39.3 | 41.8 | 41.4 |
| 　└ 其中執行期用不到的 node_modules（推估） | ≈ 28.8 | ≈ 36.3 | ≈ 38.6 | ≈ 38.2 |
| whisper addon：本平台 binary | 10.2 | 19.8 | 10.0 | 1.4 |
| whisper addon：**其他平台** binary | 5.4 | 11.8 | 2.9 | 11.5 |
| 其他（SDK js、node-pty、helper scripts） | 1.1 | 1.2 | 1.1 | 1.0 |
| **合計** | **693.0** | **868.8** | **1031.6** | **884.1**（實際 871.9） |

**解壓後大小**：Windows 2036 MiB、AppImage 2083 MiB、dmg 1643 MiB。

**前 15 大檔案**（Windows，解壓 → NSIS 壓縮後，`exe-files.tsv`）
| 解壓 | 壓縮後 | 檔案 | 說明 |
|---:|---:|---|---|
| 229.0 | 227.6 | `bat-server-baseline/bat-server-linux-x64-…tar.gz` | |
| 258.3 | 86.0 | `claude-code-win32-x64/claude.exe` | |
| 258.3 | 86.0 | `claude-code/bin/claude.exe` | 與上一項 sha256 同為 `56810a111c01dcd2…` |
| 311.7 | 70.8 | `codex-win32-x64/…/bin/codex.exe` | |
| 212.9 | 62.8 | `BetterAgentTerminal.exe` | |
| 234.6 | 48.1 | `claude-agent-sdk-win32-x64/claude.exe` | SDK 0.2.113 內建，sha256 `0e62752f…` |
| 159.2 | 31.2 | `app.asar` | |
| 71.2 | 18.9 | `codex-code-mode-host.exe` | |
| 48.8 | 7.5 | whisper `win32-x64/libopenblas.dll` | |
| 6.4 | 6.4 | `resources.pak` | |
| 24.5 | 6.1 | `dxcompiler.dll` | |
| 16.9 | 4.4 | `codex-windows-sandbox-setup.exe` | |
| 10.3 | 3.3 | `icudtl.dat` | |
| 8.2 | 2.4 | `codex-voice-host.exe` | |
| 28.2 | 2.2 | whisper `linux-x64/libggml-vulkan.so` | 在 Windows 包裡 |

**`app.asar` 內容**（Windows，header 實測；dmg / AppImage 的 asar 同為 159.2 MiB）
- 頂層組成：`node_modules` 150.0、`dist` 4.6、`dist-electron` 1.2、`assets` 0.4 MiB
- 前幾大：`mermaid` 71.6（其中 sourcemap 50.3）、`cytoscape-fcose` 8.9、`@mermaid-js/parser` 6.7、`opencc-js` 5.4、`highlight.js` 5.2、`cytoscape` 5.1、`react-dom` 4.3、`katex` 3.9、`zod` 3.8 …
- 解析打包後 `dist-electron/*.js` 的 `require()`，執行期從 `node_modules` 載入的只有：`ws`、`opencc-js`、`ajv`、`ajv-formats`（`sdk-*.js` 用到其 `dist/runtime/*`）、`@lydell/node-pty`、`@anthropic-ai/claude-code`。codex 與 whisper 以計算出的路徑解析，都在 unpacked 內。
- 以這些套件為根算 `dependencies` 閉包：**執行期閉包 6.4 MiB，閉包以外 143.5 MiB**。閉包以外主要是 renderer 函式庫（mermaid、highlight.js、xterm、react、i18next、marked、dompurify 等），vite 已打包進 `dist/`，main 端的 `simple-git`、`selfsigned`、`js-yaml`、`uuid` 也已被 rollup 打包。這些套件只因為列在 `dependencies` 而被 `files: node_modules/**/*` 收進 asar。

**用不到的東西（實測確認）**
1. **Windows 的 claude binary 重複**（86.0 / 112.0 MiB）
   - 原因：`@anthropic-ai/claude-code/install.cjs` 先嘗試以 `linkSync` 把平台套件的 binary hardlink 到 `bin/claude.exe`（本機 `ls -li` link count = 2）。electron-builder 打包時把兩個連結各複製成完整檔案。
   - Windows 的 router 只用 `bin/claude.exe`（BUG-052），所以 `claude-code-win32-x64/claude.exe` 是多餘的。
   - mac / Linux 沒有重複：electron-builder 對非 Windows 目標排除 `.exe`（BUG-118），只剩平台套件那一份。
2. **`claude-agent-sdk-<plat>` 內建的 claude**：每個 spawn 點都傳 `pathToClaudeCodeExecutable`（`electron/claude-agent-manager.ts:732 / 864 / 1563 / 1880 / 2495`）。embedded 缺檔時丟 `EmbeddedClaudeMissingError`，不會改用 SDK 自帶的 binary（`electron/claude-runtime-router.ts:319-329`）。
   - desktop 安裝檔確實包含它：Win 1 份；Linux **2 份**（`linux-x64` + `linux-x64-musl`）；mac 1 份。
   - **server bundle 也包含**：linux-x64 tarball 內 `claude-agent-sdk-linux-x64/claude` 解壓 225.5 MiB、gzip 後 70.4 MiB；darwin-arm64 tarball 內 195.1 MiB。CLAUDE.md「bundle 內容限制」只寫到 sharp，沒有排除這個 binary。
3. **AppImage 內建 `linux-arm64` baseline**（227.2 MiB），與 D092 矩陣（`Linux × x64 → linux-x64`）不符。
   - 原因：`package.json` `build.linux.extraResources.filter` 同時列了 `linux-x64` 與 `linux-arm64`，CI 的 `dist-baseline/` 又一次下載全部三個 arch（`pre-release.yml:209-213`），filter 便兩個都收進去。目前沒有 arm64 AppImage target。
4. **whisper 其他平台 binary**：`@kutalia/whisper-node-addon/dist/` 四個平台全收。Win 包內含 `linux-x64`（33 MiB 解壓），mac 包內含 `win32-x64` 與 `linux-x64`。
5. **sourcemap 62.3 MiB、`.d.ts` 1.0 MiB、測試檔 1.2 MiB**（解壓大小），全部在 asar 內，主要來自 mermaid。改採方案 C4 時會一併移除。
6. **沒有發現的項目**
   - `.bin/`：asar 與 unpacked 都沒有
   - 重複的套件版本：沒有大型重複（不含上述 claude 重複）
   - whisper 模型：addon 只有 binary，模型執行期才下載到 `userData/whisper-models`（`electron/voice-handler.ts:43-71`）
7. **Electron locales**：Win 46.4 → 8.1、zip 11.0、AppImage 11.7、dmg 12.2 MiB。UI 只有 en / zh-TW / zh-CN 三語，其餘約 52 個 Chromium locale 用不到。屬小額項目。

**壓縮格式現況（實測）**
| 平台 | 格式 | 改用較強壓縮的效果 |
|---|---|---|
| NSIS | 7z LZMA2:20（1 MiB 字典）、非 solid | 改 `-mx=9` 後 claude.exe 86.0 → 78.4、codex.exe 70.8 → 55.1 MiB |
| AppImage | squashfs **ZLIB** | 以 xz 1 MiB 獨立 block 估 squashfs xz，約省 29% |
| dmg | **UDZO（zlib）** | bzip2（UDBZ）壓「app 去掉 baseline」392.9 MiB，zlib 為 455.5（-14%）；xz 1 MiB block（近似 ULMO）壓「app 去掉 baseline 與 SDK binary」281.6 MiB，zlib 為 398.1（-29%） |
| 已壓縮的 `.tar.gz` | — | 任何格式都壓不下去（227.6 / 229.0） |

electron-builder 26.8.1 的設定點（`node_modules/app-builder-lib`）：
- 頂層 `compression: "maximum"` → AppImage 用 `mksquashfs -comp xz`（`appImageUtil.js:26`），dmg 用 **UDBZ**（`dmg-builder/out/dmg.js:130`）。
- `dmg.format` 的 schema enum 只有 `UDBZ / UDCO / UDRO / UDRW / UDZO / ULFO`，**沒有 ULMO**（`scheme.json:901-911`），要用 LZMA dmg 需要自訂後處理。

**server bundle tarball**（linux-x64 v0.6.1-pre.3，解壓 614.9 MiB）
| 內容 | 解壓 | gzip | xz -6 |
|---|---:|---:|---:|
| `claude-code-linux-x64/claude` | 254.6 | 112.7 | 83.0 |
| `claude-agent-sdk-linux-x64/claude`（用不到） | 225.5 | 70.4 | — |
| `bin/node` | 120.9 | 42.7 | 28.6 |
| 其餘 | — | 約 3 | — |

#### 2. 為什麼 D094 的 280 MB 早已不可行

- **D094 的前提已經不成立**：D094（`_ct-workorders/_spec-server-bundle-distribution.md:59`）的理由是「NSIS 172 MB → Mac 雙 tarball 後 230-260 MB」。今天的組成裡，**光是不可省的三項就超過 280**：Electron 本體 94–131、claude 主 binary 86–114、codex 103–155 MiB，合計約 283–400 MiB。
- **能壓到 280 以下的組合**：只有「不附 baseline（A）」再加上「codex 不內建（B）」或「較強壓縮」。

#### 3. 方案評估

所有數字為**壓縮後**節省的 MiB，依序為 exe / zip / AppImage / dmg。dmg 已乘以實際值換算係數 0.986；未換算的值另外標註。

**C — 清除用不到的檔案（不影響功能）**

| # | 項目 | 省（exe / zip / AppImage / dmg） | 實作範圍 | 風險 / 退路 | 決策 | 驗證 |
|---|---|---|---|---|---|---|
| C1 | Windows 排除 `claude-code-win32-*/claude.exe`（保留 `bin/claude.exe`） | 86.0 / 112.0 / — / — | `package.json` `build.win` 加 files 排除（或 `files` 加 `!node_modules/@anthropic-ai/claude-code-win32-*/claude.exe`）；`verify-packaged-native.js` 補 Windows 檢查（目前只有 mac / linux） | 低。router 在 Windows 只找 `bin/claude.exe`。退路：還原排除規則 | 不需新 D | 打包後 `bin/claude.exe --version`；NSIS 完整重裝後跑 Agent 與 claude-cli 分頁 |
| C2a | desktop 排除 `@anthropic-ai/claude-agent-sdk-*`（平台子套件） | 48.1 / 68.6 / 138.6 / 56.6 | `build.files` 加 `!node_modules/@anthropic-ai/claude-agent-sdk-*/**`、`asarUnpack` 拿掉該 pattern；router 單元測試加「不得 fallback 到 SDK binary」的守門 | 低。打包版每個 spawn 點都傳 `pathToClaudeCodeExecutable`。唯一會用到 SDK binary 的是 dev / test 的 node-modules layout，不受影響 | 不需新 D；建議在 CLAUDE.md 記錄規則 | 三平台 Agent session、`getSupportedModels`、fork session |
| C2b | server bundle 排除 `claude-agent-sdk-<plat>` | tarball：linux-x64 -70.4（229.0 → 約 158.6）、darwin-arm64 約 -57.8（推估）。連帶安裝檔：-70.4 / -70.4 / -70.4 / -126.4 | `scripts/build-server-bundle.mjs`（`nativePackages` / 複製清單）、`verify-server-bundle.js` 禁止該路徑 | 低。理由同 C2a；也同步縮小遠端下載量 | 不需新 D | `smoke:remote:headless`、WSL / SSH wizard 安裝後在遠端跑 Agent |
| C3 | AppImage 只收 `linux-x64` baseline | — / — / 227.2 / — | `build.linux.extraResources.filter` 拿掉 `linux-arm64` 兩行；日後若出 arm64 AppImage，改用 `${arch}` 巨集 | 低，讓實作符合 D092。Linux x64 host 連 arm64 遠端時改走 download fallback（Win / mac host 原本就是這樣） | 符合 D092，不需新 D | `verify-packaged-native` 或 CI 列出 `resources/bat-server-baseline` |
| C4 | asar 不收 renderer 專用的 node_modules | ≈ 28.8 / 36.3 / 38.6 / 37.7（推估） | 兩種做法。① 把 renderer-only 套件（mermaid、highlight.js、@xterm/\*、react\*、i18next、react-i18next、marked、dompurify、qrcode、katex 的上游等）移到 `devDependencies`。② `build.files` 改白名單：`node_modules/{ws,opencc-js,ajv,ajv-formats,fast-*,json-schema-traverse,require-from-string,…}`。另需一個守門測試，比對打包後 `dist-electron` 的 `require()` 是否都在白名單內 | **中**。`node_modules/**/*` 換成白名單後，若漏了某個以動態 `require` 載入的套件，打包版會在執行期才壞。退路：還原 `files`。推薦 ②，並加上本研究這次用的 require 掃描當 CI 守門 | 不需新 D | 打包版 smoke：mermaid 預覽、程式碼高亮、語音繁簡轉換（opencc）、Agent 結構化輸出（ajv）、remote server（ws）；e2e 全套 |
| C4-lite | 只排除 `**/*.map`、`**/*.d.ts`、`**/{test,tests,__tests__}/**` | 約 12 / 15 / 16 / 16（**推估**，按解壓比例，精度低） | `build.files` 加排除 pattern | 低 | — | 同上 |
| C5 | whisper 只收本平台 `dist/<plat>` | 5.4 / 11.8 / 2.9 / 11.3 | 各平台 `files` 加排除（mac 保留 `mac-arm64` / `darwin-arm64`，與 `whisper-addon-loader.ts` 規則同步） | 低。`verify-native-modules` / `verify-packaged-native` 已檢查本平台目錄存在 | — | 語音輸入實測 |
| C6 | `electronLanguages: ["en-US","zh-TW","zh-CN"]` | ≈ 7.6 / 10.3 / 11.0 / 11.4（推估 94%） | `build.electronLanguages` | 低。Chromium 內建字串（拼字檢查、原生選單）在其他系統語系會退回英文 | 小額，可選 | 啟動、輸入框右鍵選單 |

**A — 安裝檔不附 server bundle baseline**
- **可省**：227.6 / 227.9 / 228.0（先做 C3 後）/ 422.3。若先做 C2b，baseline 只剩 158.6 / 158.6 / 158.6 / 約 298。
- **現有 fallback 夠不夠**：線上情境夠用。`electron/remote/server-bundle-distributor.ts` 在 baseline 缺 manifest 或 tarball 時走 `shouldFallbackToDownload` → GitHub Release 下載（D120 起每個 desktop 版號都會發 `server-bundle-v<版號>`）。**有兩個缺口**：
  1. **離線且無 baseline 時，連 cache 都用不到**：cache 的驗證依賴 baseline manifest 的 SHA（`server-bundle-distributor.ts:205-216`）；`server-bundle-download.ts:329-330` 先從網路抓 `manifest.json`，再查 cache。
  2. **沒有「選擇本機 tarball」的 UI**。內網只能設 `BAT_SERVER_BUNDLE_BASE_URL`，而且 wizard 不傳 `baseURL`，只有環境變數有效。
- **實作範圍**
  - `package.json` 三平台移除 `extraResources` 的 baseline
  - `prebuild` / `build:dir` / `build:release` 的 `fetch:baseline`
  - `pre-release.yml` / `release.yml` 下載 `dist-baseline` 的 step
  - `verify-helper-bundle.js`：目前 dist-baseline 缺 tarball 即 abort
  - distributor 的 cache 邏輯：無 baseline 時也能以已下載的 manifest / sidecar 驗證 cache
  - 新增「匯入本機 tarball」入口（wizard 一個按鈕 + `.sha256` 驗證），或另出 offline 安裝檔
- **風險**
  - 首次設定 WSL / SSH 遠端時多一次約 159–229 MiB 的下載
  - GitHub 不可達的環境需要匯入路徑
  - snapshot 版號已會去後綴（T0492）
- **決策**：**推翻 D092**（per-host baseline matrix）。D093 / D095 / D120 保留。
- **驗證**：清空 `userData/bat-server-bundles` 後跑 WSL / SSH wizard（線上）；離線 + 匯入 tarball；`plan039` e2e。

**B — codex 改為隨需下載或改用系統 codex**
- **可省**：102.9 / 144.7 / 154.8 / 125.2。codex 是 desktop 安裝檔中**第二大**的單一元件。
- **現況**：`resolveCodexRuntime`（`electron/codex-runtime-resolver.ts:255-262`）已會在 embedded / 官方 installer / Desktop App / PATH 之間選**最新版**。T0373 為 BUG-083 做的這個機制，讓「不內建」的落差小很多：裝了系統 codex 的使用者其實已經在用系統版。
- **做法選項**
  - **B1**：不內建。偵測不到 codex 時，Codex 面板顯示安裝指引（官方 installer）。最簡單。
  - **B2**：首次使用時從 npm registry 下載 `@openai/codex-<plat>@<鎖定版>` tarball 到 `userData`，校驗 integrity，resolver 加一個 `downloaded` 候選。
- **BUG-083 / 084 的教訓**
  - 內建版落後會直接壞，因為服務端與共用的 `~/.codex/config.toml` 都會前進。不內建就沒有「內建版太舊」的問題，但多了「沒裝」與「版本未經測試」兩種狀態。
  - B2 鎖版本並隨 BAT 版號更新，可保留「已測版本」的保證。
- **實作範圍**：`package.json` 的 `@openai/codex-sdk` 與 codex 平台子套件（optionalDependencies）排除；`asarUnpack`；`codex-agent-manager.ts` / `codex-runtime-resolver.ts`；Codex 面板 UI；i18n 三語；`verify-packaged-native` 中 codex 相關的部分。
- **風險**
  - 離線環境首次無法使用 Codex
  - npm registry 被擋（企業網路）
  - B2 要處理下載中斷與完整性
- **決策**：需要新 D，「codex 不隨安裝檔內建」。另需確認 PLAN-037 對 codex 的既有決策（其「不採用 C 打包進 server bundle」的理由與此方向一致）。
- **驗證**：乾淨機器上未裝 codex → 面板引導；B2 下載 → 開 Codex session；已裝系統 codex → 仍選最新版。

**B' — Claude 隨需下載（不建議）**：可省 86–114 MiB，但 Claude 是核心功能（Agent 面板、claude-cli 分頁、helper 派工都依賴它）。BUG-084 也證明內建版要跟版，不能沒有。代價高於收益。

**D — 壓縮格式（不影響功能，只改打包設定）**
- **D1**：頂層 `compression: "maximum"`
  - AppImage → squashfs xz，約 -29%（推估），作用於「可壓縮部分」
  - dmg → UDBZ，約 -14%（實測 bzip2 比例）
  - NSIS → 7z 最高等級，大型 binary 實測 -9% ~ -22%，整體約 -10%（推估）
  - 代價：打包時間變長；dmg 掛載 / NSIS 安裝解壓變慢（UDBZ 解壓明顯較慢）；AppImage xz 啟動時 squashfs 解壓較慢
- **D2**：dmg 用 ULMO（LZMA，macOS 10.15+）可再省約 29%（推估）。但 26.8.1 的 `dmg.format` 不接受 ULMO，需要在 `afterAllArtifactBuild` 以 `hdiutil convert -format ULMO` 後處理。之後還要重新簽章與公證，風險高於收益，**暫不建議**。
- **D3**：server bundle 改 `.tar.xz`。tarball 估約 114 MiB（C2b 後的 gzip 版約 159）。但遠端解壓改為 `tar xJ`，需要遠端有 `xz`（SSH 目標不一定有），`build-server-bundle` / distributor / wizard / verify / manifest 命名都要動。若採方案 A，baseline 不在安裝檔內，這項只影響下載量，**優先度低**。

**E — D094 新上限**：見下方推薦組合的結果表。

#### 4. 組合結果（壓縮後 MiB，推估）

| 情境 | exe | zip | AppImage | dmg |
|---|---:|---:|---:|---:|
| 現況 pre.3（實測） | 693.9 | 868.8 | 1030.7 | 871.9 |
| **S1** = C1 + C2a + C3 + C4 + C5 | 524.7 | 640.1 | 624.3 | 766.3 |
| **S2** = S1 + C2b（瘦身後的 baseline） | 454.3 | 569.7 | 553.9 | 639.9 |
| **S3** = S1 + A（不附 baseline） | 297.1 | 412.2 | 396.3 | 344.0 |
| S3 + D1（`compression: maximum`） | ≈ 267 | 412（zip 不受影響） | ≈ 280 | ≈ 296 |
| S3 + D1 + C6 | ≈ 260 | ≈ 402 | ≈ 272 | ≈ 287 |
| **S4** = S3 + B（codex 不內建） | 194.2 | 267.5 | 241.5 | 218.7 |
| S4 + D1 | ≈ 175 | 267.5 | ≈ 171 | ≈ 188 |

這些數字以各元件的實測或推估壓縮後大小直接相減。S3 + D1 一列，是把壓縮比例套用在「可壓縮部分」。

**280 MiB（D094）是否可達**
- 只做 C：**不可達**，最好是 S2 的 454–640。
- C + A：Windows exe 在加上 D1 後可達（約 267），dmg 約 287–296，**差一點**，AppImage 約 272–280。
- C + A + B：**四個產物都可達**（175–268）。

### 建議方向

依風險由低到高分三階段。每一階段都可以單獨出貨，數字可以疊加。

**第一階段（推薦立即做，不影響功能）：C1 + C2a + C2b + C3 + C5，C4 用白名單加守門測試**
- 預估結果：exe 約 454、zip 約 570、AppImage 約 554、dmg 約 640 MiB（S2），比現況少 240–477 MiB。
- 只改打包設定、server bundle 建置腳本與 verify 腳本，不需推翻任何決策。
- C3 是讓實作回到 D092 的矩陣（實作與決策不一致，算 bug）。

**第二階段（需要塔台與使用者決定）：A（不附 baseline）＋ D1**
- 預估結果：exe 約 267、AppImage 約 280、dmg 約 296 MiB。
- **需問使用者**
  1. 能否接受首次設定 WSL / SSH 遠端時多一次約 159 MiB 的下載（C2b 後）？
  2. 是否需要支援離線 / 內網？需要的話，配套「匯入本機 tarball」入口或另出 offline 安裝檔。
  3. 能否接受推翻 D092？
- 不做 A 時，S2 已把 baseline 縮到約 159 MiB / 份。可只保留 Windows 與 Linux 的 linux-x64 baseline、mac 拿掉 darwin-arm64，作為折衷（dmg 約 499 MiB，推估：639.9 - 141.1）。這需要修改 D092 中的「Mac 雙 tarball」。

**第三階段（可選）：B（codex 不內建）**
- 再省 103–155 MiB，四平台全部低於 280。
- **需問使用者**：Codex 面板首次使用要「引導安裝系統 codex（B1）」或「BAT 代為下載鎖定版本（B2）」？
- BUG-083 的「挑最新版」機制已降低不內建的落差，但「沒裝就不能用」是新的使用者體驗成本。

**D094 新上限建議**
- 若採第一、二階段（不做 B）：**每個平台安裝檔 ≤ 320 MiB**。dmg 約 296、AppImage 約 280、exe 約 267；zip 是可攜版，另計 ≤ 450 MiB。保留約 8% buffer。
- 若只做第一階段：上限要拉到 **≤ 680 MiB**。這已經失去約束意義，建議 D094 改為「CI 每次發佈記錄各產物大小、比上一版成長超過 10% 即提醒」的趨勢型規則。
- 若三個階段都做：280 MiB 可維持。
- 不論哪種，都建議把 D094 從「Mac 單一上限」改為「**每平台**上限，並由 CI 量測」。本次 Linux AppImage 比 dmg 還大，是 D094 只管 mac 時看不到的。

### 建議下一步

1. **實作單 A（第一階段，P1，sizing M）**
   - 內容：C1 / C2a / C2b / C3 / C5，加上 C4 白名單與 `dist-electron` require 守門測試。
   - 驗收：CI 量測三平台產物大小（要求 ≤ S2 估值 + 5%）、`verify-packaged-native` 補 Windows、NSIS 完整重裝、Agent / claude-cli / 語音 / mermaid / remote wizard 實機走過。
   - 可順手加一個 `scripts/report-artifact-sizes.mjs`（只讀），在 release job 輸出各產物的組成摘要，作為後續 D094 趨勢型規則的資料來源。
2. **塔台向使用者詢問「建議方向」中的三個決策**：A 是否推翻 D092、離線匯入需求、B1 / B2 / 不做。之後再開第二、三階段實作單。
3. **D094 復議**：依上面的結論改寫 D094，並解除 L130 的長期超標狀態。
4. **CLAUDE.md**：第一階段落地後，在「Server bundle baseline」的「bundle 內容限制」與「Packaging / Release 前置檢查」補上兩條規則：`claude-agent-sdk-<plat>` 不打包；Windows 只保留 `bin/claude.exe`。

### 遭遇問題

- 第一次以 Git Bash 背景 `gh release download … &` + `wait` 下載，回報 exit 0 卻沒有任何檔案落地，原因未查明。改用 PowerShell `ForEach-Object -Parallel` 重新下載後正常，大小與 release metadata 逐位元一致。
- dmg（UDZO）沒有每檔壓縮大小，只能用 1 MiB 分塊 zlib 估算，總和誤差 +1.4%（884.1 vs 871.9 MiB），dmg 欄已乘 0.986 換算。
- C4-lite、C6、D1、D3 的節省量是比例或單檔推估，精度低於 C1 / C2 / C3 / C5（直接相減實測值）。
- 沒有在本機跑 electron-builder（遵守工單限制），因此所有組合結果都是以元件相減推估，不是實際打包出的大小。第一階段實作單需以 CI 實際產物複核。
- macOS 打包產物只做了靜態讀檔，沒有在 Mac 上驗證 UDBZ / 簽章。

### 回報時間

2026-10-15T20:30:27+0800
