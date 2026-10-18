---
title: 回報與協助測試
description: 怎麼回報 Better Agent Terminal 的問題、回報時要附哪些資訊，以及 Codex 使用者怎麼協助測試 Tower / Worker 流程。
---

# 回報與協助測試

遇到問題、有想法，或願意幫忙測試，都歡迎到 GitHub 告訴我們。 {.ct-intro}

## 回報問題 {#report}

到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 開一個 issue。附上這些資訊，能更快找到原因：

- **BAT 版本**：安裝檔檔名上的版號。
- **作業系統與版本**。
- **Agent 與版本**：例如 `claude --version`、`codex --version` 的輸出。
- **怎麼重現**：你做了什麼、預期會怎樣、實際發生什麼。
- **除錯日誌**：最新的日誌檔，位置見[除錯日誌在哪裡](./faq#logs)。
- 遠端開發的問題，另外附上遠端環境（WSL 的發行版、SSH 主機的作業系統，或 Docker image）與設定精靈的錯誤訊息。

::: warning 上傳前先檢查
日誌與截圖可能含有你的專案路徑、帳號名稱、私人 repo 名稱。上傳前先看過一遍，把不想公開的內容遮掉；看起來像密碼或權杖的字串，一律遮掉。
:::

## 歡迎協助測試：Codex 使用者 {#testing}

BAT 與 Codex CLI 的整合持續在更新，但我們能測的環境有限。如果你平常就用 Codex，幫忙跑一次下面的流程並回報結果，成功也請告訴我們。 {.ct-lead}

### 1. 確認 BAT 的查詢工具已經掛上 {#testing-mcp}

1. 在 BAT 裡開一個 Codex CLI 分頁。
2. 請 Codex 呼叫 `bat_whoami` 工具。
3. 看回傳結果：`role` 是這個分頁的角色（自己開的分頁是 `shell`），`agent` 是 Agent 種類。拿得到結果，就代表 BAT 的唯讀查詢工具已經掛上。

呼叫失敗時，先確認 **設定 > 進階 > BAT MCP** 是開著的（變更後新開的分頁才會套用），再記下錯誤訊息。

### 2. 跑一次塔台與 Worker 流程（如果你在用 Control Tower） {#testing-tower}

1. 在一般分頁裡啟動塔台，不要在 Worker 分頁裡啟動。
2. 請塔台派一張小工單，指定由 Codex 執行；也可以先在「工作區設定」把這個工作區的預設 Agent 設成 Codex CLI。
3. 確認 Worker 分頁開好，標題的格式是「Codex CLI · Worker · 工單編號」，例如「Codex CLI · Worker · T1024」。
4. 確認 Worker 做完後，完成通知回到塔台。
5. 確認塔台收單後，Worker 分頁在輸出安靜下來後自動關閉。

卡住的話，記下停在哪一步，以及畫面上的訊息。

### 3. 回報結果 {#testing-report}

到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 開一個 issue，附上：

- BAT 版本與 `codex --version` 的輸出
- 作業系統
- 哪幾步成功、哪一步卡住，以及當時的訊息

Codex CLI 0.163.0 以上，BAT 才能判斷 Worker 有沒有啟動、是不是停下來在等人；較舊的版本照樣能派工與回報，也歡迎回報結果。
