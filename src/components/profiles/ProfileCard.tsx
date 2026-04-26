// PLAN-007 T0288 — Shared ProfileCard component (RFC C-7).
// Handles common layout (name + type badge + connection status); per-env
// details rendering is delegated to <ProfileCardDetails>.
import type { ReactNode } from 'react'
import type { ProfileEntry, ConnectionStatus } from './types'
import { selectDetailsVariant } from './types'
import { ProfileCardDetails } from './ProfileCardDetails'

export interface ProfileCardProps {
  profile: ProfileEntry
  isActive: boolean
  isRunning: boolean
  isExpanded: boolean
  connectionStatus?: ConnectionStatus
  onToggleExpand: () => void
  onSwitch: () => void
  onEdit?: () => void
  onDelete?: () => void
  /**
   * Extra inline action buttons (test-connection, rename, duplicate, edit-remote).
   * Rendered on the right of the card header. Kept as a slot so ProfilePanel can
   * preserve its existing IPC handlers without bloating the prop surface.
   */
  actions?: ReactNode
  /**
   * Optional inline content rendered inside the expanded body, above the
   * details slot. Used by ProfilePanel to host the legacy remote-edit form
   * during the migration to a dedicated modal.
   */
  expandedExtras?: ReactNode
  /**
   * If provided, replaces the default header (name + badge). Used when the
   * card is in inline-rename mode.
   */
  headerOverride?: ReactNode
}

const TYPE_BADGE_LABEL: Record<ReturnType<typeof selectDetailsVariant>, string> = {
  local: 'Local',
  wsl: 'WSL',
  docker: 'Docker',
  'ssh-linux': 'SSH (Linux)',
  'ssh-darwin': 'SSH (macOS)',
  'remote-legacy': 'Remote',
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const dot = status === 'connected' ? '🟢' : status === 'disconnected' ? '🔴' : '⚪'
  const title =
    status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Idle'
  return (
    <span
      className={`profile-card-status profile-card-status-${status}`}
      title={title}
      aria-label={title}
      data-testid="profile-card-status"
    >
      {dot}
    </span>
  )
}

export function ProfileCard({
  profile,
  isActive,
  isRunning,
  isExpanded,
  connectionStatus,
  onToggleExpand,
  onSwitch,
  onEdit,
  onDelete,
  actions,
  expandedExtras,
  headerOverride,
}: ProfileCardProps) {
  const variant = selectDetailsVariant(profile)
  const badge = TYPE_BADGE_LABEL[variant] ?? 'Profile'
  const status: ConnectionStatus =
    connectionStatus ?? (isRunning ? 'connected' : profile.type === 'remote' ? 'disconnected' : 'idle')

  return (
    <div
      className={`profile-card profile-item ${isActive ? 'active' : ''} ${isRunning ? 'running' : ''} ${isExpanded ? 'expanded' : ''}`}
      data-testid="profile-card"
      data-profile-id={profile.id}
    >
      <div
        className="profile-card-header"
        onClick={(e) => {
          // Clicking the header toggles expansion; switch is a separate explicit action.
          if ((e.target as HTMLElement).closest('button, input, select, .profile-card-actions')) return
          onToggleExpand()
        }}
      >
        <button
          type="button"
          className="profile-card-toggle"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
        <div className="profile-card-info">
          {headerOverride ?? (
            <>
              <span className="profile-card-name profile-item-name">
                {isActive && <span className="profile-active-dot" />}
                {profile.name}
                <span className="profile-card-badge" data-testid="profile-card-badge">
                  {badge}
                </span>
              </span>
              <span className="profile-card-meta profile-item-meta">
                {profile.type === 'remote'
                  ? `${profile.remoteHost}:${profile.remotePort || 9876}${profile.remoteProfileId ? ` → ${profile.remoteProfileId}` : ''}`
                  : new Date(profile.updatedAt).toLocaleString()}
              </span>
            </>
          )}
        </div>
        <StatusDot status={status} />
        <div
          className="profile-card-actions profile-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="profile-icon-btn"
            title="Open"
            onClick={onSwitch}
            data-testid="profile-card-switch"
          >
            ↗
          </button>
          {actions}
          {onEdit && (
            <button
              type="button"
              className="profile-icon-btn"
              title="Edit"
              onClick={onEdit}
              data-testid="profile-card-edit"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="profile-icon-btn danger"
              title="Delete"
              onClick={onDelete}
              data-testid="profile-card-delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="profile-card-body">
          {expandedExtras}
          <ProfileCardDetails profile={profile} />
        </div>
      )}
    </div>
  )
}
