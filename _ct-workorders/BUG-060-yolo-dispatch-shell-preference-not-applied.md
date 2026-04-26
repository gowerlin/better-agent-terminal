# BUG-060 — YOLO 鏈式派發第二張工單起,BAT 終端 shell preference 未套用 Settings 配置

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-060 |
| 標題 | YOLO 鏈式派發第二張工單起,BAT 終端 shell preference 未套用 Settings 配置(預設 git bash + codex cli,實際開 PowerShell/pwsh)|
| 嚴重度 | 🟡 Medium |
| 可重現 | 100%(本 session 第一張 T0277 正確,T0278/T0279/T0280 連續 3 張錯誤)|
| Workaround | 不確定(待調查;可能解:每次手動關閉 BAT 終端後重派 / 強制重啟 BAT process) |
| 狀態 | 🧪 VERIFY（BAT 已重建+重啟 2026-04-26 ~13:50 by 使用者；進入 Phase 4 鏈式觀察期 — T0282+ 派發過程中觀察 shell preference 是否從第二張起仍保持 git bash + codex；Phase 4 跑完 1-2 張仍正常即可 CLOSED） |
| 修復工單 | T0281 ✅ DONE(2026-04-26 13:20)|
| 根因 | H4:remote terminal creation 沒 resolve/pass persisted shell preference,PTY fallback Windows 預設 PowerShell |
| 主線 commit | `fad2978` on `main` |
| 建立時間 | 2026-04-26 13:08 (UTC+8) |
| 報告者 | Gower(human via 塔台 *bug)|
| 影響範圍 | YOLO 鏈式派發 / `auto-session: yolo` 模式 / BAT 內部終端開啟流程 |

## 現象

### 預期行為

使用者在 BAT Settings 指定:
- `shell` = `git bash`(MSYS2 / MINGW64 環境)
- `agent` = `codex cli`(對應 default agent 的綁定)

塔台呼叫 `bat-terminal.mjs --agent default --prompt "/ct-exec T####"` 時,BAT 應依 Settings 開啟 git bash 並在其中啟動 codex cli。

### 實際行為

- **第一張工單**(本 session T0277,2026-04-26 12:00)— 行為正確(git bash + codex cli)
- **第二張及之後**(T0278 12:16 / T0279 12:31 / T0280 13:03)— BAT 改開 **PowerShell / pwsh**,在其中啟動 codex(shell preference 失效)

### Reproduce steps(本 session 觀察)

1. BAT Settings 設定 `shell=git bash` / `agent=codex cli`(對應 default agent)
2. 塔台從另一個 terminal 透過 `bat-terminal.mjs --notify-id <id> --workspace <id> --mode yolo --no-interactive --agent default --prompt "/ct-exec T0277"` 派發第一張 → BAT 開新終端,**正確**用 git bash + codex
3. 第一張完成,塔台自動派發第二張(同樣命令格式,僅 `--prompt` 內 ID 變)→ BAT 開新終端,**錯誤**改用 PowerShell + codex
4. 後續鏈式派發第三、第四張同樣錯誤

## 假設(待驗證)

幾種可能根因:

1. **Process env 污染**:`bat-terminal.mjs` 從塔台的 PowerShell process spawn,後續 IPC 把 parent shell 帶下去(第一次有快取空白,第二次起讀到 PowerShell 為 default shell)
2. **Settings reload 只在 BAT 啟動時**:第一張派發前 Settings 為 cold load 正確;第二張起 BAT 內部某 cache 被覆蓋為「上次開啟用的 shell」
3. **default agent 解析 race**:`--agent default` 第一次解析正確,後續解析跑到 fallback path
4. **terminal_create IPC 的 shell hint 沒帶**:`bat-terminal.mjs` 的 `--no-interactive` 模式可能沒帶 shell hint,BAT 預設用 process platform shell(Windows = pwsh)

需做的調查:
- 看 `bat-terminal.mjs` source(本工單 BUG 不修,留給修復工單)
- 看 BAT main process 的 terminal_create handler
- 看 BAT Settings → shell preference 的存取點

## 影響評估

- **不阻擋 yolo 鏈式**(codex 在 pwsh 也能跑)→ Severity Medium
- **影響 UX 一致性**(使用者明確設定不被尊重)
- **可能影響某些 codex 命令**(如果某些指令依賴 git bash 環境,如 inline shell-out 用 POSIX 路徑)
- **影響範圍可能不限 yolo**:其他派發路徑(`auto-session: on/ask`)是否也有此 bug 待驗

## 後續處理

待塔台與使用者決定:
- `[A]` 立即派修復工單(BUG → FIXING)
- `[B]` 先記錄,Phase 3 收尾後處理(BUG 留 OPEN)
- `[C]` 標記 WONTFIX(不修)

## 相關

- 影響工單:T0278 / T0279 / T0280(本 session 連續 3 張 yolo 派發遭遇此 bug)
- 相關 source(待修復工單調查):`scripts/bat-terminal.mjs`、`electron/pty-manager.ts`(shell preference 註入點)、BAT main process 的 terminal_create IPC handler、BAT Settings store 的 shell preference 取用路徑
- 不直接相關但語境相關:PLAN-027(Claude Runtime Selection 跨平台 playbook)、BUG-059(embedded claude auto-update 停用,同樣涉及 spawn env 注入)

---

## 驗收 / 結案紀錄

(尚無)

---
