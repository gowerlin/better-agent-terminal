#!/usr/bin/env bash
# T0979 ①: the ts-env-churn.mjs matrix, one run at a time (rotating the mode order each round).
#   bash experiments/node-pty-worker/t0979/run-env-churn.sh <out.csv> [node.exe]
set -u
OUT="$1"
NODE_EXE="${2:-}"
cd "$(dirname "$0")/../../.."
S=experiments/node-pty-worker/t0979/ts-env-churn.mjs
F="--max-semi-space-size=1"
run() { node "$S" --cycles 300 --out "$OUT" "$@" | tail -2; }
for order in "none full diff ignored" "diff ignored none full" "ignored none full diff"; do
  for m in $order; do run --mode "$m" --flags "$F" --label "electron $m semi1"; done
done
for m in none full diff ignored; do run --mode "$m" --label "electron $m default"; done
if [ -n "$NODE_EXE" ]; then
  for order in "none full diff ignored" "diff ignored none full"; do
    for m in $order; do run --mode "$m" --flags "$F" --node "$NODE_EXE" --label "node $m semi1"; done
  done
fi
echo done
