/**
 * T0930: which file references of the shown Inbox items exist — the existence check behind the links
 * of `InboxRefText` / `InboxRefTag`.
 *
 * 🔴 Read-only and bounded: the existing `fs:stat` / `fs:readdir` (proxied to the window's host for a
 * remote workspace, same as `InboxDataSource`), only for the references of the items a list shows, at
 * most `INBOX_FILE_REF_MAX` distinct ones per list, each folder listed once per check. It runs when
 * the folder or the set of references changes (and on mount); never on a timer. Nothing is logged.
 * A failed check means "not found": the reference stays plain text.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  INBOX_FILE_REF_MAX,
  fileRefKey,
  matchIdFile,
  refLookups,
  splitFileRefs,
  joinRoot,
  parseCtId,
  type FileRef,
  type ResolvedRef,
} from '../../lib/inbox-file-refs'

/** A resolved reference by `fileRefKey`; a missing key = not (yet) found. */
export type InboxRefLinks = ReadonlyMap<string, ResolvedRef>

const EMPTY: InboxRefLinks = new Map()

/** The references of one item: its tag values (only CT ids) and its texts. */
export function itemFileRefs(tags: ReadonlyArray<string | undefined>, texts: ReadonlyArray<string | undefined>): FileRef[] {
  const refs: FileRef[] = []
  for (const tag of tags) {
    const id = tag ? parseCtId(tag) : null
    if (id) refs.push({ kind: 'id', ...id })
  }
  for (const text of texts) {
    if (!text) continue
    for (const part of splitFileRefs(text)) if (part.kind === 'ref') refs.push(part.ref)
  }
  return refs
}

async function resolveAll(folder: string, refs: readonly FileRef[]): Promise<Map<string, ResolvedRef>> {
  const fs = window.electronAPI?.fs
  const found = new Map<string, ResolvedRef>()
  if (!fs) return found
  const listings = new Map<string, Promise<string[]>>()
  const list = (dir: string) => {
    let pending = listings.get(dir)
    if (!pending) {
      pending = Promise.resolve()
        .then(() => fs.readdir(dir))
        .then(entries => (Array.isArray(entries) ? entries.filter(entry => !entry.isDirectory).map(entry => entry.name) : []))
        .catch(() => [])
      listings.set(dir, pending)
    }
    return pending
  }
  const exists = async (abs: string) => {
    try {
      return (await fs.stat(abs)) != null
    } catch {
      return false
    }
  }
  await Promise.all(refs.map(async ref => {
    for (const lookup of refLookups(folder, ref)) {
      if (lookup.kind === 'stat') {
        if (await exists(lookup.abs)) {
          found.set(fileRefKey(ref), { abs: lookup.abs, rel: lookup.rel })
          return
        }
        continue
      }
      const name = matchIdFile(lookup.id, await list(lookup.dir))
      if (name) {
        found.set(fileRefKey(ref), { abs: joinRoot(folder, `${lookup.relDir}/${name}`), rel: `${lookup.relDir}/${name}` })
        return
      }
    }
  }))
  return found
}

/** The existing files among `refs` (deduplicated, cut at `INBOX_FILE_REF_MAX`) under `folder`. */
export function useInboxFileRefs(folder: string | null | undefined, refs: readonly FileRef[]): InboxRefLinks {
  const unique = useMemo(() => {
    const seen = new Map<string, FileRef>()
    for (const ref of refs) {
      if (seen.size >= INBOX_FILE_REF_MAX) break
      const key = fileRefKey(ref)
      if (!seen.has(key)) seen.set(key, ref)
    }
    return seen
  }, [refs])
  const signature = [...unique.keys()].join('\n')
  const [links, setLinks] = useState<{ folder: string; signature: string; found: InboxRefLinks } | null>(null)

  useEffect(() => {
    if (!folder || unique.size === 0) return
    let disposed = false
    void resolveAll(folder, [...unique.values()]).then(found => {
      if (!disposed) setLinks({ folder, signature, found })
    })
    return () => { disposed = true }
    // `unique` follows `signature`: re-check only when the set of references (or the folder) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, signature])

  if (!folder || !links || links.folder !== folder) return EMPTY
  return links.found
}
