# Linux 缺中文字型的啟動提示（PLAN-064 / T0827，D270 / D271）

> CLAUDE.md「Linux 缺中文字型的啟動提示（PLAN-064 / T0827）」節的完整說明。改這個功能時兩邊一起更新。

## 用途

Linux 版 BAT（Chromium）只用該系統 fontconfig 裡的字型。WSL 與精簡安裝的發行版預設沒有中文與 emoji 字型，zh-TW / zh-CN 介面整片變成方框，圖示（emoji）也一樣，使用者看不懂也不知道原因（2026-11-04 使用者回報，D270）。T0826 把原因與安裝指令寫進 README / 網站 `install#linux-fonts` / FAQ；T0827 讓 BAT 自己發現並提示一次。

## 必守規則

- 🔴 只有 Linux 主機檢查與提示。Windows / macOS：IPC handler 照樣註冊，但回 `unknown(not-linux)`；不排程、不 spawn、不記任何日誌、不會出現提示（`electron/__tests__/linux-font-check.test.ts`「not Linux」守住）。
- 🔴 不自帶字型、不改任何 CSS `font-family`、不改 xterm 字型設定（D270：Noto Sans CJK 每個字重 16–20 MB）。不阻擋任何功能，只提示。
- 🔴 `fc-list` 一律 `execFile` ＋陣列參數＋ `timeout`（`LINUX_FONT_CHECK_TIMEOUT_MS` = 5 s）＋ `windowsHide`，不經 shell；env 沿用主行程（與 Chromium 看到的 fontconfig 環境相同，例如 `FONTCONFIG_FILE`）。
- 🔴 延後到啟動之後：`app.whenReady` 裡 `startVoiceAvailabilityCheck()` 之後 `registerLinuxFontCheckHandlers(getAllWindows)` → `startLinuxFontCheck()`，計時 `LINUX_FONT_CHECK_DELAY_MS` = 5 s（`unref`）才 spawn；每次 BAT 啟動只排一次，結果只在記憶體。模組在 import 期不做任何事。
- 🔴 `unknown`（`pending` / `not-linux` / `no-fc-list` / `timeout` / `failed`）絕不提示。兩個查詢任一個失敗就整體 `unknown`（不拿半個答案提示）。
- 🔴 提示用 Dialog：`ModalOverlay`＋[X]＋`onEscape`（Esc = 關閉，不記「不再提示」）；不用 `window.alert` / `confirm`。
- 🔴 只本機主視窗、每次啟動一次：detached 視窗、remote profile 視窗（不論是否連上）不問主行程；主行程 `claimHint()` 只給第一個要的視窗。

## 判斷

| 查詢 | `fc-list` 參數 | 有輸出 = |
|---|---|---|
| 中文 | `:lang=zh family` | 有中文字型（`zh-cn` / `zh-tw` / `zh-hk` 的字型都會列出；WSL 實測與 `:lang=zh-tw`、`:lang=zh-cn` 同為 15 個 face） |
| emoji | `:charset=1f4e8 family`（U+1F4E8 📨） | 有 emoji 字型 |

- emoji 不用 U+1F600：DejaVu Sans（幾乎每台都有，`fonts-dejavu-core`）涵蓋 U+1F600–1F64F 表情區，但不涵蓋 BAT 用的其他 emoji（📨 U+1F4E8、📁 U+1F4C1、🔍 U+1F50D、✅ U+2705 實測只有 Noto Color Emoji 有）。只有 DejaVu 的系統查 1f600 會誤判為「有」。
- 輸出每行一個 face；非空白行數 = face 數（日誌只記數量）。`fc-list` 沒有符合時 exit 0、輸出空白 = 缺。

| 情況 | 結果 |
|---|---|
| 兩個查詢都有輸出 | `ok`（附 `cjkFamilies` / `emojiFamilies`） |
| 任一查詢輸出空白（exit 0） | `missing`（`cjk` / `emoji` 各一個布林） |
| `fc-list` 不存在（`ENOENT`） | `unknown(no-fc-list)` |
| 逾時被殺 | `unknown(timeout)` |
| exit ≠ 0、被訊號結束、其他 spawn 錯誤（`EACCES` …）、輸出超過 1 MiB、輸出不是文字（含 NUL） | `unknown(failed)` |
| 尚未檢查 | `unknown(pending)` |
| 非 Linux | `unknown(not-linux)` |

兩個查詢都失敗時原因取 `no-fc-list` > `timeout` > `failed`。

## 顯示條件

`linuxFontHintItems({ result, language, dismissed })`：

| 結果 | 介面語言 zh-TW / zh-CN | 介面語言 en |
|---|---|---|
| `missing` 中文＋emoji | 提示（中文＋emoji） | 提示（只列 emoji） |
| `missing` 只缺中文 | 提示（中文） | 不提示 |
| `missing` 只缺 emoji | 提示（emoji） | 提示（emoji） |
| `ok` / `unknown` | 不提示 | 不提示 |
| 已按「不再提示」 | 不提示 | 不提示 |

- 缺 emoji 不限語言（Worker 決定，T0827）：BAT 的圖示是 emoji，英文介面一樣會出現方框；同一則提示合併列出。
- 判斷時機：`profileReady`（設定與語言已載入）之後，拿到結果（開窗時 `get()`，之後主行程推送 `font-check:changed`）就判斷一次；第一次需要提示時才 `claimHint()`。

## 提示內容

- 標題與按鈕：`English / 中文`（介面是英文時只有英文）。
- 本文：英文段在前（`lang="en"`），介面語言段在後（灰字）。缺中文字型時中文本身是方框，英文那段一定看得懂。
- 指令（可選取＋「Copy / 複製」，`navigator.clipboard`）：`sudo apt update && sudo apt install -y <套件>`，只列需要的套件：中文 `fonts-noto-cjk`、emoji `fonts-noto-color-emoji`（`linuxFontInstallCommand`）。註明是 Debian / Ubuntu 指令。
- 「裝好後請完全關閉 BAT 再重新開啟」（Chromium 啟動時讀 fontconfig）。
- 「Details / 說明」：`shell.openExternal('https://gowerlin.github.io/better-agent-terminal/install#linux-fonts')`。
- 「Don't show again / 不再提示」：`settingsStore.setLinuxFontHintDismissed(true)`（`settings.json` 的 `linuxFontHintDismissed`，預設 false），之後不再出現。字型裝好後檢查結果是 `ok`，本來就不會出現。
- [X] / Esc / 「Close / 關閉」：只關閉，下次啟動仍會提示。
- 字串在 `src/locales/{en,zh-TW,zh-CN}.json` 的 `linuxFontHint.*`。

## 唯一實作

| 位置 | 內容 |
|---|---|
| `src/lib/linux-font-hint.ts` | 純函式（不 import electron / DOM）：`FC_LIST_QUERIES`、`LINUX_FONT_PACKAGES`、`LINUX_FONT_HINT_URL`、`LINUX_FONT_CHECK_IPC`、型別 `LinuxFontCheck`、`countFcListLines`、`linuxFontCheckFromRuns`、`linuxFontCheckLogLine`、`isChineseLanguage`、`linuxFontHintItems`、`linuxFontInstallCommand` |
| `electron/linux-font-check.ts` | `createLinuxFontCheck`（排程、執行、去重、`claimHint`、訂閱）、`getLinuxFontCheck`（行程單例）、`registerLinuxFontCheckHandlers`、`startLinuxFontCheck` |
| `electron/main.ts` | `startVoiceAvailabilityCheck()` 之後註冊 handler 並排程 |
| `electron/preload.ts` / `src/types/electron.d.ts` | `electronAPI.fontCheck.get()` / `claimHint()` / `onChanged(cb)`（型別上 optional：舊 preload 沒有時元件什麼都不做） |
| `src/components/LinuxFontHint.tsx` | `LinuxFontHint`（取結果、判斷、claim）、`LinuxFontHintDialog`（畫面） |
| `src/App.tsx` | `<LinuxFontHint enabled={profileReady && !detachedWorkspaceId && !windowBoundToRemote && !isRemoteConnected} />`；`windowBoundToRemote` 在 `initProfile` 判斷到 remote profile 時設定 |
| `src/stores/settings-store.ts` / `src/types/index.ts` | `setLinuxFontHintDismissed` / `linuxFontHintDismissed` |

## IPC

本機 `ipcMain.handle`（不在 `PROXIED_CHANNELS`、不是 helper channel；headless bat-server 沒有）：

| channel | 方向 | 內容 |
|---|---|---|
| `font-check:get` | renderer → main | 目前結果（檢查前 `unknown(pending)`；非 Linux `unknown(not-linux)`） |
| `font-check:claim-hint` | renderer → main | 第一個呼叫回 `true`，之後 `false`；非 Linux 一律 `false` |
| `font-check:changed` | main → 所有視窗 | 檢查完成時推送（`getAllWindows()`） |

## 日誌

- 主行程每次檢查一行：
  - `[font-check] ok in 17 ms (cjk faces=15, emoji faces=1)`
  - `[font-check] missing cjk=true emoji=true in 9 ms (cjk faces=0, emoji faces=0)`
  - `[font-check] unknown(no-fc-list) in 3 ms`、`[font-check] unknown(failed) in 5 ms: exit 1`
- 提示交給視窗：`[font-check] hint handed to a window`。
- renderer（`debug.log`）：`[font-check] hint shown: cjk=true emoji=true language=zh-TW`、`[font-check] hint dismissed (don't show again)`。
- 🔴 不記字型清單（只記 face 數）。非 Linux 不記任何一行。

## 遠端 / detached 視窗

- 介面一律在本機渲染，字型是本機 Linux 的事；remote profile 視窗（WSL / SSH / Docker）與 detached 視窗不顯示，只本機主視窗。遠端主機缺字型只影響終端分頁內容在本機的顯示（同樣看本機字型），不需要在遠端檢查。
- remote profile 視窗的 `settings.json` 是遠端主機的，所以「不再提示」只存在本機視窗的設定。

## 已知限制

- 只認 Debian / Ubuntu 的套件名；其他發行版文字有註明「套件名稱可能不同」，不偵測發行版。
- 「不再提示」之後若字型被移除，不會再提示（要清 `linuxFontHintDismissed`）。
- 只查「有沒有任何中文字型」：只裝了只含簡體字形的字型時，繁體罕用字仍可能是方框（Noto CJK 一包涵蓋 SC / TC / HK）。
- 同一次啟動只有一個視窗拿到提示；那個視窗關掉提示後，其他本機視窗不會再提示，下次啟動才會。
- 切換介面語言時元件會重新判斷（例如英文介面只缺中文字型、改成中文後立刻提示）；已經提示過一次的那次啟動不會再提示。

## 實測（T0827，WSL Ubuntu 24.04，fontconfig 2.15.0）

以 esbuild 把 `electron/linux-font-check.ts` 打包成 harness（真的 `child_process.execFile`、`platform = linux`），在 WSL 執行：

| 情境 | 結果 |
|---|---|
| 已裝 `fonts-noto-cjk` / `fonts-noto-color-emoji` | `[font-check] ok in 17 ms (cjk faces=15, emoji faces=1)` |
| `FONTCONFIG_FILE` 只含 `/usr/share/fonts/truetype/dejavu`（模擬 WSL 預設） | `[font-check] missing cjk=true emoji=true in 9 ms`（查 U+1F600 會因 DejaVu Sans 誤判為有） |
| `FONTCONFIG_FILE` 沒有任何字型目錄 | `[font-check] missing cjk=true emoji=true in 7 ms` |
| `PATH=/nonexistent`（沒有 `fc-list`） | `[font-check] unknown(no-fc-list) in 3 ms` |

## 驗證清單

- 單元測試：`electron/__tests__/linux-font-check.test.ts`（fc-list 參數 / timeout / 每種結束方式 / 排程一次 / claim 一次 / 非 Linux 不 spawn 不記錄 / IPC / main.ts 接線）、`src/lib/__tests__/linux-font-hint.test.ts`（解析、日誌、語言 × 結果 × 不再提示、指令）、`src/components/__tests__/linux-font-hint.test.tsx`（顯示、英文在前、[X] / Esc / 關閉 / 不再提示 / 說明、停用視窗不問主行程、別的視窗已 claim、三語字串、App.tsx 接線）。
- `dialog-escape.test.tsx` / `dialog-no-outside-close.test.tsx` 的 source guard 涵蓋新 Dialog（有 `onEscape`）。
- 實機（待驗收）：Linux AppImage（WSL 無中文 / emoji 字型、zh-TW 介面）啟動 5 s 後出現提示、英文可讀、複製指令可用、「說明」開網站、「不再提示」後重開不再出現；裝好字型完全重開後不出現；英文介面＋只缺中文字型不出現；Windows / macOS 啟動日誌沒有 `[font-check]`。
