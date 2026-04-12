# 工單 T0052-settings-dialog-tabs

## 元資料
- **工單編號**：T0052
- **任務名稱**：設定 Dialog 內置 Tabs 分群重構
- **狀態**：DONE
- **建立時間**：2026-04-12 17:33 (UTC+8)
- **開始時間**：2026-04-12 17:36 (UTC+8)
- **完成時間**：2026-04-12 17:43 (UTC+8)

## 工作量預估
- **預估規模**：中（UI 重構，不改設定邏輯）
- **Context Window 風險**：中（SettingsPanel.tsx 1057 行）
- **降級策略**：若元件拆分太複雜，先只加 Tab 切換，不拆檔案

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：SettingsPanel.tsx 1057 行，需要完整理解結構

## 任務指令

### 背景

目前設定 Dialog 是一個長卷軸，10 個 settings-section 全部垂直排列，使用者需要大量捲動。改為內置 Tabs 頁籤，依功能性質分群。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）
- 讀取 `src/components/SettingsPanel.tsx`（1057 行）

### 現有 Section 結構（塔台已盤點）

| # | Section | 行號 | 內容 |
|---|---------|------|------|
| 1 | Language | 266 | 介面語言選擇 |
| 2 | Shell | 285 | Shell 類型、Agent preset、CLI agents 自訂、各種 agent 行為開關 |
| 3 | Window Behavior | 472 | 最小化到 tray、DevTools |
| 4 | Notifications | 498 | 更新檢查、dock badge、完成通知 |
| 5 | Appearance | 556 | 字體、色彩主題、字型大小 |
| 6 | Statusline | 691 | 狀態列 13 項可配置項目 |
| 7 | VoiceSettingsSection | 829 | 語音模型管理、辨識語言（獨立元件） |
| 8 | Debug Logging | 831 | Log level、開啟 log 目錄、清理 |
| 9 | Environment Variables | 886 | 環境變數編輯 |
| 10 | Remote Access | 898 | 遠端存取設定 |

### 建議 Tab 分群

| Tab 名稱 | i18n key 建議 | 包含 section | 說明 |
|----------|--------------|-------------|------|
| **一般** | `settings.tab.general` | Language, Shell/Agent, Window Behavior, Notifications | 應用程式層級設定 |
| **外觀** | `settings.tab.appearance` | Appearance, Statusline | 視覺/UI 相關 |
| **語音** | `settings.tab.voice` | VoiceSettingsSection | 語音辨識相關 |
| **進階** | `settings.tab.advanced` | Debug Logging, Environment Variables, Remote Access | 開發者/進階設定 |

> ⚠️ 此分群為建議，worker 實作時可依實際狀況微調。如果某個 Tab 內容太少或太多，可自行平衡。

### 實作指引

#### 1. Tab 元件

在 `settings-content` 內部加入 Tab 切換 UI：

```tsx
const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'voice' | 'advanced'>('general')

// Tab bar
<div className="settings-tabs">
  <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>
    {t('settings.tab.general')}
  </button>
  <button className={activeTab === 'appearance' ? 'active' : ''} onClick={() => setActiveTab('appearance')}>
    {t('settings.tab.appearance')}
  </button>
  <button className={activeTab === 'voice' ? 'active' : ''} onClick={() => setActiveTab('voice')}>
    {t('settings.tab.voice')}
  </button>
  <button className={activeTab === 'advanced' ? 'active' : ''} onClick={() => setActiveTab('advanced')}>
    {t('settings.tab.advanced')}
  </button>
</div>

// Tab content
{activeTab === 'general' && (
  <>
    {/* Language, Shell, Window, Notifications sections */}
  </>
)}
{activeTab === 'appearance' && (
  <>
    {/* Appearance, Statusline sections */}
  </>
)}
// ... etc
```

#### 2. CSS 樣式

```css
.settings-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
}
.settings-tabs button {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.settings-tabs button.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-color);
}
```

#### 3. 注意事項

- **不要改設定邏輯**：只移動 JSX 到對應 Tab 區塊，所有 state/handler/effect 不動
- **i18n**：Tab 名稱加到翻譯檔（中/英）
- **記住選擇**：Tab 切換後不需記住上次選擇（每次開 dialog 預設「一般」即可）
- **無障礙**：Tab 按鈕加 `role="tab"`、`aria-selected`
- **現有 CSS**：`settings-section` 和 `settings-group` 的樣式保持不變

#### 4. 元件拆分（可選，非必要）

若 worker 判斷有利於維護，可將每個 Tab 的內容拆為獨立元件：
- `GeneralSettings.tsx`
- `AppearanceSettings.tsx`
- `VoiceSettings.tsx`（已有 `VoiceSettingsSection`）
- `AdvancedSettings.tsx`

但這不是必要的，如果只是用條件渲染分組，也完全可以接受。

### 預期產出
- 修改 `SettingsPanel.tsx`（主要）
- 修改 CSS 檔案（加 tab 樣式）
- 修改翻譯檔（加 tab 名稱）
- 可能新增元件檔案（可選）
- 1 個 atomic commit

### Commit 規範
```
refactor(settings): reorganize settings dialog with tabbed navigation
```

### 驗收條件
- [ ] 設定 dialog 有 4 個 Tab 頁籤
- [ ] 點擊各 Tab 只顯示對應 section（不需捲動看全部）
- [ ] 所有設定項目都在某個 Tab 中（沒有遺漏）
- [ ] 設定值修改後仍正常保存和生效
- [ ] 語音設定頁面功能正常（模型下載、語言選擇等）
- [ ] Tab 樣式與現有 UI 風格一致
- [ ] `npx vite build` 通過
- [ ] **手動切換各 Tab 確認無異常**（GP020）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
- `src/components/SettingsPanel.tsx` — 加入 activeTab state、Tab bar JSX、4 個 tab 條件渲染
- `src/styles/settings.css` — 新增 `.settings-tabs` 及 button 樣式
- `src/locales/en.json` — 加入 `settings.tab.*` keys
- `src/locales/zh-TW.json` — 加入繁體中文 tab 名稱
- `src/locales/zh-CN.json` — 加入簡體中文 tab 名稱
- commit: `290696b` — refactor(settings): reorganize settings dialog with tabbed navigation

### Tab 分群最終結果
| Tab | 包含 section |
|-----|-------------|
| 一般 (General) | Language, Shell/Agent, Window Behavior, Notifications |
| 外觀 (Appearance) | Appearance, Statusline |
| 語音 (Voice) | VoiceSettingsSection |
| 進階 (Advanced) | Debug Logging, Environment Variables, Remote Access |

### 遭遇問題
無

### 回報時間
2026-04-12 17:43 (UTC+8)
