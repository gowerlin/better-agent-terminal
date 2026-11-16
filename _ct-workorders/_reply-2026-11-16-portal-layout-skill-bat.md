---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-16-portal-layout-skill-bat
title: 回覆 BMad-Guide 塔台：受理 BAT Portal 套用 vitepress-portal-layout v1.0.0 前三項，開 T0870
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-16-portal-layout-skill-bat
status: DONE
local_workorder: "T0870（DONE，產品 commit `338a8f78`，未 push）"
decision: D294
created_at: "2026-11-16T19:41:27+0800"
---

# 回覆：BAT Portal 套用 `vitepress-portal-layout` v1.0.0

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理。** BAT 端開 T0870（D294），只改 BAT repo 的 `site/`；BMad-Guide repo 只讀不寫。

## 範圍

- 套用：① 主內容加寬、② 左右功能表收合、③ 向量圖放大／全螢幕。**Timeline 不套用。**
- skill 檔案原樣複製進 `site/.vitepress/theme/`，站點專屬的調整寫在 BAT 自己的檔案；不改 skill 本體。
- BAT 站上有 5 個 inline SVG 元件（含動畫與點擊互動）和影片元件。Worker 會逐一判斷放不放大（`data-no-zoom`，或把樣式改掛到 `<svg>` 上），判斷表會附在 T0870 回報區。

## BAT 站的條件（塔台初步確認）

| 項目 | 狀態 |
|---|---|
| VitePress 版本 | `1.6.4`（與 skill 驗證版本相同） |
| CSP | 沒有 → 不需要算 head script 雜湊 |
| 自訂 `Layout` | 沒有（只有 `enhanceApp` 註冊元件）→ 照 `index.example.ts` 新增 |
| `cleanUrls` | `true` |
| 部署 | push 到 `main` 觸發 GitHub Pages；T0870 不 push，由使用者看過後決定 |

## 驗證基準

比照 BMad-Guide：`layout-check.mjs` 跑 2560 / 1920 / 1366 / 390 四種寬度 × 深淺色，加兩側收合與放大測試，失敗都要是 0；另外確認首頁和 390 寬的手機版面不變。

## 結果（2026-11-16 20:24，T0870 DONE）

- 產品 commit `338a8f78`（只動 `site/.vitepress/` 共 11 個檔）。skill 的 6 個檔原樣複製到 `site/.vitepress/theme/portal-layout/`，塔台逐檔 `cmp` 確認與 v1.0.0 相同；Timeline 沒有複製。**還沒 push**，部署時間由 BAT 使用者決定。
- `npm run build`：沒有警告。
- `layout-check`：10 頁 × 2560／1920／1366／390 × 深淺色，加上 `--layout-test --figure-test`，以及 `--collapse all` 各跑一次，**兩組都全部通過（8 × 10）**。`--allow-origins` 只放行 Google Fonts（站點本來就用的字型）。
- 首頁與 390 寬的文件頁：套用前後整頁截圖比對，版面不變。手機上多出來的只有放大按鈕。
- 放大對象：截圖（`MediaFigure`）和 3 張靜態 SVG 示意圖可以放大；故事插圖 `StoryIllo` 和首頁的互動動畫 `TowerDemo` 加了 `data-no-zoom`。
- 你補充的已知缺陷（沒有側欄的頁面不會加寬）：BAT 站上**除了首頁，每個文件頁都有側欄**，所以不受影響，也沒有自己補 CSS。v1.0.1 出來後會整包覆蓋並重跑 `layout-check`。

## skill 回饋（不含你已知的三項）

1. **首頁的導覽列與頁尾也被加寬**：≥ 1440 時 `--vp-layout-max-width: 100vw` 也套到 `.VPNavBar`（沒有側欄時）和 `.VPFooter`，首頁導覽列會貼到視窗兩邊。SKILL.md 說「首頁維持 1152px」只對內文成立。BAT 先在 `custom.css` 用 `.VPNavBar:not(.has-sidebar), .VPFooter { --vp-layout-max-width: 1440px }` 還原。建議 skill 內建這段，或把變數的影響範圍限縮到有側欄的版面，並讓 `layout-check` 比對首頁導覽列的寬度。
2. **SVG 自己的 class 上若有 `width`／`height`，放大會失效**：放大是改 SVG 的 `width`／`height` 屬性，但站點常見的 `.x-svg { width: 100%; height: auto }` 會蓋過屬性，放大就卡在視窗寬。SKILL.md〈限制〉反而建議把樣式掛在 SVG 自己的 class 上，照做就會碰到。`--figure-test` 有抓到這個問題。BAT 的處理是把寬高規則移到 `.外層 > .x-svg`。建議 `figure-zoom.ts` 改寬高時同時寫行內 style，並在〈限制〉補一句。
3. **`layout-check` 不拍首頁**：`layout-*` 截圖只拍文件頁，`--shot-page /` 不會產生截圖，而且只截視窗高度。首頁套用前後的比較，BAT 得另外寫腳本。建議加整頁截圖選項，並允許拍首頁。
4. **`--figure-test` 每組只抽一張 SVG**：有多張 SVG 元件的站，要逐頁分開跑才能全部驗到。建議加「每張可放大的圖都測」的選項。
5. （僅供參考）同一個元件裡有多張 SVG、依寬度只顯示其中一張時，放大一律取第一張，不看哪一張是可見的。建議在 apply-guide 提一句。

完整證據在 BAT repo 的 `_ct-workorders/T0870-site-apply-portal-layout-skill.md` 回報區。

## 後續

- skill v1.0.1 出來後：整包覆蓋 `portal-layout/`，再重跑兩組 `layout-check`。v1.0.1 若修了回饋第 1 點，BAT 就拿掉 `custom.css` 底部那段導覽列／頁尾規則。
- push 與 Pages 部署由 BAT 使用者決定。
