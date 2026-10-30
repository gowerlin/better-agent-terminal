import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type WorkOrder, statusColor, statusLabel } from '../types/control-tower'
import type { SprintStatus } from '../types/sprint-status'
import type { CtConfigSourceFile, CtConfigSources } from '../types/ct-config-sources'
import {
  type ConfigEntry,
  type ConfigLayer,
  type TowerStateParse,
  type DualInstallNotice,
  CONFIG_LAYER_ORDER,
  TOWER_STATE_TODO_LIMIT,
  dualInstallNotices,
  isListedInOverview,
  mergeTowerConfig,
  parseTowerConfigDefaults,
  parseTowerConfigYaml,
} from '../lib/ct-tower-overview'
import { SprintDashboard } from './SprintDashboard'

// T0701 (D184): Control Tower panel「總覽」— tower state, *config, then the sprint block
// (only when sprint-status.yaml exists). Read-only; every input comes from ControlTowerPanel,
// which reloads them on the `_ct-workorders/` watcher and on refresh (R5).

/** `_tower-state.md` as the panel loaded it. */
export type TowerStateLoad =
  | { status: 'missing' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; parsed: TowerStateParse; mtime: string | null }

/** `_tower-config.yaml` (project layer) as the panel loaded it. */
export type ProjectConfigLoad =
  | { status: 'missing' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; content: string }

/** Global + default layers from `ct:read-config-sources`. */
export type ConfigSourcesLoad =
  | { status: 'loading' }
  | { status: 'ok'; sources: CtConfigSources }
  /** The host this window is bound to has no handler (a bat-server before T0701). */
  | { status: 'unsupported' }
  | { status: 'error'; error: string }

interface TowerOverviewProps {
  towerState: TowerStateLoad | null
  workOrders: WorkOrder[]
  projectConfig: ProjectConfigLoad | null
  configSources: ConfigSourcesLoad | null
  sprintStatus: SprintStatus | null
  /** T0708 (BUG-172): a sprint-status.yaml exists but could not be read (formatted message) */
  sprintReadError?: string | null
  ctDirPath: string | null
  onOpenFile: (filePath: string) => void
}

const TOWER_STATE_FILE = '_tower-state.md'
const TOWER_CONFIG_FILE = '_tower-config.yaml'

export function TowerOverview(props: TowerOverviewProps) {
  return (
    <div className="ct-overview">
      <TowerStateSection {...props} />
      <ConfigSection {...props} />
      {props.sprintStatus && (
        <div className="ct-overview-section">
          <div className="sprint-section-title">📊 Sprint</div>
          <SprintDashboard sprintStatus={props.sprintStatus} />
        </div>
      )}
      {!props.sprintStatus && props.sprintReadError && (
        <div className="ct-overview-section">
          <div className="sprint-section-title">📊 Sprint</div>
          <div className="ct-overview-muted ct-read-error">⚠️ {props.sprintReadError}</div>
        </div>
      )}
    </div>
  )
}

// ─── R1 tower state ─────────────────────────────────────────────────────────

function TowerStateSection({ towerState, workOrders, ctDirPath, onOpenFile }: TowerOverviewProps) {
  const { t } = useTranslation()
  const openState = () => { if (ctDirPath) onOpenFile(`${ctDirPath}/${TOWER_STATE_FILE}`) }
  const listed = workOrders.filter(o => isListedInOverview(o.status))

  return (
    <div className="ct-overview-section">
      <div className="sprint-section-title">🗼 {t('controlTower.overview.towerState')}</div>

      {towerState === null && <div className="ct-overview-muted">{t('controlTower.loading')}</div>}
      {towerState?.status === 'missing' && (
        <div className="ct-overview-muted">
          {t('controlTower.overview.noTowerState')} <code className="ct-path">_ct-workorders/{TOWER_STATE_FILE}</code>
        </div>
      )}
      {towerState?.status === 'error' && (
        <div className="ct-overview-muted">{t('controlTower.overview.towerStateError', { error: towerState.error })}</div>
      )}

      {towerState?.status === 'loaded' && towerState.parsed.kind === 'summary' && (
        <>
          {towerState.parsed.summary.updatedAt && (
            <OverviewRow label={t('controlTower.overview.lastUpdated')} value={towerState.parsed.summary.updatedAt} />
          )}
          {towerState.parsed.summary.session && (
            <OverviewRow label={t('controlTower.overview.session')} value={towerState.parsed.summary.session} />
          )}
          {towerState.parsed.summary.nextIds.length > 0 && (
            <div className="ct-overview-row">
              <span className="ct-overview-label">{t('controlTower.overview.nextIds')}</span>
              <span className="ct-overview-chips">
                {towerState.parsed.summary.nextIds.map(({ key, value }) => (
                  <span key={key} className="ct-overview-chip"><span className="ct-overview-chip-key">{key}</span> {value}</span>
                ))}
              </span>
            </div>
          )}
          {towerState.parsed.summary.todo.length > 0 && (
            <div className="ct-overview-todo">
              <div className="ct-overview-label">{t('controlTower.overview.todo')}</div>
              <ul>
                {towerState.parsed.summary.todo.slice(0, TOWER_STATE_TODO_LIMIT).map((item, i) => <li key={i}>{item}</li>)}
              </ul>
              {towerState.parsed.summary.todo.length > TOWER_STATE_TODO_LIMIT && (
                <div className="ct-overview-muted">
                  {t('controlTower.overview.todoMore', { count: towerState.parsed.summary.todo.length - TOWER_STATE_TODO_LIMIT })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {towerState?.status === 'loaded' && towerState.parsed.kind === 'no-summary' && (
        <>
          {towerState.parsed.lastUpdated ? (
            <OverviewRow label={t('controlTower.overview.lastUpdated')} value={towerState.parsed.lastUpdated} />
          ) : towerState.mtime ? (
            <OverviewRow
              label={t('controlTower.overview.lastUpdated')}
              value={`${towerState.mtime} ${t('controlTower.overview.fileMtime')}`}
            />
          ) : null}
          <div className="ct-overview-hint">
            {t('controlTower.overview.noSummary')}
            <button className="ct-view-file-btn" onClick={openState}>📄 {t('controlTower.viewFile')}</button>
          </div>
        </>
      )}

      <div className="ct-overview-subtitle">{t('controlTower.overview.openOrders', { count: listed.length })}</div>
      {listed.length === 0 ? (
        <div className="ct-overview-muted">{t('controlTower.overview.noOpenOrders')}</div>
      ) : (
        <div className="ct-overview-orders">
          {listed.map(order => (
            <button
              key={order.id}
              className="ct-overview-order"
              onClick={() => { if (ctDirPath) onOpenFile(`${ctDirPath}/${order.filename}`) }}
              title={order.title}
            >
              <span className="ct-order-id">{order.id}</span>
              <span className="ct-order-title">{order.title}</span>
              <span className={`ct-status-badge ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ct-overview-row">
      <span className="ct-overview-label">{label}</span>
      <span className="ct-overview-value">{value}</span>
    </div>
  )
}

// ─── R2 *config ─────────────────────────────────────────────────────────────

function ConfigSection({ projectConfig, configSources, ctDirPath, onOpenFile }: TowerOverviewProps) {
  const { t } = useTranslation()
  const [showOverridden, setShowOverridden] = useState(false)

  const project = useMemo(
    () => (projectConfig?.status === 'loaded' ? parseTowerConfigYaml(projectConfig.content) : null),
    [projectConfig],
  )
  const sources = configSources?.status === 'ok' ? configSources.sources : null
  const global = useMemo(
    () => (sources?.global.status === 'found' ? parseTowerConfigYaml(sources.global.content) : null),
    [sources],
  )
  const defaults = useMemo(
    () => (sources?.defaults.status === 'found' ? parseTowerConfigDefaults(sources.defaults.content) : null),
    [sources],
  )
  const entries = useMemo(
    () => mergeTowerConfig({ defaults, global: global?.values ?? null, project: project?.values ?? null }),
    [defaults, global, project],
  )

  const notices = useMemo(() => dualInstallNotices(sources?.installs), [sources])

  const layerName = (layer: ConfigLayer) => t(`controlTower.overview.layer.${layer}`)

  return (
    <div className="ct-overview-section">
      <div className="sprint-section-title">⚙️ {t('controlTower.overview.config')}</div>
      <div className="ct-overview-muted">{t('controlTower.overview.noSessionLayer')}</div>

      <div className="ct-overview-layers">
        <LayerStatus
          name={layerName('project')}
          text={
            projectConfig === null ? t('controlTower.loading')
              : projectConfig.status === 'loaded'
                ? (project?.error ? t('controlTower.overview.layerParseError', { error: project.error }) : `_ct-workorders/${TOWER_CONFIG_FILE}`)
                : projectConfig.status === 'missing' ? t('controlTower.overview.layerMissing')
                  : t('controlTower.overview.layerReadError', { error: projectConfig.error })
          }
          onOpen={projectConfig?.status === 'loaded' && ctDirPath ? () => onOpenFile(`${ctDirPath}/${TOWER_CONFIG_FILE}`) : undefined}
        />
        <LayerStatus name={layerName('global')} text={hostLayerText(t, configSources, 'global', global?.error)} />
        <LayerStatus name={layerName('default')} text={hostLayerText(t, configSources, 'defaults', undefined)} />
        {notices.map(notice => <DualInstallRow key={notice.agent} notice={notice} />)}
      </div>

      <label className="ct-archive-toggle ct-overview-toggle">
        <input type="checkbox" checked={showOverridden} onChange={e => setShowOverridden(e.target.checked)} />
        {t('controlTower.overview.showOverridden')}
      </label>

      {entries.length === 0 ? (
        <div className="ct-overview-muted">{t('controlTower.overview.noConfig')}</div>
      ) : (
        <div className="ct-overview-config">
          {entries.map(entry => (
            <ConfigRow key={entry.key} entry={entry} showOverridden={showOverridden} layerName={layerName} />
          ))}
        </div>
      )}
    </div>
  )
}

type Translate = ReturnType<typeof useTranslation>['t']

function hostLayerText(
  t: Translate,
  load: ConfigSourcesLoad | null,
  layer: 'global' | 'defaults',
  parseError: string | undefined,
): string {
  if (load === null || load.status === 'loading') return t('controlTower.loading')
  if (load.status === 'unsupported') return t('controlTower.overview.remoteUnsupported')
  if (load.status === 'error') return t('controlTower.overview.layerReadError', { error: load.error })
  const file: CtConfigSourceFile = load.sources[layer]
  if (file.status === 'found') return parseError ? t('controlTower.overview.layerParseError', { error: parseError }) : file.path
  if (file.status === 'error') return t('controlTower.overview.layerReadError', { error: `${file.path}: ${file.error}` })
  return layer === 'defaults' ? t('controlTower.overview.noInstalledCt') : t('controlTower.overview.layerMissing')
}

function LayerStatus({ name, text, onOpen }: { name: string; text: string; onOpen?: () => void }) {
  return (
    <div className="ct-overview-layer">
      <span className="ct-overview-layer-name">{name}</span>
      {onOpen
        ? <button className="ct-overview-link" onClick={onOpen}>{text}</button>
        : <span className="ct-overview-layer-text">{text}</span>}
    </div>
  )
}

/**
 * T0711: one agent has both a zip install and the `ct` plugin; `/ct-exec` / `$ct-exec` runs the
 * zip one. Different versions → warning; same or unknown → info. Text only, no action (read-only).
 */
function DualInstallRow({ notice }: { notice: DualInstallNotice }) {
  const { t } = useTranslation()
  const version = (value: string | null) => (value ? t('controlTower.overview.dualInstallVersion', { version: value }) : '')
  const text = t('controlTower.overview.dualInstall', {
    agent: notice.agent === 'claude' ? 'Claude' : 'Codex',
    command: notice.agent === 'claude' ? '/ct-exec' : '$ct-exec',
    manualVersion: version(notice.manualVersion),
    pluginVersion: version(notice.pluginVersion),
    interpolation: { escapeValue: false },
  })
  return (
    <div className={`ct-overview-hint ct-overview-dual-install ct-overview-dual-install-${notice.level}`} data-level={notice.level}>
      <span className={notice.level === 'warn' ? 'ct-validation-warn' : undefined}>
        {notice.level === 'warn' ? '⚠️' : 'ℹ️'} {text}
      </span>
    </div>
  )
}

function ConfigRow({ entry, showOverridden, layerName }: {
  entry: ConfigEntry
  showOverridden: boolean
  layerName: (layer: ConfigLayer) => string
}) {
  const overridden = CONFIG_LAYER_ORDER
    .filter(layer => layer !== entry.source && entry.layers[layer] !== undefined)
    .reverse()
  const tooltip = [entry.description, entry.validValues && `[${entry.validValues}]`].filter(Boolean).join(' ')
  return (
    <div className="ct-overview-config-row" title={tooltip || undefined}>
      <span className="ct-overview-config-key">{entry.key}</span>
      <span className="ct-overview-config-value">{entry.effective}</span>
      <span className={`ct-overview-source ct-overview-source-${entry.source}`}>{layerName(entry.source)}</span>
      {showOverridden && overridden.length > 0 && (
        <span className="ct-overview-config-overridden">
          {overridden.map(layer => `${layerName(layer)}: ${entry.layers[layer]}`).join(' · ')}
        </span>
      )}
    </div>
  )
}
