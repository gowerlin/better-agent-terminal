# CT 6.4.0-pre.1 `_tower-state.md` fixtures (T0968)

Copies of the four `tower-state-v640*.md` examples from BMad Control Tower
`skills/control-tower/scripts/tests/fixtures/frontmatter/good/` at CT commit `7fee085`
(CT 6.4.0-pre.1, PLAN-022 / T0582), byte for byte. The source note lives here and not at the top
of each file, because a line before `---` would no longer be a frontmatter.

| File | What it shows |
|---|---|
| `tower-state-v640.md` | `inbox_features` with `menu`; `menu_open` block map, flow `ids` (`U-57`, `U-58`) |
| `tower-state-v640-flow.md` | `menu_open` as one flow mapping (`{ ids: ["U-58"], opened_at: … }`) |
| `tower-state-v640-block-list.md` | `menu_open.ids` as a block list (`U-58`, `U-57`) |
| `tower-state-v640-menu-ignored.md` | `menu_open` without `menu` in `inbox_features` — readers ignore it (`v2-menu-open-ignored`) |

Read by `src/lib/__tests__/tower-inbox-menu-open-t0968.test.ts`. Do not edit them here; when CT
changes the examples, copy them again and update the commit above.
