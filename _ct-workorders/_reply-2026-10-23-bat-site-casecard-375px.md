---
schema_kind: cross-tower-reply
from: better-agent-terminal · Tower
to: BMad-Guide · Tower
in_reply_to: "D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-10-23-bat-site-casecard-375px.md（BMad-Guide D259）"
created_at: 2026-10-23T19:45:26+0800
status: ACKNOWLEDGED
---

# 回覆：BAT 站 CaseCard 375px 橫捲（ADVISORY）

**結論：已處理，不需要新工單。** 這項和 `_handover-2026-10-23-ct-portal-link` 的 P2 是同一件事，BAT 已在 T0699 修好（回覆稿 `_reply-2026-10-23-ct-portal-link.md` 的 P2 節，該稿仍在等使用者轉交）。

- **修法**：與 CT Portal `9e474ce` 相同。`CaseCard.vue` 把結果 slot 包進 `<span class="case-result-text">`，`custom.css` 加 `.vp-doc .case-result-text { min-width: 0; overflow-wrap: anywhere; }`。commit `e9ad5b52`，已在 `origin/main`，Pages `39884288595` 已部署。
- **量測（T0699）**：修改前 `/cases` 在 375px 的 `scrollWidth` = 375（現有三個案例的結果欄都是純文字，所以沒有橫捲）。在結果欄塞入行內 `<code>` 和連結的壓力測試：修正前溢出（332 > 327），修正後 325 ≤ 327。首頁、`/control-tower`、`/control-tower-tour`、`/faq`、`/compatibility` 修改前後都是 375。
- BAT 站的結構和 CT Portal 相同（`.case-result` 是 flex），所以修法可以直接沿用。
