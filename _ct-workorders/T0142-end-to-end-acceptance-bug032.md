# T0142 — BUG-032 END-TO-END 整合驗收

## 元資料
- **工單編號**：T0142
- **類型**：acceptance（驗收工單，使用者主導，塔台引導）
- **狀態**：🔀 MERGED → T0143（Phase 2-5 觀察條件已內嵌於 T0143 Task B）
- **優先級**：🔴 High（BUG-032 修復鏈第 4 棒，是否能進上游 PR 的閘門）
- **派發時間**：2026-04-17 13:05 (UTC+8)
- **合併時間**：2026-04-17 13:25 (UTC+8)
- **合併決策**：D034 — 改採 dogfood 驗收（派 T0143 研究工單的行為即為鏈路驗證），Phase 1 由塔台派發前手動引導執行
- **合併說明**：原 T0142 Phase 2-5 觀察項已內嵌於 T0143 「Task B: BUG-032 鏈路觀察」段落；Phase 4（T0135 9 項）不併入 T0143，等 T0143 驗證鏈路通過後再單獨處理
- **關聯 BUG**：BUG-032（OPEN）
- **前置工單**：T0139 / T0140 / T0141（全部 ✅ DONE）
- **後續工單**：T0143（CT 上游回 PR），需本工單全綠才派發
- **預估難度**：⭐⭐⭐（真實使用者環境整合測試，最耗時也最關鍵）
- **執行方式**：**使用者手動操作 BAT + 命令列**，**塔台 session 直接引導**（不派 sub-session）

---

## 目的

在使用者真實環境（`D:\ForgejoGit\2026_Taipower` workspace）驗證 BUG-032 修復鏈完全生效：

1. ✅ Helper scripts 在打包安裝目錄存在
2. ✅ `BAT_HELPER_DIR` env var 在打包版正確注入並指向 `<install-root>/resources/scripts/`
3. ✅ 塔台白名單呼叫 `node "$BAT_HELPER_DIR/bat-terminal.mjs" ...` 成功
4. ✅ Worker 完成工單後透過 `bat-notify.mjs` 主動通知塔台（**非剪貼簿降級**）
5. ✅ 順便完成 T0135 9 項 MANUAL（順延驗收）
6. ✅ 順便完成 BUG-031 副作用檢查（workspace 一致性）

全綠 → BUG-032 標記 FIXED（後續轉 CLOSED）→ 派 T0143。
任一不綠 → 塔台分析根因，可能加派修復工單或 Renew 本工單。

---

## 前置條件（使用者執行）

### 1. Build & Pack
```bash
cd D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal
npm run build       # 套用 T0140 + T0141 變更（T0139 已驗）
npm run build:dir   # 或 npm run build:win 產出完整 installer
```

### 2. 重裝 BAT
- 關閉當前 BAT 全部視窗
- 用 `release/win-unpacked/` 內的 exe 覆蓋 / 或執行 installer 安裝新版
- 重啟 BAT

### 3. 開啟 2026_Taipower workspace
- BAT → 開啟資料夾 → `D:\ForgejoGit\2026_Taipower`
- **不要開 better-agent-terminal source workspace**（這是測試重點 — 確認在無 source 的純使用者環境也能跑）

### 4. 在 2026_Taipower workspace 內開塔台 session
- 開新 Claude session（不要復用既有的 BAT 原始碼塔台 session）
- 載入 control-tower skill：`/control-tower`

---

## 驗收清單（塔台帶使用者逐項跑）

### Phase 1 — 基礎環境驗證（最重要，5 分鐘）

| # | 檢查項 | 指令 | 預期結果 | 結果 |
|---|--------|------|---------|------|
| 1.1 | helper scripts 存在於安裝目錄 | `ls "$LOCALAPPDATA/Programs/better-agent-terminal/resources/scripts/"` 或對應路徑 | 兩支 .mjs 都在 | ⏳ |
| 1.2 | `BAT_HELPER_DIR` 已注入 | 在新塔台 session 跑 `echo "$BAT_HELPER_DIR"` | 顯示 packaged 路徑（非 `scripts` 相對路徑、非空） | ⏳ |
| 1.3 | 路徑可解析 | `ls "$BAT_HELPER_DIR/bat-terminal.mjs" && ls "$BAT_HELPER_DIR/bat-notify.mjs"` | 兩檔皆 OK | ⏳ |
| 1.4 | helper 可執行 | `node "$BAT_HELPER_DIR/bat-terminal.mjs"` （無參數，看是否有 usage 訊息或合理錯誤） | 不是 ENOENT；至少跑進 helper 內部 | ⏳ |

> **若 1.x 任一失敗** → 立即停，回報塔台。可能 T0139/T0140/T0141 之一沒生效，需要先除錯。

### Phase 2 — Auto-Session 路由驗證

| # | 檢查項 | 動作 | 預期結果 | 結果 |
|---|--------|------|---------|------|
| 2.1 | 塔台派發測試工單 | 塔台 session 派一張小工單（ex: `*sync` 之類無副作用 / 或派 T0142 自己） | BAT 自動開新 PTY tab | ⏳ |
| 2.2 | PTY 落在 active workspace | 觀察新 tab 是否歸屬當前 2026_Taipower workspace | 是（不是其他 workspace） | ⏳ |
| 2.3 | 走的是 `BAT_HELPER_DIR` 路徑 | 看塔台執行的 Bash 指令是 `node "$BAT_HELPER_DIR/bat-terminal.mjs" ...`（不是 `node scripts/...`） | 是 | ⏳ |
| 2.4 | 非剪貼簿降級 | 派發後不應出現「請手動貼到新 BAT 終端」之類提示 | 確認 | ⏳ |

### Phase 3 — Worker → Tower 通知驗證（T0133 鏈路）

| # | 檢查項 | 動作 | 預期結果 | 結果 |
|---|--------|------|---------|------|
| 3.1 | Worker 完成觸發通知 | 等 Phase 2 工單跑完 | 塔台 session 收到 Toast / Badge / PTY 預填 | ⏳ |
| 3.2 | 通知透過 `bat-notify.mjs` | Worker 終端歷史可見 `node "$BAT_HELPER_DIR/bat-notify.mjs" ...` 被呼叫 | 是 | ⏳ |
| 3.3 | 通知非剪貼簿降級 | 沒看到「請手動貼通知到塔台」提示 | 確認 | ⏳ |
| 3.4 | Worker 完成後塔台 session 仍在 active workspace | 切回塔台 session 看 workspace 標示 | 一致 | ⏳ |

### Phase 4 — T0135 順延驗收（9 項 MANUAL）

從 T0135 工單檔抓出順延的 9 項，逐一執行。建議塔台另外讀 T0135 引導，避免本工單過長。

| # | T0135 項 | 結果 |
|---|---------|------|
| 4.1 | 1.3 Cache History | ⏳ |
| 4.2 | 1.4 Cache abort | ⏳ |
| 4.3 | 2.3 CT 按鈕 PTY write | ⏳ |
| 4.4 | 3.3 Settings UI | ⏳ |
| 4.5 | 5.3 外部 PTY UI 同步 | ⏳ |
| 4.6 | 7.5 Toast | ⏳ |
| 4.7 | 7.6 Badge | ⏳ |
| 4.8 | 8.5 端到端 | ⏳ |
| 4.9 | 6.2 `--help` 未實作（PARTIAL，本次決定要不要補） | ⏳ |

### Phase 5 — BUG-031 副作用檢查（workspace 一致性）

| # | 檢查項 | 動作 | 預期結果 | 結果 |
|---|--------|------|---------|------|
| 5.1 | 多 workspace 同時開 | 同時開 2026_Taipower + better-agent-terminal source 兩個 workspace（若有 parent folder 同時開更佳） | 兩個 workspace 都能正常運作 | ⏳ |
| 5.2 | 在 2026_Taipower 派工單，PTY 不會跑去 source workspace | 派發測試 | PTY 落在 active 而非 cwd-match 較早的 | ⏳ |
| 5.3 | 通知 Toast / Badge 顯示在正確 workspace | 等通知 | 是 | ⏳ |

---

## 驗收結果記錄

驗收完成後填入：

- **Phase 1**：__/4 項 PASS
- **Phase 2**：__/4 項 PASS
- **Phase 3**：__/4 項 PASS
- **Phase 4**：__/9 項 PASS / __ PARTIAL / __ FAIL
- **Phase 5**：__/3 項 PASS

**整體判定**：
- 🟢 全綠 → 標 BUG-032 FIXED → 派 T0143
- 🟡 部分綠 → 塔台分析，決定加派工單 or PARTIAL CLOSE
- 🔴 大量 FAIL → Renew 本工單，補修或回頭看 T0139-T0141

---

## 工單回報區（驗收完成後塔台統籌填寫）

### Phase 1 詳細結果
（塔台填）

### Phase 2 詳細結果
（塔台填）

### Phase 3 詳細結果
（塔台填）

### Phase 4 詳細結果（T0135 順延）
（塔台填）

### Phase 5 詳細結果（BUG-031 副作用）
（塔台填）

### 發現的新問題 / 加派工單
（塔台填）

### 整體結論
（塔台填）

---
