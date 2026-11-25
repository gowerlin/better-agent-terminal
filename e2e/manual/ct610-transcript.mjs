// T0915: renders a Claude Code session transcript (`<CLAUDE_CONFIG_DIR>/projects/<project>/<session>.jsonl`)
// as plain text: user prompts, assistant text, tool calls (Bash commands in full) and tool results.
// Used for the acceptance attachments `tower-output.txt` / `set-role.txt`; BAT capability tokens are masked.
//
//   node e2e/manual/ct610-transcript.mjs <session.jsonl> <out.txt> [--grep <regex>]
//
// `--grep`: only the tool calls whose command matches <regex>, each with its result (e.g. `--set-role`).

import fs from 'node:fs'

const [file, out, flag, pattern] = process.argv.slice(2)
if (!file || !out || (flag !== undefined && (flag !== '--grep' || !pattern))) {
  console.error('usage: node e2e/manual/ct610-transcript.mjs <session.jsonl> <out.txt> [--grep <regex>]')
  process.exit(2)
}
const grep = pattern ? new RegExp(pattern) : null
const mask = s => String(s)
  .replace(/batcap\.[A-Za-z0-9._~+/=-]+/g, 'batcap.<masked>')
  .replace(/(BAT_REMOTE_TOKEN\s*[=:]\s*)\S+/g, '$1<已設定>')

const text = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => p?.type === 'text' ? p.text : '').join('') : ''
const lines = []
const pending = new Map() // tool_use id → index in lines (grep mode)
for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!raw.trim()) continue
  let rec
  try { rec = JSON.parse(raw) } catch { continue }
  const ts = rec.timestamp ?? ''
  const msg = rec.message
  if (!msg || (rec.type !== 'user' && rec.type !== 'assistant')) continue
  const parts = typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : (msg.content ?? [])
  for (const p of parts) {
    if (p.type === 'text' && !grep) {
      lines.push(`── ${rec.type === 'user' ? 'USER' : 'ASSISTANT'} ${ts}\n${p.text}`)
    } else if (p.type === 'tool_use') {
      const input = p.input ?? {}
      const body = input.command ?? JSON.stringify(input).slice(0, 2000)
      if (grep && !grep.test(String(body))) continue
      pending.set(p.id, true)
      lines.push(`── TOOL ${p.name} ${ts}\n${body}${input.description ? `\n(description: ${input.description})` : ''}`)
    } else if (p.type === 'tool_result') {
      if (grep && !pending.has(p.tool_use_id)) continue
      const result = text(p.content)
      lines.push(`── RESULT${p.is_error ? ' (error)' : ''} ${ts}\n${result.length > 6000 ? `${result.slice(0, 6000)}\n…(${result.length} chars)` : result}`)
    }
  }
}
fs.writeFileSync(out, `${mask(lines.join('\n\n'))}\n`, 'utf8')
console.log(`${out}: ${lines.length} blocks`)
