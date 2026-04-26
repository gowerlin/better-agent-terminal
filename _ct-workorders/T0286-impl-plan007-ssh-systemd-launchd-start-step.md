# T0286 — Impl PLAN-007 SSH start-server step（systemd unit + launchd plist）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0286 |
| 類型 | impl |
| Phase | PLAN-007 Phase 4（SSH deployment）第五張 |
| 狀態 | ✅ DONE（clean DONE，無 PARTIAL；8 files / +851 lines / -1；worktree commit `70417d4`） |
| 建立時間 | 2026-04-26 15:05 (UTC+8) |
| 派發時間 | 2026-04-26 15:05 (UTC+8) |
| 完成時間 | 2026-04-26 15:15 (UTC+8) |
| Wall time | ~10 min（GP099 校準 15-30 min 預期，第五次連續落於下界以下） |
| Worktree commit | `70417d4` on `feature/plan-007-remote-dev` |
| Sizing | M（spec 估 4-8h；GP099 校準後預期 wall 15-30 min — 兩段 unit/plist template + ssh exec 寫入 + start command） |
| 依賴 | T0285 ✅（install-server-bundle wizard step / ssh-bundle-uploader / ssh-setup-handlers）、T0282 ✅（profile schema serverHome / targetOS） |
| 後續 | T0287（SSH e2e + cross-OS matrix，依本工單 start-server 完成端到端可連） |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-start-server.ts`（新建）、`src/components/setup-wizard/steps/ssh/start-server.ts`（新建）、`src/components/setup-wizard/ssh-flow.ts`（擴 wizard step list）、`electron/remote/ssh-setup-handlers.ts`（加 `ssh:start-server` handler）、`tests/ssh-start-server.test.ts`（新建） |

## 目標

落地 T0266 §4 凍結 spec：在 SSH wizard 加 `start-server` step，依 server `targetOS`（從 verify-ssh-auth probe 結果或 `uname` 自動判斷）寫入對應 service unit 並啟動：

| Server OS | 路徑 | 啟用命令 |
|-----------|------|----------|
| `ssh-linux` | `~/.config/systemd/user/bat-server.service` | `loginctl enable-linger $USER && systemctl --user daemon-reload && systemctl --user enable --now bat-server` |
| `ssh-darwin` | `~/Library/LaunchAgents/com.bat-server.plist` | `launchctl load -w ~/Library/LaunchAgents/com.bat-server.plist` |

成功條件：service active + bat-server 監聽 `localhost:51820`（驗證 `pgrep -x bat-server` 或 `ss -tnlp | grep 51820`）。

## 範圍

### 新增

#### 後端（electron/remote/）

1. **`ssh-start-server.ts`** — start-server 後端純函數
   - `export async function startServerOnRemote(opts: StartServerOptions): Promise<StartServerResult>`
   - opts：
     ```ts
     interface StartServerOptions {
       sshHost: string
       sshUser: string
       sshPort?: number
       sshKeyPath?: string
       targetOS: 'ssh-linux' | 'ssh-darwin'
       installPath: string        // ~/.local/bat-server（v1 only，sudo /opt 排除 D-SSH-8）
       serverPort?: number        // default 51820
       serverHome: string         // 從 verify-ssh-auth probe 解出（給 systemd %h fallback / launchd /Users/<user>）
     }
     ```
   - result：
     ```ts
     interface StartServerResult {
       ok: boolean
       method: 'systemd' | 'launchd' | 'failed'
       servicePath: string         // 成功時 unit/plist 落地路徑
       checkOutput?: string        // 啟動後驗證（pgrep / ss）的 stdout
       error?: string
       errorCode?: 'unit-write-failed' | 'enable-failed' | 'start-failed' | 'verify-failed' | 'unknown'
     }
     ```
   - 流程：
     1. 依 `targetOS` 渲染 unit/plist content（template literal 內嵌 `installPath` / `serverPort` / `serverHome`）
     2. **systemd 路徑**（targetOS === 'ssh-linux'）：
        - heredoc 寫入：`ssh user@host "mkdir -p ~/.config/systemd/user && cat > ~/.config/systemd/user/bat-server.service << 'EOF'\n<unit content>\nEOF"`
        - 啟用：`ssh user@host "loginctl enable-linger \$USER && systemctl --user daemon-reload && systemctl --user enable --now bat-server"`
        - 驗證：`ssh user@host "systemctl --user is-active bat-server && ss -tnlp 2>/dev/null | grep ':51820'"`（注意 ss 在某些 distro 需 sudo，dev fail 不阻塞，改 fallback `pgrep -x bat-server`）
     3. **launchd 路徑**（targetOS === 'ssh-darwin'）：
        - 寫入：`ssh user@host "mkdir -p ~/Library/LaunchAgents && cat > ~/Library/LaunchAgents/com.bat-server.plist << 'EOF'\n<plist content>\nEOF"`
        - 啟用：`ssh user@host "launchctl load -w ~/Library/LaunchAgents/com.bat-server.plist"`
        - 驗證：`ssh user@host "launchctl list | grep com.bat-server && pgrep -x bat-server"`
     4. **錯誤處理**：每個階段獨立 errorCode；unit 寫入失敗 → `unit-write-failed`、enable/load 失敗 → `enable-failed`、start 失敗 → `start-failed`、驗證失敗 → `verify-failed`
     5. **沿用 D042 secure spawn pattern**（dynamic-import + execFile / spawn 不過 shell；heredoc 內容直接傳 stdin，避免 quoting nightmare）
   - **單引號注入防護**（沿用 T0285 加的 guard）：`installPath` / `serverHome` / `sshHost` / `sshUser` 在組 ssh 命令時走 escapeSingleQuotes helper（沿用 T0285 既有實作）

2. **`electron/remote/ssh-setup-handlers.ts`**（已建於 T0285，本工單擴充）
   - 新增 `ssh:start-server` IPC channel 呼叫 `startServerOnRemote`
   - 新增 `ssh:start-progress` event（namespace 不衝突 T0270 channel set；progress payload 區分 phase: `'writing-unit' | 'enabling' | 'starting' | 'verifying'`）

#### 前端（src/components/setup-wizard/）

3. **`steps/ssh/start-server.ts`** — wizard step component
   - mount 後立即呼叫 `ssh:start-server` IPC（透過 `electronAPI.ssh.startServer`）
   - 顯示分階段進度：
     ```
     ⏳ Writing systemd unit...        ✓
     ⏳ Reloading systemd daemon...    ✓
     ⏳ Enabling and starting bat-server... ✓
     ⏳ Verifying service is active... ✓
     ✓ bat-server is running (PID 12345, listening on localhost:51820)
     ```
   - errorCode 對應引導：
     - `unit-write-failed` → 「磁碟 quota / `~/.config/systemd/user` 權限缺」+ 顯示 stderr
     - `enable-failed` → 顯示 `loginctl enable-linger` 失敗 → 引導使用者跑 `sudo loginctl enable-linger <user>`（v1 接受 manual fallback）
     - `start-failed` → 顯示 `journalctl --user -u bat-server` 後 20 行（從 stderr 解出）+ 引導使用者貼回 BAT issue tracker
     - `verify-failed` → 服務似乎啟動但驗證失敗 → 顯示原始 stdout，引導使用者手動 `systemctl --user status bat-server`

4. **`ssh-flow.ts`**（已建於 T0285，本工單擴充）
   - `buildSshWizardSteps` 把 `startServerStep` 加在 `installServerBundleStep` 之後、`fetchFingerprintStep` 之前

#### 測試

5. **`tests/ssh-start-server.test.ts`** — node:test runner，沿用 T0284/T0285 mock 風格
   - test1：`targetOS='ssh-linux'` → unit content 含 `Restart=on-failure` + `WantedBy=default.target`
   - test2：`targetOS='ssh-darwin'` → plist content 含 `<key>KeepAlive</key>` + `Crashed` true
   - test3：systemd 路徑：3 個 ssh exec 順序正確（write → enable → verify）
   - test4：launchd 路徑：3 個 ssh exec 順序正確（write → load → verify）
   - test5：unit 寫入失敗 → errorCode='unit-write-failed'，且**不**繼續跑 enable
   - test6：enable 失敗 → errorCode='enable-failed'，且**不**繼續跑 verify
   - test7：installPath 含單引號（`O'Brien`）→ ssh 命令正確 escape，無 injection
   - test8：unit content template variable 注入正確（serverPort=51820 → unit 內 `BAT_REMOTE_PORT=51820`）
   - 至少 8 個 case，全 mock spawn

### Out of scope（不做）

- ❌ 不寫 `/opt/bat-server` sudo 安裝（D-SSH-8 排除 v1）
- ❌ 不寫 nohup + cron 兜底（spec §4 標明只在 systemd/launchd 都不可用才走，v1 排除，留將來工單）
- ❌ 不動 fetch-fingerprint / connect-test step（T0182 凍結）
- ❌ 不動 PathTranslator / SshTunnel（T0282/T0284 已落）
- ❌ 不寫 server-side BAT_REMOTE_PORT 動態挑（v1 hardcoded 51820）
- ❌ 不引入 ssh2 npm（D-SSH-1）
- ❌ 不在 BAT 處理 SELinux / AppArmor 政策（user-level systemd 不需，spec §4 已驗證）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §4（L455-548） | systemd unit + launchd plist 完整 template + 啟用命令 + 對比表 |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4 §6 | start-server step 凍結 + 權限需求 |
| `electron/remote/ssh-bundle-uploader.ts`（T0285） | escapeSingleQuotes helper + ssh exec pattern + spawn deps injection |
| `electron/remote/ssh-setup-handlers.ts`（T0285） | IPC handler 註冊 pattern |
| `electron/remote/ssh-auth-probe.ts`（T0285） | targetOS 判定（從 uname 解 linux/darwin）+ serverHome（從 echo HOME 解） |
| `tests/ssh-bundle-uploader.test.ts`（T0285） | mock spawn + injection guard 測試風格範本 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/remote/ssh-start-server.ts` 存在，export `startServerOnRemote(opts)` + `StartServerOptions` / `StartServerResult` interface | grep + 檔案存在 |
| AC2 | systemd unit content 完整含 7 個必要欄位（Description / After / Type=simple / ExecStart / Restart=on-failure / RestartSec=5s / WantedBy=default.target）+ 兩個 Environment（BIND / PORT） | 寫進 ssh-start-server.test.ts test1 |
| AC3 | launchd plist content 完整含 6 個必要 key（Label / ProgramArguments / EnvironmentVariables / RunAtLoad / KeepAlive.Crashed=true / KeepAlive.SuccessfulExit=false） | 寫進 ssh-start-server.test.ts test2 |
| AC4 | systemd 路徑 3 個 ssh exec 順序正確（write → enable → verify），任一失敗 abort 不繼續 | 寫進 test3/test5/test6 |
| AC5 | launchd 路徑 3 個 ssh exec 順序正確（write → load → verify） | 寫進 test4 |
| AC6 | 單引號注入防護：`installPath` / `serverHome` / `sshHost` / `sshUser` 含單引號時 ssh 命令正確 escape，無 shell injection | 寫進 test7 |
| AC7 | wizard step 元件 `start-server.ts` 存在，分階段進度顯示 + 4 個 errorCode 對應引導 modal | grep + visual review |
| AC8 | `ssh-flow.ts::buildSshWizardSteps` 把 startServerStep 插在 installServerBundle 之後 / fetchFingerprint 之前 | grep + step 順序檢查 |
| AC9 | `ssh:start-server` IPC channel 註冊在 `ssh-setup-handlers.ts`；`ssh:start-progress` event payload 含 `phase` 欄位 | grep `ipcMain.handle\|ssh:start` |
| AC10 | `npx tsx tests/ssh-start-server.test.ts` 全綠至少 8 case；TypeScript strict 通過（除 baseline BUG-061 豁免） | 跑指令 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。**嚴禁切回 main**。
2. **commit message**：`feat(remote): T0286 SSH start-server step (systemd + launchd)\n\n工單：T0286\n依賴：T0282 / T0285\n落地 T0266 §4 凍結 spec`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0286-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob。
5. **emoji**：除 wizard UI 顯示 ⏳ ✓ ✗ 外禁用。
6. **Channel set 凍結**：T0270 凍結 channel set；本工單可加 `ssh:start-server` + `ssh:start-progress`（`ssh:*` namespace 不破既有命名）。
7. **單引號注入防護必做**：所有 ssh 命令組裝走 escapeSingleQuotes helper（沿用 T0285）；test7 必須驗證。
8. **不真連 ssh**：tests 必須 mock spawn，禁止真連任何 host。
9. **D042 secure spawn**：所有 spawn ssh 走 dynamic-import + execFile / spawn 不過 shell pattern。
10. **heredoc EOF 必須單引號包**（`<< 'EOF'`）：避免 server 端 shell 把 unit content 內的 `$USER` / `%h` 等變數展開（systemd 自己會解 `%h`，shell 不該插手）。
11. **completion 判定**：10 個 AC 全過或 ≥ 8 → 完成訊息 `T0286 完成`，否則 `T0286 部分完成：<AC# + 原因>`。

## 預期 wall

**15-30 min**（GP099 校準後；T0266 §4 給 unit/plist template 逐字 + T0285 ssh-bundle-uploader 已建 escapeSingleQuotes + spawn deps injection pattern，主要工作為 template literal 渲染 + 3 階段 ssh exec 鏈接 + 8 個 mock test）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0286 完成」訊息後從本檔讀回報區）
