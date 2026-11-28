# CT 6.4.0-pre.2 `_tower-state.md` key order fixture (T0971)

🔴 **Made by BAT, not a CT example.** CT 6.4.0-pre.2 (CT T0585, R1) moves the top-level `menu_open`
from after `updated_at` to right after `awaiting_user` (before `user_actions` and `reminders`). This
file was written in BAT (T0971, B-1) from that description, so that BAT's reading is tested before
CT's own example exists. When CT publishes its 6.4.0-pre.2 examples, copy them into a directory of
their own (as `../ct-tower-state-v640/` does for 6.4.0-pre.1) and keep this one or drop it.

| File | What it shows |
|---|---|
| `tower-state-v642-menu-after-awaiting.md` | `menu_open` between `awaiting_user` and `user_actions`; `user_actions` and `reminders` after it |

Read by `src/lib/__tests__/tower-inbox-menu-open-t0971.test.ts`. The text is made up (no real
project data).
