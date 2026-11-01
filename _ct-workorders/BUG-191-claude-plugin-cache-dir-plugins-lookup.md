---
schema_version: 1
schema_kind: bug
id: BUG-191
title: "設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時，BAT 仍在 `<config>/plugins/installed_plugins.json` 找 plugins：CT plugin 偵測與面板 plugins 清單漏掉"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T05:26:29+0800"
fixed_at: "2026-11-02T03:17:19+0800"
closed_at: "2026-11-02T05:26:29+0800"
fix_commit: eb5c0589
impact:
  - claude-config-dir
  - ct-plugin-detect
links:
  discovered_in: "T0730 回報區〈發現的問題 / 後續候選〉1（2026-11-01）"
  related: [T0760, T0730, T0710, BUG-178]
---
# BUG-191 — 設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時，BAT 仍在 `<config>/plugins/installed_plugins.json` 找 plugins：CT plugin 偵測與面板 plugins 清單漏掉

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響設了該變數的使用者） |
| 可重現 | 待 T0760 以 CLI 2.1.316 實測確認 |
| **狀態** | 🚫 CLOSED（T0760 `eb5c0589`；交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0772 PASS，真的 CT plugin） |
| 回報者 | T0730 Worker |

## 現象

- CT `data-layer-architecture.md` 記載：設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時整個 plugins 目錄（含 `installed_plugins.json`）都在那裡（CT T0357 / T0374 實測）。
- BAT 的 `findClaudeCtPlugins`（`electron/ct-install-detect.ts`）與面板 plugins 清單都在 `<config>/plugins/installed_plugins.json` 找，只有 cache 根目錄跟著該變數。
- 預期：與 CLI 實際行為一致（以內嵌 CLI 2.1.316 實測為準）。

## 修正（T0760 `eb5c0589`，2026-11-02T03:17:19+0800）

- 實測（內嵌 CLI 2.1.316，本機假 marketplace，11 個情境）：設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時 `installed_plugins.json` / `known_marketplaces.json` / plugin 內容都在該目錄（與 CT `data-layer-architecture.md` 一致），`settings.json` 不跟著移；`~` 會展開、相對路徑以 CLI cwd 為準、全空白等同未設。BAT 舊行為只把 `cache/` 移過去，可重現。
- 修正：唯一實作 `resolveClaudePluginsDir`（`electron/claude-config-dir.ts`）；`findClaudeCtPlugins`（連帶 `claudeCtPluginSkillDirs` / `ctPluginTowerConfigCandidates` / `detectCtInstalls`）與面板 plugins 清單（`panelClaudePluginsDir`）都經它；不設變數時路徑完全不變。
- 驗證：單元 114 項＋2 項突變、以實測產出的真實檔案跑 `findClaudeCtPlugins` 5 / 5；typecheck 0 / 0、`test:unit` 6588 / 369 files、`vite build`（匯出目錄）。
- 已知差異（未改）：Cowork 模式（`CLAUDE_CODE_USE_COWORK_PLUGINS=1`）用 `cowork_plugins` / `cowork_settings.json`；沒有 cwd 的呼叫端以 BAT 程序 cwd 解析相對路徑。
- 待實機驗收：設 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 並以 plugin 安裝 CT，BAT 的 skill 面板 / ct-config 預設層認得。

## 驗收（2026-11-02T05:26:29+0800，第一百零四 session）

- 依據（R-G003）：交付版 `v0.7.3-pre.4` 安裝版（`BAT_E2E_EXECUTABLE`，隔離實例）自動化實測 T0772 情境 ②（`366b96b0` / 回報 `04d57a8f`，D215）。以安裝版內嵌 CLI 2.1.316 從公開 marketplace `gowerlin/Control-Tower` 安裝 `ct@control-tower` 5.15.0（暫存設定目錄 / cache 目錄，不動使用者 `~/.claude`）：
  - `installed_plugins.json` 在 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 下，`<設定目錄>/plugins` 沒有。
  - BAT 設同一組 env → `claude:scan-skills` 列出 plugin 的 8 個 skill、`*` 補全 7 個、`ct:read-config-sources` 的 `installs.claude.plugin` = 5.15.0。
  - 對照：不設 cache 變數時路徑不變（`<設定目錄>/plugins`）。
- 未涵蓋：只裝 plugin（沒有手動安裝）時總覽預設值層顯示 plugin 的 `tower-config.md`：測試機有手動安裝的 Codex CT，依 T0710 3-2 讀手動那份；邏輯由 `electron/__tests__/ct-config-sources.test.ts` 涵蓋。
