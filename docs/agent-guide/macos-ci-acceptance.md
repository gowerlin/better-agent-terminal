# macOS runner 驗收（T0778）

用 GitHub Actions 的 macOS runner，對**已發佈的 dmg**（不是從 source build）跑 BUG-128（Finder 複製檔案 + Command+V 貼進終端分頁，T0522）與 BUG-130 mac 部分（終端貼圖鍵 `\x16`，T0524）的驗收。

- workflow：`.github/workflows/macos-acceptance.yml`（只有 `workflow_dispatch`，不接進任何發版流程）
- spec：`e2e/macos/t0778-macos-paste-acceptance.spec.ts`，macOS 輔助（osascript / JXA）：`e2e/macos/mac-os.ts`
- 共用 fixture：`e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE` 隔離實例）、`e2e/fixtures/fake-anthropic-api.ts`（情境 ⑧）；本功能沒有改這兩個檔

## 觸發

```bash
gh workflow run macos-acceptance.yml -R gowerlin/better-agent-terminal -f version=0.7.3-pre.5
gh run list -R gowerlin/better-agent-terminal --workflow macos-acceptance.yml -L 3
gh run download <run id> -R gowerlin/better-agent-terminal -D <資料夾>
```

🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。workflow 要在預設分支上才能 dispatch。

`version` 必須是 `X.Y.Z` 或 `X.Y.Z-pre.N`，對應 tag `v<version>` 與資產 `BetterAgentTerminal-<version>-arm64.dmg`。

## workflow 規則（必守）

- 只有 `workflow_dispatch`；`permissions: contents: read`；runner `macos-15`（標準 runner，公開 repo 免費；🔴 不用 larger / 付費 runner）；`timeout-minutes: 30`（實測整個 job 約 5 分鐘、spec 約 2.7 分鐘）。
- 🔴 不使用任何 secret：下載 release 用 job 自己的唯讀 `GITHUB_TOKEN`（只給下載那一步）。
- 下載 dmg 後比對 release 資產的 `digest`（`sha256:…`），不符即停。
- 掛載 dmg（`hdiutil attach -nobrowse -readonly`）→ `ditto` 複製 `.app` 到 `$RUNNER_TEMP/app` → 卸載 → 只對複製出來的那份 `xattr -dr com.apple.quarantine`（gh 下載的檔案本來就沒有 quarantine，這步是保險）→ `BAT_E2E_EXECUTABLE=<.app>/Contents/MacOS/<CFBundleExecutable>`。
- 測試依賴只裝 `npm ci --ignore-scripts`（Playwright 驅動已安裝的 app，不需要 electron 二進位）。
- artifact（`macos-report.md` / `.json`、截圖、`debug-paste-lines.log`）保留 7 天；上傳前刪掉含權杖樣式的檔案。spec 只抄 debug log 裡 `terminal-paste` / `clipboard` 的行，不抄整份 log、不寫 env。
- 🔴 spec 不改 macOS 隱私設定（TCC）：被擋下就記 `不可行`，不得修改 TCC.db 或用其他手段繞過。runner 映像本身的授權（見下表）是映像的設定，不是本 workflow 加的。

## 可行性表（run 41380866131，2026-11-02，`v0.7.3-pre.5`）

runner 環境：macOS 15.8.2（24H232）arm64、`launchctl managername` = `Aqua`（有登入的圖形工作階段）、使用者 `runner`、`SHELL=/bin/bash`。安裝版 `.app`：`Signature=adhoc`、`spctl` rejected（未公證，但 Playwright 直接執行可以啟動）。

| Probe | 結果 | 證據 |
|---|---|---|
| P1 啟動安裝版隔離實例並截圖 | PASS | 視窗可見、取得焦點；Playwright 截圖可用；OS `screencapture -x` 也拍得到整個桌面（runner 映像已授權螢幕錄製） |
| P2 腳本寫剪貼簿（JXA `NSPasteboard writeObjects` NSURL） | PASS | 單檔 / 多檔都出現 `public.file-url`、`NSFilenamesPboardType`（由型別轉換提供）、`Apple URL pasteboard type`；BAT `clipboard:read-file-paths` 回傳正確路徑 |
| P2b AppleScript 叫 Finder 選取＋System Events Command+C | PASS | 對 Finder 送 Apple Events 與 System Events 按鍵都沒被擋；剪貼簿多了 `com.apple.finder.noderef`、`fndf`、純文字（檔名），`public.file-url` 是 **file reference URL**（`file:///.file/id=…`） |
| P3 Playwright `Meta+V`（CDP 按鍵） | PASS | PTY 收到完整路徑，每次只有一個 chunk（沒有重複貼上） |
| P4 osascript System Events `keystroke "v" using command down` / `control down` | PASS | 沒被輔助使用權限擋下；送鍵前確認最前景程式是 `BetterAgentTerminal`、Electron 有焦點視窗 |
| P5 剪貼簿放圖 → Control+V / Command+V | PASS | Electron `clipboard.writeImage` 與另一個程序寫 `public.png` 兩種來源，Playwright 與 OS 按鍵都收到 `\x16` |

## 情境結果（同一 run）

| # | 情境 | 結果 | 按鍵 | 剪貼簿來源 | 次數 |
|---|---|---|---|---|---|
| ① | BUG-128 單檔 Command+V → 路徑 | PASS | Playwright + OS | 腳本 + Finder | 12/12 |
| ② | BUG-128 多檔 → 以空白分隔 | PASS | Playwright + OS | 腳本 + Finder | 12/12 |
| ③ | BUG-128 路徑含空白 → 單引號包住 | PASS | Playwright + OS | 腳本 + Finder | 12/12 |
| ④ | BUG-128 不回歸：純文字 Command+V 照常貼 | PASS | Playwright + OS | `pbcopy` | 2/2 |
| ⑤ | BUG-130 有圖 Control+V → `\x16` | PASS | Playwright + OS | Electron / `public.png` | 3/3 |
| ⑤b | T0524 規格：有圖 Command+V → `\x16`（與 Ctrl+V 同一路徑） | PASS | Playwright + OS | Electron / `public.png` | 3/3 |
| ⑥ | BUG-130 有檔案 Control+V → 貼路徑 | PASS | Playwright + OS | 腳本 + Finder | 12/12 |
| ⑦ | BUG-130 純文字 Control+V → 一般貼上 | PASS | Playwright + OS | `pbcopy` | 2/2 |
| ⑧ | 選做：安裝版內嵌 claude CLI 2.1.316 ＋ 假模型，Ctrl+V → 輸入列出現 `[Image #1]` | PASS | Playwright | `public.png` | 1/1 |

⑧ 的對外連線：模型 API 0 次；被封鎖 proxy 記到 `CONNECT downloads.claude.ai:443`、`CONNECT github.com:443` 各一次（claude CLI 啟動時的檢查，已被擋下、沒有離開 runner）。

「次數」= 每個變體（按鍵 × 剪貼簿來源）重複 3 次的總和。每次按鍵前都先用獨立的 JXA 讀取確認剪貼簿的檔名清單正好是預期的檔案，不符就記為 setup 錯誤，不算 BAT 的結果。

## 與真人 Mac 實機的差異

可以代表實機的：

- 受測的是發佈出去的同一個 dmg（digest 比對過），不是 source build。
- 真的 macOS 15（Apple Silicon）、真的 Aqua 工作階段、真的系統剪貼簿（`NSPasteboard`），不是模擬。
- Finder 變體是 Finder 自己把選取項目放上剪貼簿（含 file reference URL、`com.apple.finder.noderef`），與使用者在 Finder 按 Command+C 的剪貼簿內容相同。
- OS 變體的按鍵經 System Events 送進視窗伺服器，走 app 的一般 `keyDown` 路徑（含主選單的 Paste 快捷鍵是否搶先），與實體鍵盤只差在硬體 / 輸入法那一層。

不能代表實機、仍需真人 Mac 才能確認的：

- 實體鍵盤、非英文輸入法（例如注音 / 拼音開著時按 Command+V）、非 US 鍵盤配置。
- 其他 macOS 版本（例如 macOS 26）；runner 只有 15。
- 使用者裝的剪貼簿管理工具或全域快捷鍵（會攔 Command+V）。
- 其他來源的檔案複製（Path Finder、VS Code 檔案總管、網路磁碟 / iCloud 項目）、非 ASCII（中文）檔名、大量檔案。
- 預設 shell：runner 的分頁是 bash（`SHELL=/bin/bash`），一般 Mac 是 zsh；兩者在 BAT 都是 posix 引號規則（`detectShellFamily`），預期相同，但沒有在 zsh 實測。
- 真的登入帳號的 claude CLI（⑧ 用假模型＋API key）；圖片佔位出現之後送出給模型的部分沒有測。

## 已知限制與陷阱

- **JXA 一次寫多個 NSURL**：run 41380312342（第一次）中，寫入程序一結束，另一個程序有時只讀到第一個 item（`items` 只有 1、`NSFilenamesPboardType` 只有第一個路徑），BAT 讀到的與剪貼簿一致，顯示成 BAT FAIL。修正：寫入腳本等到 item 數與檔名數都正確才結束，且每次按鍵前獨立確認剪貼簿內容。改 `mac-os.ts` 的寫入腳本時保留這兩道確認。
- **`[Image #1]` 的空白**：claude CLI 用游標移動畫出那個空白，去掉 ANSI 後是 `[Image#1]`；比對要用 `/\[Image\s*#\d+\]/`。
- `e2e/fixtures/electron-isolation.ts` 的 `TERMINAL_SERVER_SCRIPT` 是照 Windows 版面組的路徑（`<exe 目錄>/resources/app.asar/…`），macOS 的 `.app` 在 `Contents/Resources`，所以 teardown 的「殘留 Terminal Server 指令列比對」在 mac 上不會命中。實測 Terminal Server 在正常 quit 時就結束了（`alive after teardown: false`），影響只在 quit 失敗時。
- runner 映像的 TCC 授權（Finder / System Events 自動化、輔助使用、螢幕錄製）由 GitHub 的映像決定；之後的映像若收回，P2b / P4 / OS 截圖會變成 `不可行`，P3 / P5 的 Playwright 路徑不受影響。
- 剪貼簿是 runner 全域的，spec 不還原（runner 用完即丟）；不要在本機開發機上跑這個 spec。spec 在 `process.platform !== 'darwin'` 或沒有 `BAT_E2E_EXECUTABLE` 時跳過。

## 驗證清單（改 spec / workflow 時）

1. 本機：`npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module esnext --moduleResolution bundler --types node --esModuleInterop e2e/macos/*.ts` = 0；`npx playwright test e2e/macos/ --list` 列得出 1 個 test（Windows 上會在執行時跳過）。
2. push 後 dispatch，讀 job summary 的 `macos-report.md` 或下載 artifact。
3. 新增情境時沿用「每次按鍵前獨立確認剪貼簿」的做法，按鍵分 Playwright 與 OS 兩種、剪貼簿分腳本與 Finder 兩種，報告寫明是哪一種。
