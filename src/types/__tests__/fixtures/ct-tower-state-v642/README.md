# CT 6.4.0-pre.2 `_tower-state.md` key order fixtures (T0971, T0974)

CT 6.4.0-pre.2 (CT T0585, R1) moves the top-level `menu_open` from after `updated_at` to right after
`awaiting_user` (before `user_actions` and `reminders`). Two files, one from each side:

| File | Source | What it shows |
|---|---|---|
| `tower-state-v642-menu-after-awaiting.md` | 🔴 **Made by BAT, not a CT example** (T0971, B-1), written from CT's description before CT's own example existed | `menu_open` between `awaiting_user` and `user_actions`; `user_actions` and `reminders` after it |
| `tower-state-v642.md` | CT's own example (T0974), copied byte for byte from CT commit `71b8406`, `BMad-Control-Tower-v6.4.0-pre.2/skills/control-tower/scripts/tests/fixtures/frontmatter/good/tower-state-v642.md` (`cmp` identical; SHA-256 `c6042e3525316171a67d687239f118edca77a0e80f1d7836658925fd55325648`) | `awaiting_user` U-57, U-59 (5 options), U-60 (free answer), U-61 → `menu_open.ids` `["U-61"]` → `user_actions` A-2 → `reminders` |

Read by `src/lib/__tests__/tower-inbox-menu-open-t0971.test.ts` (BAT's file) and
`src/lib/__tests__/tower-state-ct642-fixtures-t0974.test.ts` (CT's file). Do not edit CT's file: replace it
with a new copy from CT when CT changes it. The text is made up (no real project data).
