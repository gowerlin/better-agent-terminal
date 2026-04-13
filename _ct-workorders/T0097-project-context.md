# 工單 T0097 — 產生 project-context.md

## 元資料
- **工單編號**：T0097
- **任務名稱**：產生 project-context.md（專案願景 + 技術決策）
- **優先級**：高（配置類，進度依賴）
- **估時**：15 分鐘
- **狀態**：✅ DONE

---

## 任務描述

產生專案根目錄下的 `project-context.md` 檔案，記錄專案的**願景、技術決策、邊界定義**。

此檔案是 sprint-status.yaml 和所有後續規劃的參考基準。

---

## 需求明細

### 1. 願景與目標（核心）
```markdown
## 願景

結合 Control Tower 與 BMad-Method 優化 AI 協作開發流程與多終端交互體驗

### 核心問題
- [簡述用戶痛點：如何用更高效的語音 + 文字混合輸入方式改善終端操作]
- [簡述差異化定位：相比上游 better-agent-terminal 的優勢是什麼]

### 解決方案
- [Voice-first Terminal：語音優先但不排斥鍵盤]
- [AI 輔助工作流：結合 Control Tower 工單系統 + BMad-Method]
- [跨平台支援：Windows/macOS/Linux 統一體驗]
```

### 2. 技術棧與架構決策
```markdown
## 技術棧

| 層 | 技術 | 版本 | 決策原因 |
|----|------|------|--------|
| 運行時 | Electron | 最新穩定版 | 跨平台桌面應用 |
| 渲染層 | React 18 | 18.x | 組件化 UI，易於擴展 |
| 後端 | Node.js | 最新 LTS | Electron 內建 |
| CLI 框架 | oclif / Commander | [選一個] | 命令行體驗 |
| 語音辨識 | Whisper | CPU/GPU 加速 | 離線支援，隱私優先 |
| 終端模擬 | xterm.js | 最新 | VT100 相容 |

## 主要架構決策

- **D001**：聲音與終端 PTY 分離（T0093 確認）
- **D026**：獨立版號系統（v1.0.0 起）
- **D028**：[新增] BUG/PLAN/Decision 文件分類系統
```

### 3. 邊界定義（支援 vs. 不支援）
```markdown
## 平台支援政策

| 平台 | 優先級 | 支援狀態 | 備註 |
|------|--------|--------|------|
| Windows (x64) | 🔴 優先 | ✅ 全面支援 | 開發者主用 |
| macOS (Intel/Apple Silicon) | 🟡 次要 | ✅ 全面支援 | 大部分用戶 |
| Linux (包含 WSL/Docker) | 🟢 可選 | ✅ 基本支援 | 社群貢獻主導 |

## 功能邊界

### 已支援
- 語音輸入（Whisper CPU/GPU）
- 多工管理區
- 右鍵選單
- VS Code 整合開啟

### 暫未支援
- 語音輸出/TTS
- 遠端 SSH 終端（Phase 2 計畫）
- 自訂終端主題 API（待設計）

### 不支援
- 遠端終端伺服器模式（僅本地支援）
- 非標準 shell（僅支援 bash/zsh/powershell）
```

### 4. 里程碑規劃（引用）
```markdown
## 里程碑與相關工單

- **Phase 1 — Voice Input** ✅ T0001~T0062（實作完成）
  - 語音辨識、工作流 UI、工單管理
  
- **Phase 2 — Terminal Architecture** [規劃中]
  - Terminal Server 獨立進程（T0097+ 評估）
  - PTY 生命週期管理
  
- **Phase 3+ — [待定]**
  - 參考 `_backlog.md` PLAN-001~008
```

---

## 執行步驟

1. ✅ 複製上述範本到 `project-context.md`
2. ✅ 填入具體決策內容（特別是「核心問題」、「解決方案」、「主要決策」）
3. ✅ 對標現有檔案：
   - 參考 `_decision-log.md`（D001~D028）
   - 參考 `_local-rules.md`（開發流程規範）
4. ✅ 驗證無誤，commit

---

## 參考資料

- 上游專案：[tony1223/better-agent-terminal](https://github.com/tony1223/better-agent-terminal)
- 決策日誌：[_decision-log.md](_decision-log.md)
- 本地規則：[_local-rules.md](_local-rules.md)
- 工單統計：已完成 97 張（T0001~T0096）

---

## 工單回報區

**執行人**：Claude  
**開始時間**：2026-04-13 17:09  
**完成時間**：2026-04-13 17:11  

### 完成成果
- [x] project-context.md 已產生（135 行）
- [x] 願景與目標已填寫（核心問題 + 解決方案）
- [x] 技術棧與決策已記錄（D001/D025/D026/D027/D028/D029）
- [x] 邊界定義已確認（支援/不支援/不支援列表）
- [x] 里程碑規劃與相關文件連結已建立

### 遇到的問題
無。參考資料完整（decision-log + local-rules + tower-state + package.json）。

### 學習記錄
- `_decision-log.md` 整理完善，可直接作為 project-context 的決策來源
- sprint-status.yaml 已有 T0097 的 TODO 記錄，需一併更新狀態

---

## 下一步

完成後，塔台會自動同步 sprint-status.yaml 的內容參考。
