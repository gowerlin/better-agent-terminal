{
  # BUG-213 / T0866 (D291): Windows-only N-API addon. Built by `npm run build:native-win`
  # (scripts/build-native-win.mjs), never by an install script; no prebuilt .node is committed.
  "targets": [
    {
      "target_name": "bat_win_stdio_inherit",
      "sources": ["src/win_stdio_inherit.c"],
      "defines": ["NAPI_VERSION=8", "WIN32_LEAN_AND_MEAN", "UNICODE", "_UNICODE"],
      "conditions": [
        ["OS!='win'", { "type": "none", "sources!": ["src/win_stdio_inherit.c"] }]
      ]
    }
  ]
}
