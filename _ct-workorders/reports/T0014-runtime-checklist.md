# T0014 Runtime Verification Checklist

> **對象**:使用者(人類手動執行)
> **目的**:驗證 T0014 的 crash-safe logging 在真實 GUI 環境下運作 + **順便重現 BUG-004** 收集 log
> **預估時間**:25 - 35 分鐘
> **建立時間**:2026-04-11 11:37 (UTC+8)

---

## ⚠️ 前置準備

1. **確認塔台 session 位置**:VS Code Git Bash 或外部終端即可(**不要**在 BAT 跑的 Claude Code),Part 7 閃退才不會連坐塔台
2. **關閉不必要的 app**(Part 7 要閃退,保留工作狀態)
3. **打開 Windows 檔案總管**:導航到 `%APPDATA%\better-agent-terminal\Logs\`
4. **啟動 Dev Server(兩種方式擇一)**:
   - **方式 A(推薦)**:VS Code `Ctrl+Shift+P` → `Tasks: Run Task` → 「**開發: 啟動 Dev Server (Runtime)**」
     - 這會跑 `npm run dev-runtime`(帶 `BAT_RUNTIME=1` 旗標,為 runtime test 設計)
   - **方式 B**:終端 `cd` 到專案根目錄 → `npm run dev-runtime`
5. 等 Electron app(BAT)啟動完成 → **先不要按麥克風**,跑完 Part 1~6 再說
6. **清理指令**:跑完後可用 VS Code Task 「**開發: 終止所有 Dev 進程**」或終端 `pwsh .vscode/scripts/kill-dev.ps1` 精準殺掉 Vite + Electron

---

## Part 1 — 基礎 log 檔案產生(5 分鐘)

### [ ] 1.1 Logs 目錄有新檔案
- 動作:看視窗 A(檔案總管)
- 預期:看到 `debug-YYYYMMDD-HHmmss.log` 新檔案(時間戳 = 剛剛啟動 app 的時間)
- 若舊 `debug.log` 存在,應已搬到 `debug-legacy-*.log`
- **若看不到新檔**:記下來,Part 1 ❌

### [ ] 1.2 Log 內容格式正確
- 動作:開啟最新的 `debug-*.log`,看前 10 行
- 預期格式:`[ISO timestamp] [LEVEL] [module] message`
- 預期內容:應看到 `[INFO] Debug logging started`、`[LOG] [startup] ...`、`[LOG] [voice] ...`
- **貼前 10 行到塔台回報**(複製準備好)

---

## Part 2 — Renderer Console 轉發(3 分鐘)

### [ ] 2.1 console.error 被捕捉
- 動作:在 BAT 視窗按 `F12` 開 DevTools → 切到 Console
- 執行:`console.error('T0014 test from renderer')`
- 回視窗 A,重新開啟 log 檔案
- 預期:log 尾段有 `[RENDERER] [ERROR] T0014 test from renderer`

### [ ] 2.2 uncaught error 被捕捉
- DevTools Console 執行:`setTimeout(() => { throw new Error('T0014 uncaught test'); }, 0)`
- 預期:log 有 `[RENDERER]` 開頭 + uncaught error stack trace
- (用 setTimeout 避免 DevTools 當場 catch)

### [ ] 2.3 unhandledrejection 被捕捉
- DevTools Console 執行:`Promise.reject(new Error('T0014 rejection test'))`
- 預期:log 有 `[RENDERER]` 開頭 + unhandledrejection 訊息

---

## Part 3 — Settings UI(5 分鐘)

### [ ] 3.1 新 section 出現位置正確
- 動作:在 BAT 內打開 Settings
- 預期:「🎤 語音輸入」section **下方**有新的「📋 除錯日誌」section

### [ ] 3.2 section 完整度
預期看到 **6 個元件**:
- [ ] Toggle「啟用除錯日誌」
- [ ] Select「日誌等級」(5 個選項:error/warn/info/log/debug)
- [ ] 唯讀文字「日誌位置:<完整絕對路徑>」
- [ ] 按鈕「📂 開啟日誌資料夾」
- [ ] 按鈕「🧹 清理舊日誌」
- [ ] 說明文字

### [ ] 3.3 「開啟日誌資料夾」按鈕
- 動作:點按鈕
- 預期:系統檔案總管開啟 `%APPDATA%\better-agent-terminal\Logs\`(或已在該目錄前景)

### [ ] 3.4 日誌等級熱切換
- 動作:切換等級為 `warn`
- DevTools Console 執行:`console.info('T0014 should NOT appear in warn mode')`
- 檢查 log:**不應**出現這筆
- 動作:切回等級為 `debug`
- DevTools Console 執行:`console.info('T0014 should APPEAR in debug mode')`
- 檢查 log:應出現這筆

### [ ] 3.5 Toggle 開關熱切換
- 動作:關閉 Toggle「啟用除錯日誌」
- DevTools Console 執行:`console.error('T0014 should NOT appear when disabled')`
- 檢查 log:**不應**出現這筆
- 動作:重新開啟 Toggle
- DevTools Console 執行:`console.error('T0014 should APPEAR when enabled')`
- 檢查 log:應出現這筆

### [ ] 3.6 「清理舊日誌」按鈕(若目前檔案 < 10 個可跳過)
- 動作:點按鈕
- 預期:顯示清理數量(例如「刪除 0 個檔案」若不足 10 個)

---

## Part 4 — File 選單(3 分鐘)

### [ ] 4.1 3 個新項目存在
- 動作:BAT 主選單 → File
- 預期:看到 3 個新項目:
  - [ ] `📂 Open Application Data Folder`
  - [ ] `📋 Open Logs Folder`
  - [ ] `💥 Open Crash Reports Folder`

### [ ] 4.2 每個項目開啟正確位置
- [ ] Application Data Folder → `%APPDATA%\better-agent-terminal\`
- [ ] Logs Folder → `%APPDATA%\better-agent-terminal\Logs\`
- [ ] Crash Reports Folder → `%APPDATA%\better-agent-terminal\Crashes\`(可能是空目錄或新建目錄)

---

## Part 5 — 輪替機制(5 分鐘,可選)

**若時間趕可跳過此 Part,結果在 Part 7 會自然累積**

### [ ] 5.1 關閉 BAT
### [ ] 5.2 在 Logs/ 目錄手動複製現有檔案 11 次
- 例如 `debug-A.log`、`debug-B.log`、... `debug-K.log`(11 個假檔)
### [ ] 5.3 重啟 BAT(`npm run dev`)
### [ ] 5.4 檢查 Logs/:應只剩最新的 10 個檔案(最舊的 2 個被刪)
### [ ] 5.5 刪除假檔恢復乾淨

---

## Part 6 — crashReporter(Renderer crash,3 分鐘)

**注意:這會讓 DevTools 斷線重連,但不會整個閃退**

### [ ] 6.1 模擬 renderer crash
- 動作:BAT DevTools Console 執行:`process.crash()`
- 預期:DevTools 短暫斷線,然後重連(跟 BUG-004 初期症狀類似,但 **app 本體還活著**)
- 若沒有 `process`:嘗試 `window.location.href = 'about:crash'`

### [ ] 6.2 檢查 log 有 CRASH 紀錄
- 動作:開啟最新 log 檔案,看尾段
- 預期:`[CRASH] render-process-gone reason=<xxx> exitCode=<xxx>`

### [ ] 6.3 檢查 Crashes 目錄
- 動作:檔案總管導航到 `%APPDATA%\better-agent-terminal\Crashes\`
- 預期:有 `.dmp` 檔案產生(或子目錄如 `reports/`)
- 記下檔名和大小(不需要上傳)

---

## Part 7 — 🔥 BUG-004 重現(關鍵,5-10 分鐘)

**⚠️ 警告**:這一步會讓整個 BAT 閃退。
- 確認塔台**不在 BAT 內**(反覆確認!)
- 準備好 log 檔案觀察視窗
- 萬一塔台被連坐,不要緊,重啟塔台時會從 `_tower-state.md` 恢復

### [ ] 7.1 BAT 啟動並穩定
- 確認目前 BAT 有在跑,DevTools 仍連線
- 先在 DevTools Console 執行 `console.log('T0014 pre-BUG-004 marker at ' + new Date().toISOString())`
- **這個 marker 很重要**,它會是 log 裡「崩潰前最後一筆正常事件」的錨點

### [ ] 7.2 按下麥克風按鈕
- 動作:PromptBox(輸入框旁)按麥克風圖示按鈕
- 預期:**BAT 閃退**(跟上次一樣)
- 若**沒閃退**:記下這個觀察!可能是 T0014 的改動意外修好了(不太可能,但要記)

### [ ] 7.3 收集 log(最重要)
- BAT 閃退後,**不要**立刻重啟它
- 開最新的 `debug-*.log`(不是 legacy)
- 找到你剛才設的 marker `T0014 pre-BUG-004 marker at ...`
- **複製從 marker 開始到檔案末尾的所有行**(通常會是 20-200 行)
- 這就是 BUG-004 的黃金證據
- 準備貼到塔台

### [ ] 7.4 檢查 Crashes 目錄
- 導航 `%APPDATA%\better-agent-terminal\Crashes\`
- 看看有沒有**新產生**的 `.dmp` 檔(時間戳 = 剛才閃退時間)
- 記下:
  - 檔名
  - 大小(KB)
  - 有或沒有
- 不需要上傳 dump,只記錄存在性

### [ ] 7.5 重啟 BAT 確認恢復
- `npm run dev` 重啟
- 確認新的 `debug-*.log` 產生
- 確認 `debug-legacy-*.log` 或之前的 log 保留(輪替機制正確)

---

## 📮 回報格式(跑完後貼到塔台)

```
T0014 Runtime 驗收結果

Part 1 — 基礎 log:✅/❌
Part 2 — renderer 轉發:✅/❌ (2.1/2.2/2.3 分別 ✅❌)
Part 3 — Settings UI:✅/❌ (3.1/3.2/3.3/3.4/3.5/3.6 分別 ✅❌)
Part 4 — File 選單:✅/❌ (4.1/4.2 分別 ✅❌)
Part 5 — 輪替:✅/❌/跳過
Part 6 — crashReporter (renderer crash):✅/❌

===== Part 1 log 前 10 行 =====
<貼這裡>

===== Part 7 BUG-004 結果 =====
- BAT 閃退:是/否
- 閃退前 marker 已設:是/否
- log 從 marker 到尾端:
<貼這裡,完整複製>

- Crashes 目錄新 .dmp:是/否
- 檔名:<xxx.dmp 或 無>
- 大小:<XX KB 或 -->

===== 觀察與問題 =====
<任何異常、疑問、額外觀察>
```

---

## 💡 提示

- **跑 Part 1-6 順序很重要**,Part 7 會讓 BAT 閃退,一旦閃退後面跑不了
- **Part 5 可選**,時間不夠可跳
- **Part 6 的 `process.crash()` 是受控測試**,不要混淆為 BUG-004
- **Part 7 的 `T0014 pre-BUG-004 marker`** 是關鍵,它讓塔台能精準定位崩潰前最後一筆合法事件
- **不要手動編輯 log 檔**,原始內容對診斷最有價值
- **有疑問當下就問塔台**,不要猜

---

**完成後告訴塔台**:「T0014 runtime 驗收完成,結果如下...」
