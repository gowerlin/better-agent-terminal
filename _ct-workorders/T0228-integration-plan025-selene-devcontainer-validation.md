# T0228 — 整合:PLAN-025 Selene devcontainer 主場景驗證

## 元資料

- **編號**:T0228
- **類型**:integration(整合驗證)
- **狀態**:📋 TODO
- **建立時間**:2026-04-20 (UTC+8)
- **派發模式**:**必須 `--mode on --interactive`**(需 Selene 在 devcontainer 實機跑)
- **優先級**:🔴 High(PLAN-025 收斂驗證)
- **前置條件**:T0225(✅ DONE)、T0226(✅ DONE)、T0227(✅ DONE)
- **關聯**:PLAN-025、T0224(Selene 主場景規劃)、T0225/T0226/T0227(實作產出)
- **預估時間**:30-60 min(實測 + 回報,主要是 Selene 配合時間)
- **Renew 次數**:0

## 範圍

T0225-T0227 的整合驗收,**主場景為 Selene(macOS + VS Code + devcontainer)**,次場景由使用者(Gower)在可行環境補強。

## 驗證清單

### Selene 主場景(🎯 主驗收)

Selene 在 devcontainer(Debian 12)中跑以下流程:

1. **環境偵測**:
   ```bash
   env | grep -iE "REMOTE|CODESPACES|TERM|SSH|TMUX|BAT|WT_|WSL"
   ```
   → 確認 `REMOTE_CONTAINERS=true` 存在(或替代信號如 `/.dockerenv`)
   → T0225 偵測邏輯應識別為 `devcontainer` 類型

2. **OSC 52 穿透驗證**:
   ```bash
   printf '\033]52;c;%s\007' "$(echo 'test-from-devcontainer' | base64)"
   ```
   → 在 macOS host 剪貼簿中應可貼出 `test-from-devcontainer`(VS Code 1.79+ 穿透)
   → 若失敗:記錄 VS Code 版本 + 終端類型(可能非 VS Code Remote)

3. **`ask` 模式實測**:
   - 派發一張小工單(使用者建立 dummy T-XXXX)
   - auto-session 應**識別為 devcontainer**,並**不再顯示**「未知終端」
   - `ask` 模式選項應**動態生成**(排除不可用項,如「開新分頁」),保留「OSC 52 剪貼簿」和「文字提示」

4. **`on` 模式實測**:
   - auto-session 應**自動走 OSC 52 剪貼簿**路徑
   - 同時**保留文字提示**(T0227 R7 緩解)

5. **`yolo` 模式實測(關鍵)**:
   - Worker 收尾 Step 8.5 執行 `bat-notify.mjs --submit`
   - **需驗證**:Worker 在 devcontainer 內能不能觸到 BAT WebSocket(BAT_REMOTE_PORT 是否 expose)
   - 若不通 → Worker 在 devcontainer 執行**不可行**,需退到使用者手動送出(退回 `on` 模式等效)

### 次場景(使用者補強)

使用者(Gower)可在以下環境順便驗證:

- **Windows Terminal**(回歸):確認 R1/R2 緩解後現行行為未破壞
- **WSL(若有裝)**:確認 `wt.exe wsl.exe -e` 雙層指令可跑
- **tmux(若有裝)**:`tmux new-window` 可跑

## 必答問題(收斂)

1. **devcontainer 偵測是否準確?**(Selene env 輸出貼上)
2. **OSC 52 穿透是否成功?**(macOS host 剪貼簿有沒有出現測試字串)
3. **ask 模式選項是否動態正確?**(看到哪些選項)
4. **on 模式是否走對路徑?**(剪貼簿 + 文字提示)
5. **yolo 模式是否可行?**(BAT WebSocket 是否跨容器)
6. **Windows Terminal 回歸是否通過?**(使用者主場景)
7. **R4 VS Code 自動分頁行為驗證**(T0225 延後到此驗):
   - 在 Selene 的 VS Code 內建 terminal 執行 `claude "/ct-exec T-TEST-DUMMY"` 字面
   - 觀察是否真開新 tab / 或是在當前 tab 繼續跑
   - 若**失效** → VS Code non-devcontainer 情境改走剪貼簿 + 提示 Ctrl+Shift+\`
   - 若**仍有效** → 保留現行行為
   - 結論回報給塔台,若影響 T0225/T0226 文件則派補丁工單
8. **有沒有發現 T0225/T0226/T0227 遺漏的情境?**

## 禁止

- ❌ 修改 A/B/C 面 reference(T0225-T0227 已完成)
- ❌ 不驗證 Selene 主場景就收工(yolo 不會跑,必須 `--interactive`)
- ❌ Selene 沒回應就硬判定「通過」

## Worker 執行指引

本工單**高度依賴 Selene 互動**:

- Worker 收到工單 → 輸出驗證清單 + 指令模板
- Worker 要求使用者(Gower)將清單轉發給 Selene
- Selene 在 devcontainer 跑完指令 → 回報結果給 Gower → Gower 轉貼回 Worker
- Worker 彙整結果 → 填寫工單必答 7 題

**若 Selene 不在線**:
- 可延期,等 Selene 方便時再跑
- 或 Worker 先驗次場景(Windows Terminal / tmux)部分交差,主場景留 Renew

## 交付物

- 必答 7 題逐題回答 + 證據(env 輸出、OSC 52 測試結果、指令執行截圖或 log)
- Selene 主場景通過/失敗 + 失敗補救方案
- PLAN-025 可否結案判定(所有驗收標準達成?)

## 驗收標準(PLAN-025 結案條件)

- [ ] **驗收 1**:Selene 主場景(macOS + devcontainer)能走 `on` 模式(OSC 52 剪貼簿)
- [ ] **驗收 2**:WSL 能走 WT 雙層(若 Gower 有環境驗證)
- [ ] **驗收 3**:Linux 桌面(GNOME/Konsole)至少一個通過 — 文件推測 + 標註需實作後驗證
- [ ] **驗收 4**:tmux 能開新 window(若 Gower 有環境驗證)
- [ ] **驗收 5**:SSH 降級到 OSC 52 / 文字提示(文件推測,SSH 實測另開 T0230)
- [ ] **驗收 6**:環境偵測面板不再顯示「未知終端」(依 T0225 偵測結果)

## 塔台筆記

- 此為 **PLAN-025 最後一張主工單**,DONE 後 PLAN-025 可結案(驗收 6 項全綠)
- 若驗收有未達項 → PLAN-025 部分結案 + 開追加工單(或 T0229/T0230)
- yolo 樣本計數:T0228 **必然互動**,不算 yolo 樣本(BUG-050 不增加)

---

## 回報區(Worker 填寫)
