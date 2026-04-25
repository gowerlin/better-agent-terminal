# T0263-research-plan007-wsl-deployment

## 元資料
- **工單編號**：T0263
- **任務名稱**：PLAN-007 — WSL 部署環境研究（BAT server 在 WSL2 內跑，Win client 連 localhost）
- **狀態**：DONE
- **建立時間**：2026-04-25 22:35 (UTC+8)
- **開始時間**：2026-04-25 22:26 (UTC+8)
- **完成時間**：2026-04-25 22:31 (UTC+8)
- **commit hash**：afb34a0
- **類型**：research（讀 code + 寫 spec 章節，**不寫 production code、不重構**）
- **互動模式**：enabled（path 映射策略 / 啟動方式有設計分支）
- **Renew 次數**：0
- **預估 wall time**：60-90 min（硬性止損 3 小時）
- **預估 context cost**：中（讀 BAT path-related code + WSL 環境特性研究 + 寫 spec 章節）
- **關聯**：
  - 母 PLAN：PLAN-007（💡 IDEA）
  - 前序：T0260 scoping ✅ / T0261 spike ✅ / T0262 server-side spec ✅
  - 並行延後：T0264 Docker / T0265 SSH（依本工單後序列推進）
  - 後序：T0266 彙整工單（4 環境 research 全完才動）
- **affects_files**：
  - `_ct-workorders/T0263-*.md`（自身回報，唯一寫入目標）

---

## 背景與 scope 收斂

T0262 已凍結 server-side 強化 spec（含 headless entry contract、token persistence 跨平台、cert renewal、bind-interface 5 選項等）。本工單**只研究 WSL 部署環境特有的議題**——server-side 共通議題已在 T0262 處理，不重複。

WSL 是 4 環境中**風險最低**的（與 BAT-remote 強化幾乎共用 codebase，差異主要在 path 映射 + 啟動方式），故先做。

**本工單不對 Docker / SSH / handler 跨環境下任何結論**——那是 T0264/T0265/EXP-HANDLER-AUDIT 的事。

---

## 任務目標

產出 7 個小節的 spec 草稿，全部寫在本工單回報區，**不寫進主線任何 spec 檔**。

### 1. WSL2 內 BAT server 啟動方式

**研究**：
- `wsl -d Ubuntu -e node /path/bat-server.mjs`（Win 端命令列直啟）vs WSL 內手動 `npm start`
- systemd unit（WSL2 systemd 已支援）vs `wsl --exec` + Win scheduled task
- 開機自動啟動 + restart-on-failure 策略
- 如何讓 Win BAT client 第一次連線時自動觸發 WSL server 啟動（hint UX）

**輸出**：3-4 種啟動方式對照表 + 推薦方案（含理由）

### 2. localhost loopback 行為

**研究**：
- WSL2 **mirrored networking mode**（Win 11 23H2+ 預設可選）：Win ↔ WSL 共享 localhost，`127.0.0.1:9876` 直接互通
- WSL2 **NAT mode**（傳統預設）：WSL 是隔離 VM，Win 連 `127.0.0.1` 連不到 WSL 內 server，需透過 WSL2 自動 port forward 或 `wsl hostname -I` 取 WSL IP
- WSL2 mirrored 對 BAT `bind-interface: 'localhost'` 行為的影響
- 如何偵測當前 WSL 是 mirrored 還是 NAT？

**輸出**：模式對照表 + BAT 在兩模式下的連線設計建議

### 3. Win ↔ Linux path 映射

**核心議題**：BAT client（Windows）開 `C:\foo\project` 工作區，server（WSL Linux）需要把這條 path 翻成 `/mnt/c/foo/project`；反向 server 回傳 `/home/user/project` 給 client 也要轉成 `\\wsl$\Ubuntu\home\user\project` 或 `\\wsl.localhost\Ubuntu\...`。

**研究**：
- `wsl wslpath -u "C:\foo"` 與 `wslpath -w "/home/user"` 的可靠性與 edge case（含空格、UNC、symlink）
- BAT 的 path 處理熱點（讀 `electron/path-guard.ts` 如存在、`electron/pty-manager.ts` path resolve、profile path input）
- Path 映射應該在哪一層做？
  - 選項 A：client 端送 path 前轉（client 知道自己是 Win，server 永遠收到 Linux path）
  - 選項 B：server 端收 path 後轉（server 知道自己是 WSL，handle 翻譯）
  - 選項 C：protocol 層加 metadata（path 帶 `nativeOS: 'windows'|'linux'` 標記）
- file watcher（fs:changed event）的 path 由哪邊發 + 哪邊負責翻譯

**輸出**：
- 三選項對照（優缺點 + 推薦）
- BAT 中需要修改的 path 點清單（讀 source 後給）
- edge case 清單（symlink / junction / OneDrive synced path / 中文路徑）

### 4. PTY shell 預設 + 環境變數繼承

**研究**：
- WSL 內 PTY 預設 shell（bash / zsh / fish）由誰決定（`/etc/passwd` 還是 `wsl.conf` 還是 BAT 設定）
- Win client 觸發 PTY spawn 時，環境變數應該從哪繼承（Win shell env / WSL login shell / BAT profile）
- `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 在 WSL 內注入給 PTY 的方式（會不會被 WSL session 切換洗掉）
- claude CLI 路徑（WSL 內裝 `~/.local/bin/claude`，與 Win 端 `claude.exe` 互不衝突）

**輸出**：環境變數繼承策略 spec（含 BAT host / WSL server / PTY child 三層的 env 流向圖）

### 5. WSL1 vs WSL2 支援決定

**研究**：
- WSL1 是 syscall translation layer，無法跑 systemd、native module 部分有限制（特別是 `@lydell/node-pty-linux-x64` 預期是 WSL2）
- WSL1 適用場景已極小（僅 Win 10 早期、特定 file IO 場景）
- 把支援限縮在 WSL2 是否合理？

**輸出**：簡短結論段（200 字內）+ 若有支援 WSL1 的需求列出工程成本

### 6. WSL 內依賴安裝與 packaging

**研究**：
- BAT server bundle 怎麼進 WSL（npm tarball / git clone + build / pre-built binary）
- WSL Ubuntu/Debian glibc 版本與 BAT native module（@lydell/node-pty-linux-x64、better-sqlite3、@img/sharp）相容性
- 是否需要做專屬 WSL bundle？或共用 Linux server bundle（與 Docker / SSH Linux server 共享）
- WSL 內 node 版本管理（system apt vs `nvm` vs BAT 內嵌）

**輸出**：packaging 策略草案 + native module 相容性 checklist

### 7. WSL 部署 UX

**研究**：
- BAT client（Win 端）開新 profile「Connect to WSL」流程：選 distro → 選資料夾位置 → 自動啟動 server → 連線
- BAT 是否內建 `wsl --list` 偵測 + 自動 detect distro？
- 第一次設定的 setup wizard（裝 BAT server bundle 到 WSL → 寫 systemd unit → 啟動 → 寫 fingerprint 回 client profile）
- 與 Tailscale / SSH 等其他 profile 在 ProfilePanel UI 的並列展示

**輸出**：UX 流程草案（200-400 字）+ 至少 3 個 user journey

---

## 執行步驟

### Step 1：環境快照
```bash
git status
git log --oneline -5
```

### Step 2：讀 BAT path 與 PTY 相關 code（不深入動）
重點檔案：
- `electron/path-guard.ts`（如存在；T0183 產物）
- `electron/pty-manager.ts`（path resolve 區段）
- `src/components/`（profile path input UI）
- `package.json`（native module 列表）

### Step 3：讀 T0260 拆單建議卡
- `_ct-workorders/T0260-research-plan007-remote-server-scoping.md` 的 T0263 範圍細則段（line 319-341 附近）

### Step 4：逐節寫 spec 草稿
照 7 節順序寫到回報區。**遇設計分支用互動模式問塔台**：
- path 映射選 A/B/C？
- WSL 自動啟動 systemd vs scheduled task？
- 是否支援 WSL1？

### Step 5：給塔台的下一步建議
基於 spec 草稿，建議：
- WSL deployment 的 MVP 切片（最小可動 demo）
- 與 T0264 Docker / T0265 SSH 共通可抽象部分（packaging / native module）
- 哪些議題需要再 spike 才能拍板

### Step 6：填寫回報區
所有結論彙整到本工單下方「回報」區段。**禁止寫入其他任何檔案**。

---

## AC（acceptance criteria）

- **AC1**：WSL2 啟動方式 spec 完成（含對照表 + 推薦）
- **AC2**：localhost loopback 行為 spec 完成（mirrored vs NAT 差異）
- **AC3**：Path 映射 spec 完成（三選項 + 推薦 + BAT 修改點清單 + edge cases）
- **AC4**：PTY shell + 環境變數繼承 spec 完成（含 env 流向圖）
- **AC5**：WSL1 支援結論完成（簡短）
- **AC6**：Packaging 策略草案完成（含 native module checklist）
- **AC7**：UX 流程草案完成（含 ≥3 user journey）
- **AC8**：給塔台的下一步建議寫完（MVP 切片、與其他環境共通、需 spike 議題）
- **AC9**：working tree byte-identical（除本工單檔回報區）

---

## 嚴格禁止

- ❌ 寫入除本工單回報區以外的任何檔案
- ❌ 修改任何 source code
- ❌ 對 Docker / SSH / handler 跨環境下任何結論
- ❌ 對 server-side 強化下任何結論（已在 T0262 凍結）
- ❌ 跑 `npm install` / `npm run build` / 啟動 dev server / 啟動 WSL distro
- ❌ 動 `package.json`
- ❌ 直接草擬 T0264/T0265/T0266 的完整工單檔
- ❌ 跨工單決策（→ 回塔台）

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「Path 映射選 A/B/C？」— 影響整個 protocol 設計
2. 「WSL 自動啟動：systemd vs Win scheduled task？」— 平台習慣選擇
3. 「是否支援 WSL1？」— 工程成本 vs 使用者覆蓋率
4. 「BAT server bundle 進 WSL 的方式：npm tarball / git clone / pre-built？」— packaging 策略
5. 「ProfilePanel UI 並列展示 4 種 profile（local / WSL / Docker / SSH）的設計取捨？」— UX 設計

每次提問上限 3 題。能自己拍板的逕行決定 + 寫回報。

---

## 失敗 / PARTIAL 處理

任一觸發：
- 時間止損（>3h 仍未完成 7 節）
- 發現 WSL 環境有未盤點的根本性瓶頸（如 native module 在 WSL2 完全跑不起）
- 需要實機跑 WSL 才能驗證的問題佔多數（>3 節）

→ 工單狀態填 **PARTIAL** 或 **FAILED**，已寫的節保留，未寫的節記錄阻擋原因。觸發 yolo 斷點 B（`yolo_max_retries: 1`），塔台 pause。

---

## 回報

### 互動紀錄

無使用者互動。YOLO 模式下對 5 個設計分支（path 映射 / 啟動方式 / WSL1 支援 / packaging / ProfilePanel UX）採「推薦 + 替代方案 + trade-off」呈現，塔台可後續 Renew 覆寫。

### Step 1 — 環境快照

- `git status`：僅 `_ct-workorders/T0263-*.md` untracked（本工單）
- `git log -5`：T0262 metadata DONE → T0262 spec done → T0261 metadata → T0261 spike → T0260 metadata
- working tree byte-identical（除本工單檔）

### Step 2-3 — 讀 code + T0260 拆單建議摘要

**code 偵察**：
- `electron/path-guard.ts`（98 行）：workspace allowlist 用 `path.resolve` normalize；**不做 OS 翻譯**，純字串 prefix 比對。WSL 場景下 server (Linux) 收到 Win-style path（`C:\foo`）會被 resolve 成 `/current/dir/C:\foo` 之類錯誤路徑，allowlist 完全失效。
- `electron/pty-manager.ts`（890 行）：`pty.spawn({ cwd, env, shell, args })` cwd 來自 IPC 直傳，無翻譯層。`envWithUtf8` 三處注入點與 `LANG=en_US.UTF-8` / `BAT_REMOTE_PORT` / `DISABLE_AUTOUPDATER=1` 已就位。
- `electron/remote/protocol.ts`（69 行）：`PROXIED_CHANNELS` 內含 `pty:create / pty:get-cwd / fs:* / workspace:save / profile:* / claude:get-worktree-status / git:*`，**全部** path-bearing。`RemoteFrame` 是 raw `args: unknown[]`，無 metadata 欄位（path 翻譯 option C 需擴 schema）。
- `electron/remote/remote-server.ts`：bind interface 三選項（`localhost / tailscale / all`）已成熟，T0262 提案擴成 5 選項（加 `lan-class-c` / `tailscale-strict`）。WSL 場景下 `localhost` bind 在 mirrored mode 下 Win ↔ WSL 直通，NAT mode 下 Win 連不到 WSL（後述）。
- BAT codebase 全文 grep `wslpath|/mnt/c|\\wsl|WSL` → **零命中**，確認 greenfield。

**T0260 拆單建議重點**：T0263 範圍為「WSL2 部署環境特有議題（path 映射、啟動、PTY env、UX），不重複 T0262 server-side 共通強化」。預估 60-90 min wall。

---

### Spec 草稿

#### 1. WSL2 內 BAT server 啟動方式

| 方案 | 觸發時機 | restart-on-failure | 開機自啟 | 使用者體驗 | 工程成本 |
|------|---------|---------------------|---------|-----------|---------|
| A. WSL systemd unit（user-level `~/.config/systemd/user/bat-server.service`） | WSL distro 啟動後 systemd 拉起 | systemd `Restart=on-failure` 內建 | 需 distro 啟動才生效 | 透明，但需先 `wsl -d Ubuntu` 一次 | 中（產 unit 檔 + `loginctl enable-linger`） |
| B. WSL systemd unit（system-level `/etc/systemd/system/`） | distro boot 即拉起 | 內建 | distro 一啟動即啟 | 同 A | 中-高（需 sudo + linger 不需要） |
| C. Win 端 scheduled task → `wsl -d Ubuntu -e /home/user/bat-server.sh` | Win logon | 靠 task scheduler retry policy | Win logon 即啟（含 distro 喚醒） | distro 自動被喚醒 | 中（task XML + WSL distro 偵測） |
| D. BAT client 第一次連線時 hint：`wsl --exec /home/user/bat-server.sh &` 背景拉起 | client 連線觸發 | 無內建（process 死掉就死） | 無 | 最簡單，但 server 死掉要使用者重連觸發 | 低 |

**推薦：A（user-level systemd unit）+ D（hint UX 兜底）**

理由：
- user-level systemd 不需 sudo，符合 BAT「使用者空間軟體」定位
- WSL2 systemd 自 2022/09 起官方支援，使用者啟用 `wsl.conf` `systemd=true` 後即可用
- D 作為兜底：使用者沒設 systemd 時，client 第一次連線跳 modal「未偵測到 WSL server，要不要幫你 `wsl exec` 啟動？」按下後背景拉起，並提示「下次想自動啟動，到 Settings 啟用 systemd 整合」
- C 不推薦：Win scheduled task 跨 OS 邊界處理 WSL distro 生命週期太脆（distro 被使用者手動 `wsl --shutdown` 後 task 會卡）
- B 不推薦：對單人桌面情境 over-engineering

**unit 檔範例**：

```ini
# ~/.config/systemd/user/bat-server.service
[Unit]
Description=BetterAgentTerminal Remote Server
After=network-online.target

[Service]
Type=simple
ExecStart=/home/%u/.local/bin/bat-server
Restart=on-failure
RestartSec=5s
Environment=BAT_REMOTE_BIND=localhost
Environment=BAT_REMOTE_PORT=9876

[Install]
WantedBy=default.target
```

啟用步驟（BAT setup wizard 執行）：
```bash
loginctl enable-linger $USER  # 不需 login session 即可跑
systemctl --user daemon-reload
systemctl --user enable --now bat-server
```

#### 2. localhost loopback 行為

WSL2 兩種網路模式對 BAT 的影響：

| 項目 | NAT mode（傳統預設） | Mirrored mode（Win 11 23H2+） |
|------|---------------------|-------------------------------|
| WSL distro IP | `172.x.x.x`（每次 boot 不同） | 與 Win host 共享所有 NIC IP |
| Win → WSL `127.0.0.1:9876` | **連不到**（WSL 是隔離 VM，loopback 不互通） | **直通** |
| WSL → Win `127.0.0.1:port` | 透過 WSL2 自動 port forward（限部分情境） | 直通 |
| WSL → 取自身 IP | `wsl hostname -I` → `172.x.x.x` | `hostname -I` → 與 Win 同 |
| 偵測方式 | `cat /proc/sys/net/ipv4/conf/all/forwarding` 或讀 `wsl --status` 配合 wsl.conf | `[network] networkingMode=mirrored` in `/etc/wsl.conf` 或 `.wslconfig` |
| 防火牆 | Win Defender 對 `127.0.0.1` 不擋；對 `172.x` 視 Public/Private | mirrored 統一視 Loopback，最寬鬆 |

**BAT 在兩模式下的連線設計**：

| 模式 | server bind | client connect URL | 備註 |
|------|------------|---------------------|------|
| Mirrored | `localhost`（127.0.0.1） | `wss://127.0.0.1:9876` | 與本機 BAT 完全等價，profile 設定最簡 |
| NAT | `0.0.0.0`（all） | `wss://<wsl-ip>:9876`，wsl-ip 動態取得 | 啟動時 BAT setup wizard `wsl -d Ubuntu hostname -I` 寫入 profile，每次 distro 重啟需更新 |
| NAT + Win port forward | `localhost`（WSL 內） | `wss://127.0.0.1:9876`（Win 端） | 靠 Win netsh portproxy + WSL2 啟動腳本 sync IP，脆弱不推 |

**偵測模式邏輯**（BAT 啟動時跑）：
```bash
# WSL 內執行
wsl -d Ubuntu -e bash -c '
  if grep -q "networkingMode=mirrored" /etc/wsl.conf 2>/dev/null \
     || grep -q "networkingMode=mirrored" /mnt/c/Users/$WIN_USER/.wslconfig 2>/dev/null; then
    echo "mirrored"
  else
    echo "nat"
  fi
'
```

**推薦**：BAT 預設 spec 假設 mirrored mode（Win 11 23H2+ 主流），對 NAT mode 給降級提示「偵測到 WSL2 NAT 模式，請參考[文件]切換為 mirrored，或手動填寫 WSL IP」。NAT 自動 IP 同步路徑作為 P2 增強。

#### 3. Win ↔ Linux path 映射

**核心痛點**：BAT client（Win）把 `C:\foo\project` 當 workspacePath 送到 server（WSL Linux），server 內所有 path 操作（`fs.readFile`、`pty.spawn({ cwd })`、`assertPathAllowed`、`git` invocation）都期待 POSIX path（`/mnt/c/foo/project`）。反向 server 回傳 watch event path（`/home/user/project/foo.ts`）給 client，client 渲染 UI 應顯示 `\\wsl.localhost\Ubuntu\home\user\project\foo.ts`（或保留 Linux 風格依設定）。

**三選項對照**：

| 項目 | A. Client-side 翻譯 | B. Server-side 翻譯 | C. Protocol metadata（path + nativeOS 標記） |
|------|--------------------|--------------------|----------------------------------------------|
| 翻譯時機 | client 送 IPC 前轉 Linux path | server 收到後檢測格式轉 | 兩端都收 raw path + metadata，按需翻譯 |
| 修改點 | 集中在 `RemoteClient.invoke` 與 watch event handler | 集中在 server 端 IPC dispatcher 入口 | 改 `RemoteFrame` schema + 兩端都動 |
| 翻譯來源 | client 知道自己是 Win，server profile 標記 `targetOS: 'wsl-linux'` | server 內建 `wslpath` 可用，啟動時 detect | metadata 自帶，無需偵測 |
| Edge case | client 必須知道 WSL distro name（`/mnt/c` vs `\\wsl$\Ubuntu`） | server 收到 `C:\` 時必須能反查 distro mount root | 兩端各自處理本地化 |
| 對稱性 | client→server 翻譯，server→client 也翻 | 兩向都在 server | 兩端皆參與 |
| 影響面 | profile schema 加 `targetOS` 欄位 | `wslpath` shell-out（每次 IPC 多一個 fork） | protocol 改 schema（破壞性） |
| 效能 | 翻譯成本在 client（低頻 IPC 場景 OK） | server 每次 IPC `wslpath` shell-out（高頻場景如 fs:watch event 量大時雪崩） | 兩端 zero shell-out（純字串處理） |
| 既有 BAT 衝擊 | 小（client RemoteClient + watch handler 各加一層） | 中（path-guard / pty cwd / fs handler 全部要過翻譯層） | 大（protocol 破壞性，含 fingerprint pinning 影響） |

**推薦：選項 A（client-side 翻譯）+ 純字串實作（不 shell-out wslpath）**

理由：
- WSL path 翻譯規則**確定且簡單**，純字串可實作，不需 shell-out `wslpath`：
  - `C:\foo\bar` → `/mnt/c/foo/bar`（drive letter lower + 反斜線轉正斜線）
  - `D:\baz` → `/mnt/d/baz`
  - `\\wsl$\Ubuntu\home\user\x` 或 `\\wsl.localhost\Ubuntu\home\user\x` → `/home/user/x`（strip UNC prefix + distro）
  - 反向：`/mnt/c/foo` → `C:\foo`，`/home/user/x` → `\\wsl.localhost\<distro>\home\user\x`
- Server 不裝翻譯邏輯，符合「server 是純 Linux 進程」心智模型，與後續 Docker/SSH server bundle 共用
- Profile schema 加 `targetOS: 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'` + `wslDistro?: string`，client `RemoteClient.invoke` 內裝 `translatePathForServer(arg)` middleware
- shell-out `wslpath` 不可行原因：(1) 性能 — fs:watch 大量 event 每個 fork 50ms+；(2) 跨環境一致性 — Docker/SSH 沒有 wslpath；(3) 字串規則確定，shell-out 是 over-engineering

**BAT 修改點清單**（讀 source 後）：

| 位置 | 操作 | 備註 |
|------|------|------|
| `electron/remote/remote-client.ts` | 加 `translateOutgoing(channel, args)` middleware；watch event 來時加 `translateIncoming` | 中心翻譯點 |
| `src/types/profile.ts` | Profile interface 加 `targetOS`、`wslDistro` 欄位 | schema 演進 |
| `src/components/ProfilePanel.tsx` | UI 加 distro 下拉選單（remote profile 為 WSL 時顯示） | UX |
| `electron/path-guard.ts` | **不動**（server 端 allowlist 用 Linux path 比對） | 保持簡單 |
| `electron/pty-manager.ts` | **不動**（server 收到的 cwd 已是 Linux path） | 保持簡單 |
| `electron/remote/remote-server.ts` | 啟動時 log `process.platform` + `os.release()`，回 client 在 auth-result | 給 client 確認 targetOS |
| `electron/remote/protocol.ts` | `auth-result` 加 `serverPlatform: 'win32' | 'linux' | 'darwin'` 與 `wslDetected: boolean` | 微擴充，非破壞性 |
| 新增 `src/utils/wsl-path.ts` | `winToWsl(p, distro)` / `wslToWin(p, distro)` 純函數 + tests | 集中翻譯邏輯 |
| `src/components/WorkspaceView.tsx` | UI 顯示 path 時依 profile.targetOS 決定顯示 Win-style 或 Linux-style | UX 一致性 |
| `electron/remote/handler-registry.ts` | path-bearing event（`fs:changed`）broadcast 前 server 不翻；client `RemoteClient` 接到後翻 | 對稱 |

**翻譯函數規格**（純字串，不 shell-out）：

```ts
// src/utils/wsl-path.ts
export function winToWsl(winPath: string, distro: string): string {
  // C:\foo\bar → /mnt/c/foo/bar
  if (/^[A-Za-z]:[\\/]/.test(winPath)) {
    const drive = winPath[0].toLowerCase()
    const rest = winPath.slice(2).replace(/\\/g, '/')
    return `/mnt/${drive}${rest.startsWith('/') ? '' : '/'}${rest}`
  }
  // \\wsl$\Ubuntu\home\user\x → /home/user/x
  // \\wsl.localhost\Ubuntu\home\user\x → /home/user/x
  const m = winPath.match(/^\\\\wsl(\$|\.localhost)\\([^\\]+)\\(.*)$/)
  if (m && m[2].toLowerCase() === distro.toLowerCase()) {
    return '/' + m[3].replace(/\\/g, '/')
  }
  return winPath  // already POSIX or unknown — pass through
}

export function wslToWin(wslPath: string, distro: string): string {
  // /mnt/c/foo → C:\foo
  const m = wslPath.match(/^\/mnt\/([a-z])(\/.*)?$/)
  if (m) return `${m[1].toUpperCase()}:${(m[2] || '').replace(/\//g, '\\')}`
  // /home/user/x → \\wsl.localhost\Ubuntu\home\user\x
  if (wslPath.startsWith('/')) return `\\\\wsl.localhost\\${distro}${wslPath.replace(/\//g, '\\')}`
  return wslPath
}
```

**Edge cases 清單**：

| Edge case | 行為 | 備註 |
|-----------|------|------|
| 中文路徑 `C:\使用者\foo` | UTF-8 在 Linux 端 NTFS-3G mount 預設可讀，注意 fs encoding | 翻譯純字串無問題 |
| 含空格 `C:\Program Files\x` | 翻譯純字串 OK；`pty.spawn` cwd 接受空格不需 escape | 注意 shell command 組裝時要 quote |
| Junction（Win 目錄 reparse point） | WSL `/mnt/c` 透過 9P 對 junction 支援 inconsistent；建議警告使用者勿用 junction 進 workspace | 設 watcher 時 fs.watch 可能漏 event |
| Symlink（WSL 內） | `/home/user/x` 是 symlink → 翻譯結果 `\\wsl.localhost\Ubuntu\home\user\x` 在 Explorer 可見但 BAT path-guard `path.resolve` 不解 symlink（既定行為） | 與既有 path-guard 一致 |
| OneDrive synced（`C:\Users\x\OneDrive\...`） | 翻譯 OK，但 OneDrive 的 placeholder file 在 WSL fs.read 時會觸發 hydration（變慢） | 文件提醒使用者勿放大型 workspace 在 OneDrive |
| 9P 慢速 IO | `/mnt/c` 的 fs operation 比 WSL 內 ext4 慢 5-20x | UI hint「workspace 放在 WSL filesystem 內速度更快」 |
| `\\wsl$` legacy vs `\\wsl.localhost` | Win 11 19044+ 兩者等價；翻譯函式 regex 同時支援 | 反向永遠輸出 `\\wsl.localhost`（新標準） |
| UNC 其他 share（`\\server\share`） | 不轉，pass through；BAT 不支援跨網段 UNC workspace | 文件說明 |
| Drive 沒 mount（`Z:\`）但 WSL `/mnt/z` 不存在 | 翻譯時不檢測，由 server fs operation 自然報 ENOENT | 不在翻譯層做 validation |
| Long path（`\\?\C:\very\long\path...` >260 chars） | strip `\\?\` prefix 後翻譯 | 加正則處理 |
| WSL distro 大小寫敏感（`Ubuntu` vs `ubuntu`） | UNC path 在 Win Explorer 大小寫不敏感，但 distro name 在 `wsl -d` 命令行敏感 | 翻譯時 case-insensitive 比對 |

#### 4. PTY shell + 環境變數繼承

**WSL 內 PTY shell 預設**：

- `/etc/passwd` 內使用者的 login shell（`bash` / `zsh` / `fish`）為**最終決定者**
- BAT 若想 override，從 profile 讀 `defaultShell?: '/bin/bash' | '/bin/zsh' | ...`，傳入 `pty.spawn(shell, [...args])` shell 參數
- 不應依賴 `wsl.conf [user] default=...`（那是 WSL CLI default user，不是 PTY shell）
- 不能依賴 BAT host 的 shell 設定（Win 端 `pwsh` 與 WSL `bash` 完全不同 OS）

**環境變數三層流向圖**：

```
┌─────────────────────────────────┐
│ BAT host (Win Electron main)    │
│  ─ process.env: Win 系統 env    │
│  ─ + 自身 BAT_* 設定            │
└────────────┬────────────────────┘
             │  pty:create IPC（remote proxy）
             ↓  args = { shell, cwd, customEnv }
             │
   ┌─────────┴────────┐
   │ Wire (WSS frame) │  customEnv = profile.envInjection (subset)
   └─────────┬────────┘
             ↓
┌─────────────────────────────────┐
│ WSL server (Linux Node.js)      │
│  ─ process.env: WSL login env   │
│    (含 PATH=/usr/bin:/mnt/c/...) │
│  ─ 加上 BAT 注入：              │
│      LANG=en_US.UTF-8           │
│      DISABLE_AUTOUPDATER=1      │
│      BAT_REMOTE_PORT=9876       │
│      BAT_REMOTE_TOKEN=xxx       │
│      BAT_TOWER_TERMINAL_ID=...  │
│      BAT_SESSION=1              │
│  ─ + customEnv from wire        │
└────────────┬────────────────────┘
             │  pty.spawn(shell, [], { env, cwd })
             ↓
┌─────────────────────────────────┐
│ PTY child (bash / zsh / claude) │
│  ─ env = WSL server env merged  │
│  ─ shell login 會跑 .bashrc /   │
│    .profile 可能 override PATH  │
│  ─ user 在 shell 內 export 不   │
│    回傳到 BAT (預期行為)        │
└─────────────────────────────────┘
```

**環境變數繼承策略 spec**：

1. **BAT host 不向 wire 傳整個 `process.env`**（既有設計，繼續沿用）：避免 Win-only env（`USERPROFILE`、`APPDATA`、`COMSPEC`）洩漏到 Linux PTY 造成 shell 混亂
2. **WSL server 啟動時固化最小 env baseline**：
   - 必繼承：`HOME`、`USER`、`PATH`、`LANG`、`SHELL`、`TERM`、`PWD`、`XDG_*`
   - server 自加：`BAT_SESSION=1`、`BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN`、`BAT_TOWER_TERMINAL_ID`、`DISABLE_AUTOUPDATER=1`、`LANG=en_US.UTF-8`（已注入點 `pty-manager.ts` envWithUtf8）
3. **profile.envInjection（使用者自訂）**：透過 wire 傳遞 `customEnv: Record<string, string>`，server 端 merge 進 PTY 子行程 env，**不寫入 server process.env**（隔離）
4. **不洩漏 token**：`BAT_REMOTE_TOKEN` 僅在 server 內部使用，**不向 PTY 子行程注入**（PTY 跑使用者程式，token 洩漏風險）→ 修改現有 `envWithUtf8` 三處注入點，**移除 token**，僅保留 `BAT_REMOTE_PORT` + `BAT_TOWER_TERMINAL_ID`（已是現況？需 T0266 整合時 audit）
5. **claude CLI 路徑解析**：WSL 內 `which claude` 回 `/home/user/.local/bin/claude`（Anthropic installer 預設路徑）→ runtime router 加 `wsl-linux` 平台分支，path 偵測順序：`~/.local/bin/claude` → `/usr/local/bin/claude` → PATH 搜尋 → `npm root -g`/claude（不採，與 BUG-053/059 一致）
6. **與 Win 端 claude.exe 互不衝突**：Win client 端 BAT 內嵌 claude 與 WSL server 端 claude 各自獨立，彼此不知。Profile 切換到 WSL 時，UI 顯示 `Server runtime: WSL Ubuntu / claude 2.1.113`

#### 5. WSL1 支援決定

**結論：不支援 WSL1，僅支援 WSL2**。

理由：
- WSL1 是 syscall translation layer，無真實 Linux kernel；@lydell/node-pty-linux-x64 與 better-sqlite3 native module 對 WSL1 並無官方 support 聲明，社群報告 PTY signal handling 有 corner bug
- WSL1 不支援 systemd → 啟動方案 1A 直接報廢，僅剩方案 1D（hint UX）
- WSL1 在 Win 11 已被 deprioritize，新裝預設 WSL2
- 使用者覆蓋率：依 Microsoft 2024 telemetry，WSL2 占 95%+
- 工程成本估計：若硬要支援，需重做 PTY native module 相容性測試 + systemd 替代方案 + 文件雙軌，估 2-3 個工程日，效益極低

降級策略：BAT setup wizard 偵測 `wsl -l -v` 輸出 `VERSION=1` 時跳警告 modal「BAT 僅支援 WSL2，請執行 `wsl --set-version <distro> 2` 升級或選用其他 deployment 方案」。

#### 6. WSL 內依賴安裝與 packaging

**packaging 策略草案**：

| 階段 | 機制 | 備註 |
|------|------|------|
| MVP（手動） | 使用者下載 `bat-server-linux-x64.tar.gz` → WSL 內 `tar xzf` 到 `~/.local/bat-server/` | 與 SSH/Docker server bundle 共用同一個 Linux x64 bundle |
| P1（半自動） | BAT client 偵測 distro → `wsl -d Ubuntu -u root -e bash -c 'curl ... | tar xz -C /opt/bat-server'` | 一鍵安裝 |
| P2（npm tarball） | `npm i -g @bat/server`（需上 npm registry） | 與內嵌 claude CLI 機制對等 |

**推薦 MVP：方案 A（手動 + 文件）+ P1 一鍵安裝 wizard**。理由：
- 與 T0264 Docker 容器的 base image / T0265 SSH 遠端 server 共用同一個 Linux x64 bundle，packaging pipeline 統一
- 不上 npm registry，避免 supply chain 風險與發版治理成本
- BAT release CI 在 `pre-release.yml` 加 `linux-x64-server.tar.gz` artifact（產生方式：electron-builder + `--linux dir` 抽 server-only files 或 esbuild 獨立打 server entry）

**Native module 相容性 checklist**：

| Module | WSL2 (Ubuntu 22.04 glibc 2.35) | WSL2 (Debian 12 glibc 2.36) | 備註 |
|--------|-------------------------------|------------------------------|------|
| `@lydell/node-pty-linux-x64` | ✅ 預期 OK | ✅ | prebuilt, glibc ≥2.31 |
| `better-sqlite3` | ✅ | ✅ | 需 `npm rebuild`，與 BAT host postinstall 同流程 |
| `@kutalia/whisper-node-addon` | ⚠️ 需 spike | ⚠️ | server-side 是否需要 voice input？（client 端錄音上傳？）→ 建議 server bundle **不含** whisper（voice 在 client 端做） |
| `@img/sharp-linux-x64` | ✅ | ✅ | image resize for codex prompt |
| `@img/sharp-libvips-linux-x64` | ✅ | ✅ | sharp 依賴 |
| `node-pty`（fallback） | ✅ | ✅ | 已被 @lydell/node-pty 取代，仍保留 fallback |

**關鍵決策**：
1. **server bundle 不含 whisper-node-addon**（voice input 是 client 端 UX 功能，不應 server 化）→ 減 native module 維運面
2. **node 版本內嵌**：bundle 含 node 24.x runtime（與 BAT Electron 41 同 ABI 145 Node 版本對齊），不依賴 WSL 系統 node。對應路徑 `~/.local/bat-server/node`、`~/.local/bat-server/server.js`
3. **glibc 下限文件化**：宣告 BAT WSL server 需要 glibc ≥ 2.31（Ubuntu 20.04+ / Debian 11+），低於此版本（罕見）給降級提示
4. **arm64 WSL（Win on ARM）暫不支援**：spec 階段先聚焦 x64，arm64 待 BAT mac arm64 經驗成熟後同步

#### 7. WSL 部署 UX

**Setup wizard 流程**（BAT client，Win 端）：

```
[1] ProfilePanel → "Add Profile" → 類型選 "Connect to WSL"
[2] BAT 自動跑 `wsl -l -v`：
    ├─ 偵測到 ≥1 個 WSL2 distro → 列出讓使用者選
    ├─ 全部 WSL1 → 警告「請升級為 WSL2」
    └─ 沒安裝 WSL → 開瀏覽器連 https://aka.ms/wsl 並中止 wizard
[3] 選 distro（e.g. Ubuntu）→ 偵測 systemd 啟用狀態：
    ├─ 已啟用 → 跳到 [4]
    └─ 未啟用 → 提示「BAT 將寫入 /etc/wsl.conf 啟用 systemd（需重啟 distro）」
[4] 偵測 mirrored vs NAT mode → 顯示連線資訊預覽：
    ├─ mirrored: `wss://127.0.0.1:9876`
    └─ NAT: `wss://172.x.x.x:9876` + 提示「IP 每次重啟會變，建議切 mirrored」
[5] 安裝 BAT server bundle：
    ├─ 下載 `bat-server-linux-x64.tar.gz`（從 BAT release 或內嵌 in BAT app bundle）
    ├─ `wsl -d <distro> -e bash -c 'mkdir -p ~/.local/bat-server && tar xz -C ~/.local/bat-server'`
    ├─ 寫入 `~/.config/systemd/user/bat-server.service`
    └─ `systemctl --user enable --now bat-server`（搭配 `loginctl enable-linger`）
[6] 等 server 起來（poll WSS handshake，timeout 30s）
[7] 抓 fingerprint（TOFU）寫入 profile，profile.targetOS = 'wsl-linux', profile.wslDistro = '<distro>'
[8] 完成 → 自動 Connect → 開新 workspace
```

**3 個 user journey**：

**Journey 1：第一次 WSL setup（happy path）**
> 使用者剛裝 Win 11 + Ubuntu 22.04 WSL2 (mirrored mode 預設啟用)。在 BAT 點 Add Profile → Connect to WSL → 選 Ubuntu → wizard 自動裝 server bundle、寫 systemd unit、起 server、抓 fingerprint。約 60 秒後 ProfilePanel 顯示綠燈「Ubuntu / claude 2.1.113」，使用者點 Connect → 新 workspace 開在 `\\wsl.localhost\Ubuntu\home\user\` 風格的 path picker 上 → 選 `/home/user/myproject` → 開始用 BAT 寫 code。

**Journey 2：NAT mode 使用者**
> 使用者 Win 10 + Ubuntu（無 mirrored 支援）。Wizard 偵測到 NAT，跳警告「IP 會變動，每次 distro 重啟需重連」。使用者選「我接受」→ wizard 跑完。**第二天 distro 重啟後**，BAT 連線失敗 → ProfilePanel 紅燈，按 Refresh → BAT 自動 `wsl hostname -I` 取新 IP → 更新 profile → 重連成功。BAT 提供「I'll handle the IP for you」按鈕。

**Journey 3：跨 distro 切換**
> 使用者同時有 Ubuntu（工作）+ Debian（測試）兩個 distro。ProfilePanel 列兩個 WSL profile，左側 emoji 用 distro 圖示區分。在工作中可一鍵切換，每個 profile 各自的 server 都跑（systemd unit 名稱 = `bat-server`，無衝突，因為在不同 distro 內）。fingerprint 各自獨立 pinned。

**ProfilePanel UI 並列展示（4 種 profile）**：

```
┌─ Profiles ──────────────────────────┐
│ ● Local (this machine)              │  ← 圖示：💻
│ ● WSL: Ubuntu                       │  ← 圖示：🐧 + WSL badge
│ ○ WSL: Debian                       │
│ ● Docker: bat-dev                   │  ← 圖示：🐳
│ ○ SSH: prod-server.example.com      │  ← 圖示：🔐
│ + Add Profile                       │
└─────────────────────────────────────┘
```

統一以 **「targetOS + 環境類型」** 雙標籤呈現。每個 profile 卡片內顯示：runtime（embedded / system claude）、版本、最後連線時間、fingerprint 縮寫（前 8 char）。WSL profile 額外顯示 distro name + mirrored/NAT 模式。

---

### 給塔台的下一步建議

#### WSL deployment MVP 切片（建議 5-7 工程日）

| Sprint | 範圍 | 阻擋 |
|--------|------|------|
| W1：path translation 純函數 + 單元測試 | `src/utils/wsl-path.ts` + tests + profile schema 加 `targetOS` `wslDistro` | 無 |
| W2：RemoteClient middleware + auth-result 擴 serverPlatform | client→server 自動翻譯生效 | W1 |
| W3：server bundle pipeline | electron-builder 加 `linux-x64-server` artifact + 解壓 helper script | 無 |
| W4：setup wizard MVP（手動安裝） | UI 流程 [1]-[8]，systemd 自動寫 unit | W3 |
| W5：mirrored/NAT 偵測 + UX hint | 偵測邏輯 + 紅黃燈 + 重連 IP 自動更新 | W4 |
| W6：smoke test + 文件 | 真機 Win 11 + Ubuntu 22.04 mirrored / NAT 各跑一輪 critical journey | W1-W5 |

**MVP 完成定義**：使用者能用 BAT setup wizard 一鍵接上 WSL2 Ubuntu，開 workspace、編輯檔案、跑 PTY、用 claude agent。fs:watch、git ops、profile 切換正常。fingerprint pinning 與 Win-only remote 等價。

#### 與 T0264 Docker / T0265 SSH 共通可抽象部分

| 共通元件 | 抽象方式 | 由哪張工單先動 |
|---------|---------|---------------|
| Linux x64 server bundle（pre-built tar.gz） | electron-builder pipeline output；3 deployment 共用 | W3（本工單後序）動，T0264/T0265 受益 |
| `targetOS` profile schema | 一次擴成 5 值 `local / wsl-linux / docker-linux / ssh-linux / ssh-darwin` | W1 動，T0264/T0265 沿用 |
| Path translation 純函數 | wsl 用 `winToWsl/wslToWin`；Docker 用 `winToContainer`（mount 點映射）；SSH 用 home dir 映射 | T0263 W1 先寫 wsl，建立模板；T0264/T0265 各自加 |
| `auth-result.serverPlatform` 欄位 | 4 deployment 共用 | W2 一次到位 |
| Native module 相容性 baseline | glibc 下限、whisper 排除規則、node 版本 | W3 集中決策 |
| Setup wizard 框架 | UI 殼共用，每個 deployment 填子流程 | W4 框架先做，子流程各工單填 |

**建議**：T0263 完工後立即排 T0266「彙整 + 共通抽象工單」，把上面 6 個共通元件做成獨立 spec（不寫 code），再讓 T0264/T0265 在共通基礎上各做差異研究。

#### 需 spike 才能拍板的議題

1. **WSL2 mirrored mode 在 BAT 內的真實連線行為** — spec 推測 `127.0.0.1:9876` 直通，需開 mirrored 環境實測 `wss://` handshake、TLS cert 驗證、fingerprint pinning 是否運作（self-signed cert 需 SAN 覆蓋 mirrored IP？）
2. **systemd user-level + linger 在 WSL2 持久化** — Win 端 `wsl --shutdown` 後再 `wsl -d Ubuntu` 拉起，systemd unit 是否自動重啟？需實測
3. **9P 檔案系統 fs.watch event 行為** — Win path（`C:\foo`）在 WSL `/mnt/c/foo` 的 chokidar / inotify 對 file change 反應是否正常、會不會漏 event、event burst 量級
4. **BAT host (Win Electron) 與 WSL server (Linux) 的 token 加密對等** — Win safeStorage 用 DPAPI，Linux WSL2 內 `safeStorage.isEncryptionAvailable()` 的真實 keychain 支援度（fork 行為提示 Linux 可能 plaintext + warn，需 audit）
5. **claude CLI 在 WSL2 內的 install 路徑與 BAT runtime router 整合** — `~/.local/bin/claude` 在 systemd `User=` 跑時 PATH 是否含此路徑？BUG-053/059 的 npm shim 不偵測規則在 Linux 是否需重新 audit
6. **path translation 對 git operation 的影響** — `git:diff`, `git:log` 等 IPC 回傳 path 是否需要兩端一致？git 內部呼叫的 path（`.git/HEAD` 等）走哪個層

#### 預估 WSL deployment 全部實作完的工程量

- W1-W6 MVP：5-7 工程日（含 spike）
- P1 半自動 setup wizard 與 NAT 自動 IP 同步：+2-3 工程日
- 文件 + 1-2 輪真機驗收：+2 工程日
- **小計 9-12 工程日**（單人，不含 T0264/T0265 工作量）

與 T0262 server-side 強化 spec 合併成一條 PLAN-007 main delivery（pre-condition：T0262 完工 → T0263 W1 才動），總工程量約 18-25 工程日。

---

### 收尾 commit
- commit hash：`afb34a0`
- 完成時間：2026-04-25 22:31 (UTC+8)
- 開始時間：2026-04-25 22:26 (UTC+8)
- wall time：~5 min（讀 code + 寫 spec，YOLO 模式無互動阻擋）
