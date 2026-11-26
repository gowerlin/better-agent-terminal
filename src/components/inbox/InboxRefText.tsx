/**
 * T0930: an Inbox text (summary / title) or tag with its existing file references as links. A click
 * opens the file in the main area's「檔案」tab and reveals it in the file tree through the existing
 * `openFileInFilesTab` (BUG-048 / T0213) — no new event, IPC or external editor.
 *
 * 🔴 Text nodes and elements only (never HTML); the text shown is exactly the original. References
 * not in `links` (not found, outside the workspace, URLs, not checked yet) stay plain text.
 */
import { openFileInFilesTab } from '../../state/openFileInFilesTab'
import { fileRefKey, parseCtId, splitFileRefs, type ResolvedRef } from '../../lib/inbox-file-refs'
import type { InboxRefLinks } from './useInboxFileRefs'

function RefLink({ text, target, className }: { text: string; target: ResolvedRef; className: string }) {
  return (
    <button
      type="button"
      className={className}
      title={target.rel}
      data-inbox-file-ref={target.rel}
      onClick={e => {
        e.stopPropagation()
        openFileInFilesTab(target.abs)
      }}
    >
      {text}
    </button>
  )
}

/** `text` with its found references as links. */
export function InboxRefText({ text, links }: { text: string; links: InboxRefLinks }) {
  if (links.size === 0) return <>{text}</>
  return (
    <>
      {splitFileRefs(text).map((part, index) => {
        const target = part.kind === 'ref' ? links.get(fileRefKey(part.ref)) : undefined
        return target
          ? <RefLink key={index} text={part.text} target={target} className="inbox-file-link" />
          : part.text
      })}
    </>
  )
}

/** The head line's `workorder` / `ref` tag (`.inbox-item-source`): a link when it is a found CT id. */
export function InboxRefTag({ value, links }: { value: string; links: InboxRefLinks }) {
  const id = parseCtId(value)
  const target = id ? links.get(fileRefKey({ kind: 'id', ...id })) : undefined
  if (!target) return <span className="inbox-item-source">{value}</span>
  return <RefLink text={value} target={target} className="inbox-item-source inbox-file-tag" />
}
