---
title: WSL
description: 在 Windows 上用 BAT 驅動 WSL2 發行版裡的 Agent：前置條件、設定精靈每一步、升級與移除，以及常見狀況。
---

# WSL

BAT 留在 Windows，Agent 在同一台電腦的 WSL2 發行版裡執行。想用 Linux 的工具鏈又不想多開一台機器，這是最省事的選擇。 {.ct-intro}

## 開始之前 {#before}

- **BAT 裝在 Windows 上**，不是裝在 WSL 裡。
- **WSL2 與至少一個發行版**。還沒有的話，在 PowerShell 執行 `wsl --install -d Ubuntu-24.04`。只有 WSL1 的發行版不會出現在選單裡，先用 `wsl --set-version <發行版名稱> 2` 轉成 WSL2。
- **發行版裡啟用 systemd**。BAT 的伺服器是以 systemd 使用者服務的方式常駐，沒有 systemd 就無法完成設定。在發行版的 `/etc/wsl.conf` 加上下面兩行，再到 PowerShell 執行 `wsl --shutdown` 重新啟動 WSL：

  ```ini
  [boot]
  systemd=true
  ```

- **能連上 GitHub**，第一次設定要下載伺服器套件。連不到時可以改用匯入，見[伺服器套件從哪來](./#server-bundle)。

發行版名稱只能有英文字母、數字、`.`、`_`、`-`。Ubuntu、Debian 之外的發行版也可以，只要有 systemd、`tar` 與 `sh`。

## 設定精靈 {#wizard}

在側欄底部按 **配置**，再按 **+ 更多 ▾**，在「容器類」選 **新增 WSL 設定檔**。精靈依序執行下面幾步，每一步都會顯示進度；中途失敗時，畫面會說明原因並提供重試、略過或取消。

<MediaFigure src="/media/wizard-wsl.png" alt="WSL 設定精靈：左邊是步驟清單，偵測目標環境已完成，目前停在選擇 WSL 發行版；右邊列出 Ubuntu-24.04 與 Debian 兩個選項。" caption="有好幾個 WSL2 發行版時，精靈停在第 2 步讓你選一個。" />

1. **偵測目標環境**：確認這台是 Windows、找得到 WSL。
2. **選擇 WSL 發行版**：只有一個 WSL2 發行版時自動選好；有好幾個時，從清單選一個。這是整個精靈裡唯一要你選的地方。
3. **檢查 systemd 是否啟用**。
4. **安裝 BAT 伺服器套件**：取得與這版 BAT 對應的伺服器套件，解壓到發行版的 `~/.local/bat-server`。同時檢查 WSL 的網路模式，需要注意的會列在最後的警告裡。
5. **寫入 systemd 使用者服務**：替伺服器挑一個沒人用的連接埠，建立 `bat-server` 使用者服務並啟動，同時啟用 lingering，讓服務在你沒登入發行版時也繼續執行。
6. **取得 TLS 指紋**：記下伺服器憑證的指紋，之後每次連線都會核對。
7. **連線測試**：用剛拿到的權杖與指紋實際連一次。
8. **寫入連線設定**：在「配置」裡新增一筆名為 `WSL <發行版名稱>` 的設定。
9. **完成**：列出過程中收集到的警告。

完成後，BAT 會接著檢查發行版裡有沒有 claude、codex、Node.js 這些工具，見[遠端 AI 工具](./#remote-tools)。

### 連接埠與資料 {#port-data}

- 連接埠由 BAT 在 9877 到 9976 之間自動挑選，會避開 BAT 自己的伺服器用的埠；你不需要設定。
- 伺服器的憑證與權杖放在發行版的 `~/.local/share/bat-server`。重新執行精靈不會動到它們。

## 連上之後 {#after}

- 在「配置」裡開啟這筆 WSL 設定，會開一個新的 BAT 視窗；裡面的終端機、Agent、檔案瀏覽器與 Git 檢視都在發行版裡執行。
- 新增工作區時，資料夾對話框從 `\\wsl.localhost\<發行版名稱>\home\<你的使用者>` 開始。
- BAT 開著的時候，會讓用到的發行版保持執行，避免 WSL 在閒置一陣子後把發行版連同伺服器一起停掉。BAT 不會改你的 `.wslconfig`。

## 升級與移除 {#upgrade-remove}

### 升級伺服器 {#upgrade}

升級 BAT 之後，對同一個發行版再執行一次 **新增 WSL 設定檔**：

- 新的伺服器套件裝好、確認可用之後才換上去，舊版先留著，精靈全部完成才刪掉。
- 沿用原本的連接埠、憑證與權杖；同一個發行版、同一個埠的設定會更新，不會多出一筆，名稱也保留。
- 中途按 **取消**，伺服器會回到執行精靈之前的樣子：同一版套件、同一個埠，原本在執行就繼續執行。

### 移除 {#remove}

在「配置」裡刪除 WSL 設定，只會刪掉 BAT 這邊的設定，發行版裡的伺服器還在，下次發行版啟動時又會自己跑起來。要完整移除，在發行版裡執行：

```bash
systemctl --user disable --now bat-server.service
rm -f ~/.config/systemd/user/bat-server.service
systemctl --user daemon-reload
rm -rf ~/.local/bat-server ~/.local/bat-server.bat-old ~/.local/bat-server.bat-new
rm -rf ~/.local/share/bat-server
```

精靈為你啟用的 lingering 不會自動關閉；不需要時執行 `sudo loginctl disable-linger $USER`。

## 常見狀況 {#troubleshooting}

### 找不到 WSL2，或沒有可用的發行版 {#no-wsl}

精靈會顯示「找不到 WSL2」或「尚未安裝 WSL 發行版」。依畫面上的指示安裝 WSL2 或發行版之後，按「我已安裝 WSL2，重試」。只有 WSL1 發行版時，先轉成 WSL2（見[開始之前](#before)）。

### 沒有啟用 systemd {#no-systemd}

精靈會警告 systemd 沒有啟用，但沒有 systemd 就拿不到伺服器的權杖，到「寫入連線設定」那一步一定失敗，已完成的步驟會自動復原。照[開始之前](#before)啟用 systemd，執行 `wsl --shutdown` 之後再跑一次精靈。

### 無法自動啟用 systemd lingering {#linger}

少數發行版需要管理員權限才能啟用。在發行版裡執行 `sudo loginctl enable-linger $USER`，回到精靈按「我已執行命令，重試」。

### 服務啟動逾時，或連接埠已被占用 {#service}

在發行版裡看服務狀態與最近的日誌：

```bash
systemctl --user status bat-server.service
journalctl --user -u bat-server -n 50
```

修正之後回到精靈按重試。連接埠被別的程式占用時，重試會改挑另一個埠。

### 網路模式的警告 {#network}

精靈最後可能提醒 WSL 用的是 NAT，或 `.wslconfig` 設了 mirrored 但還沒生效。NAT 模式一般不影響使用，只有連線失敗時才需要處理；設了 mirrored 卻沒生效時，執行 `wsl --shutdown` 讓設定生效，再跑一次精靈。

### 下載不到伺服器套件 {#bundle}

見[常見問題：設定遠端時下載不到伺服器套件](../faq#server-bundle)。

### 指紋不符 {#fingerprint}

見[遠端開發：憑證指紋](./#fingerprint)。

---

回報 WSL 相關問題時，請附上發行版名稱與版本、精靈的錯誤訊息與 BAT 的除錯日誌，見[回報與協助測試](../contribute)。更多問題見[常見問題](../faq#remote)。 {.remote-next}
