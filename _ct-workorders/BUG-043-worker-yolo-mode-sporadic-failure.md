# BUG-043 — Worker YOLO mode 偶發失效(banner 不顯示)

## 元資料
- **編號**:BUG-043
- **狀態**:OPEN(待 log 再現分析)
- **嚴重度**:🟡 Medium(不影響工單功能,僅降級到剪貼簿 fallback,但破壞 yolo 閉環)
- **建立時間**:2026-04-19 00:00 (UTC+8)
- **發現來源**:PLAN-019 dogfood 期間(T0189 首次觀察)
- **關聯**:T0189(首次失效)· T0190(首次復原)· T0191/T0192(再現)· T0193(復原)· T0192 + T0193(診斷儀表就緒)
- **可重現**:偶發(無穩定觸發條件)
- **workaround**:降級到剪貼簿 fallback(使用者手動貼完成訊息)

## 現象

配置 `auto-session: yolo` 下派發工單,Worker 啟動時**應顯示** 🚨 YOLO MODE ACTIVE banner,完成後**應自動送出**「T#### 完成」回塔台。

**實際**偶發情況:
- Worker 啟動無 banner
- Worker 回報時降級訊息:`Step 8.5 檢查:非 BAT 環境(BAT_SESSION 未設),跳過。Step 11 剪貼簿:T#### 完成`
- 使用者需手動貼回塔台

## 樣本時序(PLAN-019 dogfood)

| 工單 | 派發前互動 | 前 Worker 狀態估計 | Banner |
|------|----------|-----------------|--------|
| T0186 | Q1/Q2/Q3 對齊 | (首張) | ✅ |
| T0187 | T0186 DONE 立即派 | 剛關 | ✅ |
| T0188 | T0187 DONE 立即派 | 剛關 | ✅ |
| T0189 | T0188 DONE 立即派 | 剛關 | ❌ |
| T0190 | yolo 討論後 | 間隔大 | ✅ |
| T0191 | T0190 DONE + Q2/Q3 討論 | 間隔中 | ❌ |
| T0192 | T0191 DONE + 診斷討論 | 間隔中 | ❌ |
| T0193 | T0192 DONE + PLAN-019 收尾 | 間隔中 | ✅ |

**規律未發現**(互動/無互動、間隔大小都無相關性)→ 疑 race 或 terminal 生命週期狀態依賴。

## 塔台側驗證(已排除)

- `BAT_SESSION=1` 在塔台 session env 中正常保留(T0192 驗證)
- 派發指令字面完全一致(跨 T0186-T0193 都是同 argv)
- 派發時塔台 env 沒丟(用 `echo $BAT_SESSION` 確認)

## 假設(待 log 驗證)

1. **建新 vs 重用 terminal 分支 bug**:若 bat-terminal.mjs 開新 Worker terminal 時走「建新」分支,env 傳遞某條件下失敗(race?timing?)。重用現有 terminal 分支 env 正常
2. **Electron RemoteServer 側 customEnv 傳遞斷鏈**:`terminal:create-with-command` 收到 customEnv 後,spawn PTY 時某條件下未注入環境
3. **其他未知(race)**:時序依賴的隱性競爭

## 已建立診斷儀表

| 工單 | 儀表 | 涵蓋層級 |
|------|------|---------|
| T0192 | `scripts/bat-terminal.mjs` + `bat-notify.mjs` NDJSON log | scripts 層 invoke / parsed / exit |
| T0193 | `electron/remote/remote-logger.ts` 鏡像 + `main.log` | RemoteServer IPC ipc-invoke / terminal-created / terminal-reused / customEnv / `reusedExisting` |

**log 檔**:`%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`(NDJSON,append-only)

## 診斷流程(下次再現時)

1. 觀察 Worker banner(有/無)
2. 撈 log:`grep "T0###" bat-scripts.log`(按 sourceTerminalId 或派發時間)
3. 檢查鏈路:
   - `script: bat-terminal event: invoke` → 有 `CT_MODE=yolo`?有 BAT_*?
   - `script: remote-server event: ipc-invoke` → 收到完整 customEnv?
   - `script: remote-server event: terminal-created/reused` → `reusedExisting` 值?
4. 對比 Worker 側 `BAT_SESSION` 偵測(Step 8.5 `echo $BAT_SESSION`)

## 可能後續動作(待 log)

- 若 `reusedExisting:false` + customEnv 完整 + Worker 側 BAT_SESSION 未設 → PTY spawn 時 env 注入 bug(修 RemoteServer)
- 若 customEnv 進 RemoteServer 時已缺 → bat-terminal.mjs 傳遞 bug(修 scripts)
- 若 customEnv 完整但 Worker 收不到 → Electron child_process spawn API 使用不當(深挖)

## 備註

- 本 BUG 不阻塞交付(剪貼簿 fallback 可用)
- PLAN-019 在有 BUG-043 干擾下仍成功交付(133 → 2 errors)
- 使用者授權:診斷儀表已裝,等樣本自然出現,不刻意複製
