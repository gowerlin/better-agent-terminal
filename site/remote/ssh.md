---
title: SSH
description: 用 BAT 驅動另一台 Linux 或 macOS 主機上的 Agent：前置條件、SSH 金鑰與設定檔、設定精靈每一步、升級與移除，以及常見狀況。
---

# SSH

BAT 留在你的電腦，Agent 在另一台主機上執行，例如公司的開發機或雲端主機。BAT 透過 SSH 安裝伺服器、透過 SSH 通道連線，不需要在主機上多開任何對外的埠。 {.ct-intro}

## 開始之前 {#before}

- **主機的作業系統與架構**：Linux（x64 或 arm64）或 Apple Silicon 的 macOS。Intel Mac 不支援。
- **用金鑰登入**：BAT 不會詢問密碼，只能用 SSH 金鑰或 ssh-agent。有密碼保護的金鑰，請先載入 ssh-agent。先在終端機執行一次 `ssh you@dev-server`，確認不用輸入密碼就能登入。
- **你的電腦上有 `ssh` 指令**：Windows 10 以上內建的 OpenSSH 用戶端即可；macOS、Linux 都已內建。
- **主機允許 SSH 連接埠轉送**（大多數主機預設允許）。BAT 的連線走 SSH 通道。
- **主機上的工具**：`tar`、`sh` 這些一般都有。Linux 主機要有 systemd 使用者服務（`systemctl --user`）；macOS 主機用 launchd。
- **能連上 GitHub**，第一次設定要下載伺服器套件。連不到時可以改用匯入，見[伺服器套件從哪來](./#server-bundle)。

### 建議：寫進 SSH 設定檔 {#ssh-config}

要指定金鑰檔、非預設的連接埠，或經過跳板機（jump host），請寫進你電腦上的 `~/.ssh/config`。精靈會把這裡的主機別名列出來讓你選，金鑰、連接埠與跳板機都照設定檔走：

```ssh-config
Host dev-server
    HostName 192.0.2.10
    User you
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump jump-host
```

手動輸入的主機不會套用跳板機。精靈只讀設定檔裡直接寫的 `Host`，`Include` 進來的檔案與含萬用字元的 `Host` 不會列出。

## 設定精靈 {#wizard}

在側欄底部按 **配置**，再按 **+ 更多 ▾**，在「遠端類」選 **新增 SSH 設定檔**。精靈依序執行下面幾步；中途失敗時，畫面會說明原因並提供重試或取消，有些錯誤還能直接回去改主機。

<MediaFigure src="/media/wizard-ssh.png" alt="SSH 設定精靈：左邊是步驟清單，目前在「選擇 SSH 主機」；右邊列出 ~/.ssh/config 裡的別名 dev-server、build-box，以及「手動輸入主機…」。" caption="第 1 步從 ~/.ssh/config 的別名中選一個，或按「手動輸入主機…」。" />

1. **設定 SSH 主機資訊**：從 `~/.ssh/config` 的別名中選一個，或按「手動輸入主機…」輸入 `dev-server`、`you@dev-server` 或 `you@dev-server:2222`。這是整個精靈裡唯一要你輸入的地方。
2. **驗證 SSH 認證**：用金鑰登入一次，同時判斷主機是 Linux 還是 macOS、用的是哪種 CPU。第一次連的主機，主機金鑰會自動記下。
3. **安裝 BAT 伺服器套件（SSH）**：取得與主機相符的伺服器套件，經由 SSH 傳上去，解壓到主機的 `~/.local/bat-server`。
4. **啟動 bat-server（SSH）**：Linux 建立 systemd 使用者服務 `bat-server`，並啟用 lingering，讓你登出後服務仍在；macOS 建立 LaunchAgent `com.bat-server`。伺服器只聽主機自己的 localhost，不對外。
5. **取得 TLS 指紋**：記下伺服器憑證的指紋，之後每次連線都會核對。
6. **連線測試**：經由 SSH 通道實際連一次。
7. **寫入連線設定**：在「配置」裡新增一筆名為 `SSH <主機>` 的設定。
8. **完成**。

完成後，BAT 會接著檢查主機上有沒有 claude、codex、Node.js 這些工具，見[遠端 AI 工具](./#remote-tools)。

## 連上之後 {#after}

- 在「配置」裡開啟這筆 SSH 設定，會開一個新的 BAT 視窗；裡面的終端機、Agent、檔案瀏覽器與 Git 檢視都在主機上執行。
- 每次連線，BAT 都會開一條 SSH 通道，本機那一端的埠由系統挑選；你不需要在主機的防火牆開埠。
- 你電腦上的檔案不能附加到這個視窗的 Agent 對話：Agent 在主機上執行，看不到你電腦裡的檔案。要附加的檔案請放在主機上。
- 主機重新開機後，Linux 上的伺服器會自己啟動（靠 lingering）；macOS 上的伺服器是 LaunchAgent，要等那個帳號登入後才會啟動。

## 升級與移除 {#upgrade-remove}

### 升級伺服器 {#upgrade}

升級 BAT 之後，對同一台主機再執行一次 **新增 SSH 設定檔**：

- 新的伺服器套件裝好、確認可用之後才換上去，舊版與舊的服務設定先留著，精靈全部完成才刪掉。
- 同一台主機、同一個帳號與連接埠的設定會更新，不會多出一筆，名稱也保留。
- 中途按 **取消**，伺服器會回到執行精靈之前的樣子，原本在執行就繼續執行。

### 移除 {#remove}

在「配置」裡刪除 SSH 設定，只會刪掉 BAT 這邊的設定，主機上的伺服器會繼續執行。要完整移除，在主機上執行：

Linux：

```bash
systemctl --user disable --now bat-server.service
rm -f ~/.config/systemd/user/bat-server.service
systemctl --user daemon-reload
rm -rf ~/.local/bat-server ~/.local/share/bat-server
```

macOS：

```bash
launchctl unload -w ~/Library/LaunchAgents/com.bat-server.plist
rm -f ~/Library/LaunchAgents/com.bat-server.plist
rm -rf ~/.local/bat-server ~/Library/Application\ Support/bat-server
```

Linux 主機上，精靈每次都會啟用 lingering；不需要時執行 `sudo loginctl disable-linger $USER`。

## 常見狀況 {#troubleshooting}

### SSH 認證失敗 {#auth-failed}

BAT 只能用金鑰登入。在終端機執行 `ssh -v you@dev-server` 看是哪一步失敗；還沒有金鑰時，自己產生一把並放到主機上：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_bat
ssh-copy-id -i ~/.ssh/id_ed25519_bat.pub you@dev-server
```

再把 `IdentityFile ~/.ssh/id_ed25519_bat` 寫進該主機的 `~/.ssh/config`（見[寫進 SSH 設定檔](#ssh-config)），回到精靈按「修改 SSH 設定」選這個別名。BAT 不會替你產生金鑰。

### 主機金鑰對不上 {#host-key}

主機重灌或換了金鑰時，SSH 會拒絕連線。先確認變更是預期的，再移除舊的紀錄，並在終端機手動連一次，接受新的金鑰：

```bash
ssh-keygen -R dev-server
ssh you@dev-server
```

然後回到精靈重試。

### SSH 伺服器不允許 port forwarding {#forwarding}

BAT 的連線需要 SSH 連接埠轉送。請主機管理者在 `sshd_config` 允許 `AllowTcpForwarding`，修好之後按「已修復，重試」。

### 啟動 bat-server 失敗 {#start-failed}

Linux 上最常見的原因是無法啟用 lingering。在主機上執行 `sudo loginctl enable-linger $USER`，再回到精靈重試。其他情況，在主機上看服務狀態：

```bash
# Linux
systemctl --user status bat-server
journalctl --user -u bat-server -n 50

# macOS
launchctl list | grep com.bat-server
```

### 連線逾時 {#timeout}

精靈連不上主機。在終端機執行 `ssh -v you@dev-server`，確認網路、防火牆與跳板機設定；用跳板機時，主機一定要用 `~/.ssh/config` 的別名。

### 用一陣子之後斷線 {#disconnect}

網路斷掉或電腦睡眠後，BAT 會自動重新連線，期間在這個視窗裡的操作不會執行，也不會改在你的電腦上執行。SSH 通道連續 5 次重建失敗後，BAT 就停止重試，「配置」裡這筆設定顯示「連線中斷」。網路恢復後，關掉這個遠端視窗，等 15 秒讓連線釋放，再從「配置」重新開啟。

### 下載不到伺服器套件 {#bundle}

見[常見問題：設定遠端時下載不到伺服器套件](../faq#server-bundle)。

### 指紋不符 {#fingerprint}

見[遠端開發：憑證指紋](./#fingerprint)。

---

回報 SSH 相關問題時，請附上主機的作業系統與 CPU 架構、精靈的錯誤訊息與 BAT 的除錯日誌，見[回報與協助測試](../contribute)。更多問題見[常見問題](../faq#remote)。 {.remote-next}
