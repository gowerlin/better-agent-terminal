/**
 * PLAN-068 W5 / T0908 (T0902 §1): `⏸N` — the pending decisions (`awaiting_user`) of a workspace, on its
 * contract-2 Tower thumbnails and its workspace row. Nothing when the workspace's Inbox does not judge
 * `match` (§6′) or nothing waits. A click opens the Inbox tab. Turn cards never count here.
 */
import { useTranslation } from 'react-i18next'
import { useInboxAwaitingCount } from './useInboxModel'
import { requestOpenInbox } from '../../stores/inbox-store'
import '../../styles/inbox.css'

export function InboxAwaitingBadge({ workspaceId, folderPath, onOpen }: {
  workspaceId: string | null | undefined
  folderPath: string | null | undefined
  /** Before the Inbox opens (e.g. select the workspace). */
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  const count = useInboxAwaitingCount(workspaceId, folderPath)
  if (count <= 0) return null
  return (
    <span
      className="inbox-awaiting-badge"
      data-inbox-awaiting-count={count}
      title={t('inbox.awaitingBadge', { count })}
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.()
        requestOpenInbox()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {`⏸${count}`}
    </span>
  )
}
