// BUG-048 T0213 — shared helper for CT Panel views that open a file in the
// Workspace "Files" tab and reveal it in the FileTree.
// Centralizes the two-event dispatch so copies across views don't drift apart.
// Paired with fileTreeRevealBus.ts, which buffers the reveal event when
// FileTree has not yet mounted.

export function openFileInFilesTab(filePath: string): void {
  window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
  window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
}
