# Selene v4.3.2 測試指南 — T0228 devcontainer 主場景驗證

> **背景**:Control Tower v4.3.2 hotfix 擴展了 auto-session 終端偵測(原僅支援 Windows Terminal + VS Code/macOS Terminal,現涵蓋 devcontainer / WSL / Linux 桌面 / tmux / SSH + OSC 52 穿透)。devcontainer 主場景是本次 hotfix 的**重點受益情境**。
>
> **你的角色**:在 **macOS + VS Code + devcontainer(Debian 12)** 實機驗證 v4.3.2 是否把原本的體驗閉環打通。
>
> **回報對象**:Gower(會把你的結果轉貼回塔台完成 T0228 收斂)。

---

## 前置條件

- [ ] 已取得 v4.3.2 的完整 Control Tower skill 套件(Gower 會以壓縮包傳給你)
- [ ] Skill 已安裝到 `~/.claude/skills/`(`control-tower` / `ct-exec` / `ct-done` / `ct-status` / `ct-evolve` / `ct-insights` / `ct-fieldguide` / `ct-help` 八個目錄皆就位)
- [ ] 當前 session 在你的 devcontainer 內啟動(非 macOS host 也非 WSL)
- [ ] VS Code 版本 ≥ 1.79(OSC 52 穿透需求)

### 確認版號

在 Claude Code session 裡觸發塔台:
```
/control-tower
```

展開的偵測面板應該顯示底部:
```
塔台版本:v4.3.2 (frontmatter 讀取)
```

若顯示 v4.3.0 → 表示 skill 尚未更新,請回報 Gower 重新同步。

---

## 第一部分:環境偵測驗證(必做,5 min)

### 步驟 1 — env 輸出

在 devcontainer 內的 terminal 跑:

```bash
env | grep -iE "TERM|WSL|TMUX|SSH|REMOTE|BAT|WT_|CODESPACES|COLORTERM"
```

把輸出**完整**貼回(範例如下):

```
REMOTE_CONTAINERS=true
TERM_PROGRAM=vscode
TERM=xterm-256color
COLORTERM=truecolor
...
```

### 步驟 2 — 偵測面板結果

觸發 `/control-tower`,觀察「終端環境」欄位:

**預期**:不再是「❌ 未知」或「未知終端」,而是識別為 **devcontainer**(或類似)。

**實際**:(填入你看到的字串)

### 步驟 3 — Fast Path 快照

如果你之前用過 v4.3.0,應該已有 `_tower-state.md` 快取。v4.3.2 的 Full Scan 會把新偵測規則套用。

若你看到的面板顯示資料不是最新,手動跑:
```
*rescan
```

預期面板底部出現「📸 快照時間:...」更新。

---

## 第二部分:OSC 52 穿透測試(關鍵,3 min)

### 步驟 1 — 手動 OSC 52 escape test

在 devcontainer terminal 跑:

```bash
printf '\033]52;c;%s\007' "$(echo -n 'selene-devcontainer-test-v432' | base64)"
```

### 步驟 2 — 檢查 macOS host 剪貼簿

**切換到 macOS 任一文字輸入處**(Notes / Messages / 瀏覽器網址列),按 `Cmd+V`:

- ✅ 如果貼出 `selene-devcontainer-test-v432` → **穿透成功,VS Code ≥ 1.79 的 OSC 52 功能正常**
- ❌ 如果貼出的是你之前剪貼簿的內容(沒變) → **穿透失敗**,需要檢查:
  1. VS Code 版本是否真的 ≥ 1.79
  2. VS Code settings 是否啟用 `terminal.integrated.enableMultiLinePasteWarning` 或相關 OSC 剪貼簿設定
  3. devcontainer 是否由 VS Code Remote 啟動(不是純 docker exec)

### 步驟 3 — base64 完整性

如果步驟 2 成功但貼出的內容是亂碼或 base64 原文 → OSC 52 格式有問題,回報實際貼出的字串。

---

## 第三部分:三模式實測(ask / on / yolo,約 15 min)

### 預先準備

在 devcontainer 的 Claude Code session 內觸發塔台:
```
/control-tower
```

等塔台起手式完成。**不要**執行 `*onboard`,直接用當前設定。

### 模式 1 — ask(互動式)

讓塔台跑以下內建命令切回 ask:
```
*config auto-session ask
```

然後丟一個**最小**工單需求給塔台(你自己編,小事就好),讓塔台產工單並派發。

**預期行為**:
- 塔台顯示「📦 派發面板」
- 底部出現**選項式提問**(不同於 Windows WT 的「開新分頁」,devcontainer 情境下**應該**只顯示可用選項,如 OSC 52 / 文字提示)
- 你選其中一個 → 塔台執行對應動作

**實測記錄**(填入):
- 出現哪些選項?(例如「A: OSC 52 剪貼簿 / B: 文字提示」)
- 選了之後行為?
- 有無任何異常訊息?

### 模式 2 — on(自動)

```
*config auto-session on
```

再派一個小工單。

**預期行為**:
- 塔台**自動**走降級鏈:優先 OSC 52 → 若偵測失敗降級文字提示
- **永遠**顯示文字提示(即使 OSC 52 看似成功,依 C.3 規範)
- 你的 macOS 剪貼簿**應該**含有派發指令(例如 `claude "/ct-exec T####"`)

**實測記錄**:
- 塔台輸出哪些提示?
- 手動 `Cmd+V` 貼到 macOS Notes → 貼出的是否為完整 `claude "/ct-exec T####"` 指令?
- 若是 → 你可以**在 macOS host 開新終端直接貼上執行** → 觀察 Worker 是否正常啟動

### 模式 3 — yolo(全自動 + Worker 自回報)

⚠️ **注意**:yolo 模式會讓 Worker 完成工單後**自動送出**「T#### 完成」字串給塔台。在 devcontainer + macOS host 跨容器情境下,需驗證 BAT WebSocket 是否可跨容器通達。

```
*config auto-session yolo
```

派一個小工單。

**重要觀察點**:
- Worker 是否顯示 🚨 YOLO MODE ACTIVE banner?
- Worker 完成後,**自動** `bat-notify.mjs --submit` 是否送達塔台(在你的 devcontainer 內,塔台 session 應看到工單完成訊號)?
- 若 Worker 在 devcontainer 內跑,**塔台也在 devcontainer 內跑**,兩者都在同一容器 → 理論上 BAT WebSocket 通訊內部 → 應該能跑
- 若 Worker 在 macOS host 跑、塔台在 devcontainer → **跨容器** → 很可能失敗(BAT_REMOTE_PORT 未 expose)

**實測記錄**:
- Worker banner 是否正確顯示?
- Worker 完成後,塔台是否**不需要**你手動轉貼「T#### 完成」就自動收到?
- 若失敗,失敗訊息是什麼?(例如 `Connection refused` / `ECONNREFUSED` 等)

---

## 第四部分:VS Code 自動分頁行為驗證(R4 關鍵,3 min)

### 背景

研究階段把「VS Code 現行實作走 `claude "/ct-exec T####"` 字面指令 → 依賴 VS Code 自動開新 terminal tab」列為高風險,**實測可疑**。本 hotfix 未改動這行為(維持現行指令),等你這次驗證。

### 步驟 1 — VS Code 內建 terminal 實測

**這要在 VS Code 的內建 terminal**(不是 devcontainer 內的 terminal,而是**VS Code 直接開的 macOS host terminal**,或 VS Code + non-devcontainer 情境下的 terminal)。

如果你能切到 **non-devcontainer 的 VS Code terminal**(例如關掉 Remote-Containers,用 local VS Code workspace),跑以下指令:

```bash
claude "/ct-exec T-TEST-DUMMY"
```

### 步驟 2 — 觀察

可能的結果:

| 結果 | 意義 |
|------|------|
| VS Code **開新 terminal tab** 跑 claude | ✅ 現行行為**仍有效**,auto-session.md 可以保留現行指令 |
| VS Code 在**當前 tab** 跑 claude(覆蓋當前 shell) | ⚠️ 部分有效,但不符「auto-session」預期 |
| 完全不動 / 出現錯誤 | ❌ **失效**,需要派 v4.3.3 patch 改用剪貼簿+提示 |

**實測記錄**:
- 發生了哪一種?
- 如果失效,錯誤訊息?
- 如果部分有效,具體行為?

### 步驟 3 — 若無法測 VS Code non-devcontainer

你的主力是 devcontainer,可能沒有 non-devcontainer 的 VS Code 工作區。這種情況下:

→ **直接回報「無法測試 VS Code non-devcontainer」**,此項轉給 Gower 或其他可測環境的使用者。

---

## 第五部分:回報格式(給 Gower 轉貼)

請依以下結構回報給 Gower,他會直接貼回塔台 T0228 工單讓塔台做結論判定:

```markdown
# T0228 Selene devcontainer 驗證結果 — 2026-04-XX

## 環境

- VS Code 版本:(例 1.95.0)
- devcontainer 映像:Debian 12
- macOS 版本:(例 15.1)
- Claude Code 版本:(跑 `claude --version`)

## Part 1 — 環境偵測

### env 輸出
(貼入完整 env grep 結果)

### /control-tower 面板
終端環境欄位顯示:________(填實際字串)

## Part 2 — OSC 52 穿透

- 手動 escape test + Cmd+V 結果:(✅ 穿透 / ❌ 失敗 / 具體行為)
- 遇到問題:________

## Part 3 — 三模式

### ask
選項:________
行為:________

### on
提示內容:________
Cmd+V 貼出:________
可否手動執行派發指令:✅ / ❌ + 說明

### yolo
Banner 顯示:✅ / ❌
自動回報成功:✅ / ❌
失敗訊息(若有):________

## Part 4 — R4 VS Code 自動分頁

測試環境:(non-devcontainer VS Code / 無法測試)
結果:(✅ 仍有效 / ⚠️ 部分 / ❌ 失效 / 未測)
詳細行為:________

## Part 5 — 其他發現

- 文件推測項目有哪些實際與 spec 描述不符?
- 有沒有遺漏的場景(例如你特別的使用情境)?
- 使用者體驗是否真的比 v4.3.0 明顯改善?

## Part 6 — 品質自評(依你的體感)

[1 最差 / 5 最好]
- 識別準確度:(1-5)
- 降級鏈合理性:(1-5)
- 文字提示清晰度:(1-5)
- 整體體驗改善:(1-5)
```

---

## 備忘與常見問題

### Q:跑 OSC 52 但 Cmd+V 貼不出測試字串?

依序檢查:
1. VS Code 設定 → search "osc" → 確認 terminal OSC 52 相關設定
2. 確認 devcontainer 由 VS Code Remote-Containers 啟動(不是 docker CLI exec)
3. 試試 iTerm2 → `ssh` 到 devcontainer 跑相同 escape(看是否 OSC 52 全鏈失效或僅 VS Code 失效)

### Q:yolo 模式 Worker 回報不到塔台?

最可能原因:BAT_REMOTE_PORT 在 devcontainer 網路層被擋。驗證方式:
```bash
# 在 Worker terminal(同一個 devcontainer)
nc -zv localhost $BAT_REMOTE_PORT
```

若連不上 → BAT 服務沒在容器內啟動,yolo 模式不適用此環境(退回 on 模式手動轉貼)。

### Q:想直接重現本 hotfix 背景的完整研究?

研究產出已 sanitize 到 auto-session.md release 版;若你想看**完整研究細節**,請跟 Gower 要原始研究工單與對應附件(不公開 release,僅作為你個人背景理解用)。

---

## 預估時間

| 部分 | 預估 |
|------|-----|
| 前置條件 + 版號確認 | 3 min |
| Part 1 環境偵測 | 5 min |
| Part 2 OSC 52 | 3 min |
| Part 3 三模式 | 15 min(主要時間在等工單 + 切換) |
| Part 4 R4 | 3 min(或 0,若無法測) |
| Part 5-6 回報 | 5 min |
| **總計** | **~30-35 min** |

---

## 致謝 🙏

Selene,你的 devcontainer 主場景是本次 hotfix 的核心驅動。在 BAT 開發環境內我們能靠研究 + 文件推測走到這裡,但**真實穿透與降級行為必須靠你的實機資料來閉環**。不論你發現什麼(好或壞),回報都很有價值,會成為下一版迭代的輸入。

若遇到指南本身寫不清楚的地方,回報給 Gower,塔台會改進指南。
