# PLAN-027 — Claude Runtime 選擇機制（內嵌 SDK vs 系統 CLI）

| 欄位 | 內容 |
|------|------|
| **狀態** | 📐 PLANNED(T0229 研究工單派發中)|
| **優先級** | 🟡 Medium |
| **類型** | 技術改善（可用性 / 維運彈性） |
| **建立時間** | 2026-04-22 |
| **建立者** | Gower |
| **驅動契機** | Claude CLI 更新頻繁（新功能 / bug fix），但 `@anthropic-ai/claude-agent-sdk` interface 相對穩定。內嵌版作為「保底能用」的安全網，使用者若想立即取得新版 CLI 能力應能 opt-in 切換到系統安裝版，不必等 BAT 重新打包。 |
| **關聯** | CLAUDE.md「Claude Agent SDK / CLI」段、`electron/claude-agent-manager.ts` |

---

## 動機 / 背景

目前 BAT 內嵌 `@anthropic-ai/claude-code ^2.1.111`（實際安裝 2.1.113）作為 Agent 執行環境。但：

1. **CLI 迭代快**：Anthropic 幾乎每週 ship 新功能 / bug fix / model 支援（例如 Opus 4.7 + xhigh effort 在 2.1.111 才加入）
2. **SDK interface 穩定**：Agent SDK 的對外介面變動慢，同一介面可對應多個 CLI 版本
3. **重新打包成本高**：升級內嵌版需走 BAT release 流程（build + notarize + 使用者更新 app）
4. **Power user 痛點**：想用 CLI 最新能力的使用者無法「自行更新 claude」即享受

**策略**：內嵌 = 保底能用；opt-in 切系統版 = 立即享受新版能力。

---

## 對齊決議（2026-04-22 需求對齊 Q1-Q7）

| # | 決議 |
|---|------|
| Q1 | 「系統 claude」指 Claude Code CLI（非純 Anthropic API） |
| Q2 | **預設**：內嵌 SDK（保底）；系統版為 opt-in |
| Q3 | **路徑來源**：PATH 自動偵測為主；可在 Settings 覆寫為自訂路徑 |
| Q4 | **Fallback**：系統版不可用時自動 fallback 到內嵌 SDK 並通知使用者 |
| Q5 | **生效時機**：每個新 session 啟動時讀取設定；舊 session 保留原路由 |
| Q6 | **UI 位置**：Advanced 分頁新增「Claude Runtime」區塊 |
| Q7 | **版號顯示**：內嵌版號 + 偵測到的系統版號並列 |

---

## 概念方案

### 架構分流

```
新 Agent session 建立請求
  └─ 讀取 settings.claudeRuntime = 'embedded' | 'system'
       ├─ 'embedded' → 直接走 @anthropic-ai/claude-agent-sdk（現狀）
       └─ 'system'
            ├─ 1. 偵測系統 binary（PATH 搜尋 `claude`，或使用者指定路徑）
            ├─ 2. 驗證可執行（`claude --version` + 版號 parse）
            ├─ 3. 成功 → 以 child_process 模式接上 SDK transport
            └─ 4. 失敗 → fallback 內嵌 + toast 通知使用者
```

### Settings UI（Advanced 分頁 → Claude Runtime 區塊）

```
┌─ Claude Runtime ─────────────────────────────────┐
│ ○ Embedded (bundled)    v2.1.113  [currently used]│
│ ○ System installed                                │
│     Path: [<auto>/auto-detect]  [Browse...]       │
│     Detected version: v2.1.115   ✓ healthy        │
│                                                   │
│ ⓘ System CLI fails? Falls back to embedded + notify│
│ 💡 Install latest: irm https://claude.ai/install.ps1 | iex │
└───────────────────────────────────────────────────┘
```

### 設定 schema

```typescript
interface ClaudeRuntimeSettings {
  mode: 'embedded' | 'system';
  customPath?: string;  // 空表示走 PATH 自動偵測
  lastDetectedVersion?: string;  // 快取偵測結果（啟動時刷新）
}
```

---

## 非目標 / 範圍外

- ❌ 不改變 Agent SDK 本體的介面
- ❌ 不做自動安裝 claude CLI（使用者自行 `irm ... | iex` / `brew install` / `npm i -g`）
- ❌ 不實作「自動升級內嵌版」機制（維持 release 流程）
- ❌ 不做 API 相容性握手（驗證只到版號 parse 為止）
- ❌ 不做多 binary 版本管理（使用者自理 PATH）

---

## 初步拆單建議（待 CT-T009 完成後排程）

| # | 工單主題 | 粒度估計 | 依賴 |
|---|---------|---------|------|
| 1 | 研究工單：child_process 接 SDK transport 可行性 + Windows/macOS/Linux `claude` binary 偵測策略 | research，~45-60 min | — |
| 2 | Settings schema + IPC 通道（main ↔ renderer） | T 單，~30 min | #1 |
| 3 | 路徑偵測 + 版號 parse + 健康檢查 | T 單，~45 min | #1, #2 |
| 4 | Runtime routing 實作（agent-manager 分流） | T 單，~60 min | #3 |
| 5 | Fallback 邏輯 + toast 通知 | T 單，~30 min | #4 |
| 6 | Settings UI（Advanced 分頁） | T 單，~45 min | #2, #3 |
| 7 | 整合測試 + 文件（CLAUDE.md 更新） | T 單，~30 min | #1-6 |

**總估計**：~4-5 小時 wall time（視 #1 研究結果可能擴大或收斂）。

**建議切入點**：從 #1 研究工單開始，驗證 child_process 模式接 SDK 的可行性是否有隱藏陷阱（例如 stdio streaming、auth token 傳遞、working directory）。

---

## 風險 / 未知數

| # | 風險 | 對策 |
|---|------|------|
| R1 | 系統 CLI 版本與 SDK interface 不相容（使用者裝到太舊或太新） | 版號範圍白名單 + 不相容時強制 fallback |
| R2 | Windows PATH 空格 / 中文路徑解析 | research 工單納入驗證 |
| R3 | child_process 模式的 stdio streaming 效能 vs 內嵌 | #1 benchmark |
| R4 | 使用者裝的 claude 有額外環境變數依賴（ANTHROPIC_API_KEY 等） | settings 提供「環境變數透傳」開關（或明示需要手動設） |
| R5 | macOS Gatekeeper 對未簽章 binary 的行為 | 使用者自理，BAT 只做偵測 |

---

## 排程提示

- **當前阻塞**：CT-T009 v4.3.3 patch（BMad-Guide 跨專案 DELEGATE，Selene v4.3.3 實測後才處理後續）
- **本 PLAN 啟動時機**：CT-T009 閉環後，若無其他 🔴 High 任務則進入 #1 研究工單
- **可平行化**：#2（Settings schema）與 #1（研究）可同時進行，但 #3 之後需等研究結論

---

## 回報 / 決議紀錄

（PLAN 進行中由塔台於此區更新）

---

## 結案紀錄

（DONE 或 DROPPED 時填寫）
