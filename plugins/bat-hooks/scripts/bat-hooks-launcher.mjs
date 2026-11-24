#!/usr/bin/env node
// plugins/bat-hooks/scripts/bat-hooks-launcher.mjs
// PLAN-068 W9 / T0910 (T0902 §7.3, R12): the launcher of the `bat-hooks` Claude Code plugin.
//
// Claude Code runs it for every hook in ../hooks/hooks.json as
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/bat-hooks-launcher.mjs" <event>
// It runs nothing of its own: it runs the hook script of the BAT that owns this terminal,
// `$BAT_HELPER_DIR/bat-hook.mjs` (the PTY env BAT sets), as `bat-hook.mjs <event> --hook-list <n>`, so
// the code is always that BAT's own version (a remote tab runs the remote bat-server's copy). Only this
// plugin's event list can be older than the BAT: `--hook-list` tells BAT which list ran
// (→ `plugin-outdated`).
//
// Trust model: the path comes from the env of the claude process. Whoever can set that env already
// controls what this process runs (as with PATH). The launcher still only runs a file named exactly
// `bat-hook.mjs`, in an absolute `BAT_HELPER_DIR`, when that file exists, and only inside a BAT tab
// (`BAT_REMOTE_PORT`, `BAT_REMOTE_TOKEN`, `BAT_TERMINAL_ID` all set). No argument, path or token is
// taken from anywhere else; nothing is written, logged or printed by the launcher.
//
// 🔴 The rules of BAT's hooks (T0590) apply here: exit 0 always, nothing on stdout or stderr, done
// within LAUNCHER_DEADLINE_MS, silent on any failure. Outside BAT (no `BAT_*` env, or BAT uninstalled)
// it exits 0 at once.
//
// Node: this file runs with the `node` on PATH. `bat-hook.mjs` runs in this same process, unless the tab
// names another node (`BAT_HELPER_NODE`, e.g. a remote bat-server's bundled node): then that one runs it.
// Zero dependencies — Node.js built-in modules only. Windows (Git Bash / PowerShell), macOS and Linux.

import { spawn } from 'node:child_process'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The version of this plugin's event list (hooks.json). Equal to BAT's `BAT_HOOK_SET` when the list matches. */
export const PLUGIN_HOOK_LIST = 2
/** The only script the launcher runs. */
export const BAT_HOOK_SCRIPT = 'bat-hook.mjs'
/** Hard end of the launcher (bat-hook.mjs ends within 1.8 s itself; claude's timeout is 5 s). */
export const LAUNCHER_DEADLINE_MS = 2500
/** The events bat-hook.mjs knows (hooks.json uses these). */
export const LAUNCHER_EVENTS = ['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'post-tool-batch', 'user-prompt-submit', 'stop', 'session-start']
const REQUIRED_ENV = ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID']

function isFile(file) {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

/**
 * What to run for `event` under `env`, or null = exit 0 and do nothing: `{ script, args, node? }`
 * (`node` = a `BAT_HELPER_NODE` other than this process's executable). Never throws.
 */
export function resolveLaunch(event, env = process.env, execPath = process.execPath) {
  try {
    if (!LAUNCHER_EVENTS.includes(event)) return null
    for (const name of REQUIRED_ENV) if (!env[name]) return null
    const dir = env.BAT_HELPER_DIR
    if (typeof dir !== 'string' || !dir || dir.includes('\0') || !isAbsolute(dir)) return null
    const script = join(dir, BAT_HOOK_SCRIPT)
    if (!isFile(script)) return null
    const args = [event, '--hook-list', String(PLUGIN_HOOK_LIST)]
    const node = env.BAT_HELPER_NODE
    if (typeof node === 'string' && node && !node.includes('\0') && isAbsolute(node) && existsSync(node) && resolve(node) !== resolve(execPath)) {
      return { script, args, node }
    }
    return { script, args }
  } catch {
    return null
  }
}

/** Runs `launch` in another node (stdin passed on, stdout / stderr dropped); resolves when it ends. */
function runInNode(launch) {
  return new Promise((done) => {
    try {
      const child = spawn(launch.node, [launch.script, ...launch.args], { stdio: ['inherit', 'ignore', 'ignore'], windowsHide: true })
      child.on('error', () => done())
      child.on('exit', () => done())
    } catch {
      done()
    }
  })
}

/** Runs bat-hook.mjs in this process: it sees itself as the entry script and runs its own main(). */
async function runHere(launch) {
  process.argv = [process.argv[0], launch.script, ...launch.args]
  await import(pathToFileURL(launch.script).href)
}

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    const self = realpathSync(fileURLToPath(import.meta.url))
    const entry = realpathSync(resolve(process.argv[1]))
    return process.platform === 'win32' ? self.toLowerCase() === entry.toLowerCase() : self === entry
  } catch {
    return false
  }
}

if (isMainModule()) {
  const deadline = setTimeout(() => process.exit(0), LAUNCHER_DEADLINE_MS)
  process.on('uncaughtException', () => process.exit(0))
  process.on('unhandledRejection', () => process.exit(0))
  const launch = resolveLaunch(process.argv[2])
  if (!launch) process.exit(0)
  if (launch.node) {
    runInNode(launch).finally(() => process.exit(0))
  } else {
    // bat-hook.mjs ends the process itself (exit 0); the deadline stays as a backstop
    runHere(launch).catch(() => process.exit(0))
  }
  void deadline
}
