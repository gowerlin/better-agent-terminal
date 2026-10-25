---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-10-25-ct-public-release
title: 回覆 BMad-Guide 塔台：CT 正式公開，BAT 站 5 處已改成取得方式並上線
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-10-25-ct-public-release
status: ACKNOWLEDGED
local_workorder: T0700
created_at: "2026-10-25T09:07:38+0800"
---

# 回覆：CT 正式公開，BAT 站「目前未公開提供」已更新

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> 受理，DELEGATE 工單 T0700（`coordination.source.workorder: _handover-2026-10-25-ct-public-release`），已完成並上線。決策是 BAT D183（改寫 D182 / D159）。

## 方針（D183，使用者決定）

- BAT 站可以寫「Control Tower 已經公開，採 MIT 授權」，以及取得、下載、公開、開源等字樣；「去哪取得」連到 CT Portal 安裝頁。
- BAT 站**仍不寫** CT 版本號、skill 名稱、指令名稱、CT 文件名、安裝 / 升級步驟、CT 資料存放路徑、GitHub Release 直連網址。取得細節只放在 Portal，CT 改版時 BAT 站不必跟著改。
- D182 的「CT skill 仍不開源」「BAT 站不寫取得方式」「連結文字不得寫『下載』『開源』」三項取消。

## 改了什麼（5 處全部完成）

| 位置 | 改成 |
|---|---|
| `site/control-tower.md` 開頭說明框、`site/control-tower-tour.md` 開頭說明框 | 標題「怎麼取得 Control Tower」：「Control Tower 已經公開，採 MIT 授權。取得與安裝方式見〈Control Tower 安裝頁〉，設計理念與使用說明見〈Control Tower 站〉。」整合點那句保留 |
| `site/control-tower.md`、`site/control-tower-tour.md`、`site/faq.md` 的「Control Tower 去哪取得？」 | 「Control Tower 已經公開，採 MIT 授權。取得與安裝方式見〈Control Tower 安裝頁〉。想接上自己的流程，BAT 的派工、回報、提問與查詢介面也是公開的，見〈BAT 提供的整合點〉。」 |

- **網址只寫一處**：`site/.vitepress/config.mts` 由既有的 `CT_PORTAL_URL` 組出 `CT_INSTALL_URL`（`CT_PORTAL_URL + 'install'`）；內文用 `CtPortalLink to="install"`。
- **其他同義說法**：BAT 站沒有其他「未公開」「不開源」「私下申請」之類關於 CT 的說法（首頁、`/cases`、`/compatibility` 都沒有）。
- **前提更正**：無。HANDOVER 列的 5 處位置與內容都正確。

## 驗證

- `site/` build 0 錯誤、0 死連結；375px 的 `/control-tower`、`/control-tower-tour`、`/faq` 都沒有橫捲（`scrollWidth` = 375）
- 安裝頁 `https://gowerlin.github.io/Control-Tower/install` → HTTP 200
- 使用者預覽同意後 push（`b2a46612..93ed8135`），2026-10-25 Pages run `40149342854`：build / link-check（1313 / 1313）/ deploy 都通過；線上 `/faq`、`/control-tower` 已經是安裝頁連結，「未公開」0 筆

## 證據

- BAT 工單 T0700 回報區（`_ct-workorders/T0700-delegate-ct-public-release.md`），commit `86832607`（網站）、`93ed8135`（回報）
- BAT 決策 D183（`_ct-workorders/_decision-log.md`）
