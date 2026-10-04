import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  REMOTE_AUTH_ENV_VARS,
  REMOTE_TOOLS_DETECT_ERROR_CODES,
  REMOTE_TOOL_TIERS,
  REMOTE_TOOLS_WITH_LOGIN,
  remoteToolTier,
  type RemoteToolReport,
  type RemoteToolsDetectResult,
  type RemoteToolsReport,
  type RemoteToolTier,
  type RemoteToolWithLogin,
} from '../../types/remote-tools'
import { normalizeRecipeEnv, type InstallPlan, type RecipeEnv } from '../../lib/remote-tools/recipes'
import { unsupportedRemoteChannel } from '../../lib/remote-unsupported'
import { isCurlUsable, toolAction, type ToolAction } from './tool-actions'
import { InstallConfirmDialog } from './InstallConfirmDialog'
import { ExternalLink } from './ExternalLink'
import '../../styles/remote-tools.css'

export type RemoteToolsPanelHost = 'wizard' | 'profile' | 'remote-window'

export interface RemoteToolsPanelProps {
  /** Where the panel is rendered; picks the "where the install runs" copy in the confirm dialog. */
  host: RemoteToolsPanelHost
  /** Runs the probe (T0411 `remote:detect-tools` / `remote-tools:detect`). Called on mount and on "Check again". */
  detect: () => Promise<RemoteToolsDetectResult>
  /** Receives the confirmed plan (T0412 runs it). Without it no install / update buttons are shown. */
  onInstall?: (plan: InstallPlan) => void
  /** Starts the login flow for a tool (T0402). Without it login state is shown without a button. */
  onLogin?: (toolId: RemoteToolWithLogin) => void
  /** Opens docs / script links; defaults to a `target="_blank"` link. */
  onOpenUrl?: (url: string) => void
  /** Copies the command in the confirm dialog; defaults to `navigator.clipboard.writeText`. */
  copyText?: (text: string) => Promise<void> | void
}

type PanelState =
  | { phase: 'loading' }
  | { phase: 'ready'; report: RemoteToolsReport }
  | { phase: 'error'; messageKey: string; detail?: string }

const LOGIN_TOOLS: ReadonlySet<string> = new Set(REMOTE_TOOLS_WITH_LOGIN)

const SERVER_TOO_OLD: PanelState = { phase: 'error', messageKey: 'remoteTools.error.server-too-old' }
const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(REMOTE_TOOLS_DETECT_ERROR_CODES)

function errorState(result: Extract<RemoteToolsDetectResult, { ok: false }>): PanelState {
  // An older server answers "No handler for channel" (T0407 §4), raw or wrapped in a result.
  if ((result.errorCode as string) === 'server-too-old' || unsupportedRemoteChannel(result.error)) return SERVER_TOO_OLD
  const code = KNOWN_ERROR_CODES.has(result.errorCode) ? result.errorCode : 'detectFailed'
  return { phase: 'error', messageKey: `remoteTools.error.${code}`, detail: result.error }
}

function thrownState(err: unknown): PanelState {
  if (unsupportedRemoteChannel(err)) return SERVER_TOO_OLD
  const detail = err instanceof Error ? err.message : typeof err === 'string' ? err : undefined
  return { phase: 'error', messageKey: 'remoteTools.error.detectFailed', detail }
}

/**
 * T0410 (PLAN-037 D, spec T0407 §5): remote AI toolchain status with install / update / login
 * actions. Pure UI — the probe and the install runner are injected (T0411 / T0412 / T0413).
 */
export function RemoteToolsPanel({ host, detect, onInstall, onLogin, onOpenUrl, copyText }: Readonly<RemoteToolsPanelProps>) {
  const { t } = useTranslation()
  const [state, setState] = useState<PanelState>({ phase: 'loading' })
  const [pendingPlan, setPendingPlan] = useState<InstallPlan | null>(null)
  const requestId = useRef(0)

  const runDetect = useCallback(() => {
    const id = ++requestId.current
    setState({ phase: 'loading' })
    detect().then(
      (result) => {
        if (id !== requestId.current) return
        setState(result.ok ? { phase: 'ready', report: result.report } : errorState(result))
      },
      (err: unknown) => {
        if (id !== requestId.current) return
        setState(thrownState(err))
      },
    )
  }, [detect])

  useEffect(() => {
    runDetect()
    // Invalidate any in-flight probe on unmount.
    return () => { requestId.current++ }
  }, [runDetect])

  const report = state.phase === 'ready' ? state.report : null
  // Recipes only accept enum values; an env that fails this came from a malformed / tampered report.
  const recipeEnv = useMemo<RecipeEnv | null>(() => {
    if (!report) return null
    try {
      return normalizeRecipeEnv(report.env)
    } catch {
      return null
    }
  }, [report])

  const confirm = (plan: InstallPlan) => {
    setPendingPlan(null)
    onInstall?.(plan)
  }

  return (
    <section className={`remote-tools-panel remote-tools-panel--${host}`} aria-labelledby="remote-tools-title">
      <header className="remote-tools-header">
        <h4 id="remote-tools-title">{t('remoteTools.title')}</h4>
        <button type="button" className="remote-tools-btn" onClick={runDetect} disabled={state.phase === 'loading'}>
          {state.phase === 'loading' ? t('remoteTools.checking') : t('remoteTools.recheck')}
        </button>
      </header>

      {state.phase === 'loading' && <p className="remote-tools-muted" role="status">{t('remoteTools.checking')}</p>}

      {state.phase === 'error' && (
        <div className="remote-tools-error" role="alert">
          <div>{t(state.messageKey)}</div>
          {state.detail && <div className="remote-tools-muted remote-tools-error-detail">{state.detail}</div>}
        </div>
      )}

      {report && (
        <>
          <EnvSummary report={report} />
          {!recipeEnv && <div className="remote-tools-error" role="alert">{t('remoteTools.error.invalidReport')}</div>}
          {!report.serverViewAvailable && <p className="remote-tools-muted">{t('remoteTools.server.viewUnavailable')}</p>}
          <ToolGroups
            report={report}
            recipeEnv={recipeEnv}
            canInstall={!!onInstall}
            onRequestPlan={setPendingPlan}
            onLogin={onLogin}
            onOpenUrl={onOpenUrl}
          />
        </>
      )}

      {pendingPlan && (
        <InstallConfirmDialog
          plan={pendingPlan}
          host={host}
          onConfirm={confirm}
          onCancel={() => setPendingPlan(null)}
          onOpenUrl={onOpenUrl}
          copyText={copyText}
        />
      )}
    </section>
  )
}

function EnvSummary({ report }: Readonly<{ report: RemoteToolsReport }>) {
  const { t } = useTranslation()
  const { env } = report
  const os = [env.osId, env.osVersion].filter(Boolean).join(' ') || env.osFamily
  const authVars = REMOTE_AUTH_ENV_VARS.filter((name) => env.authEnv?.[name])
  return (
    <div className="remote-tools-env" data-testid="remote-tools-env">
      <span>{os}{env.arch ? ` · ${env.arch}` : ''}</span>
      {env.isWsl && <span className="remote-tools-chip">{t('remoteTools.env.wsl')}</span>}
      {env.musl && <span className="remote-tools-chip">{t('remoteTools.env.musl')}</span>}
      <span>
        {env.pkgManager === 'none'
          ? t('remoteTools.env.pkgManagerNone')
          : t('remoteTools.env.pkgManager', { pm: env.pkgManager })}
      </span>
      <span>{t(`remoteTools.privilege.${env.privilege}`)}</span>
      {authVars.length > 0 && <span>{t('remoteTools.env.authEnv', { names: authVars.join(', ') })}</span>}
    </div>
  )
}

interface ToolGroupsProps {
  report: RemoteToolsReport
  recipeEnv: RecipeEnv | null
  canInstall: boolean
  onRequestPlan(plan: InstallPlan): void
  onLogin?: (toolId: RemoteToolWithLogin) => void
  onOpenUrl?: (url: string) => void
}

function ToolGroups({ report, recipeEnv, canInstall, onRequestPlan, onLogin, onOpenUrl }: Readonly<ToolGroupsProps>) {
  const { t } = useTranslation()
  const curlUsable = isCurlUsable(report)
  const groups = new Map<RemoteToolTier, RemoteToolReport[]>()
  for (const tool of report.tools) {
    const tier = remoteToolTier(tool.id, report.env)
    groups.set(tier, [...(groups.get(tier) ?? []), tool])
  }

  return (
    <>
      {REMOTE_TOOL_TIERS.filter((tier) => groups.has(tier)).map((tier) => (
        <div key={tier} className="remote-tools-group" data-tier={tier}>
          <h5 className="remote-tools-group-title">{t(`remoteTools.tier.${tier}`)}</h5>
          <ul className="remote-tools-list">
            {groups.get(tier)!.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                report={report}
                action={recipeEnv ? toolAction(tool, recipeEnv, curlUsable) : { kind: 'none' }}
                canInstall={canInstall}
                onRequestPlan={onRequestPlan}
                onLogin={onLogin}
                onOpenUrl={onOpenUrl}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

interface ToolRowProps {
  tool: RemoteToolReport
  report: RemoteToolsReport
  action: ToolAction
  canInstall: boolean
  onRequestPlan(plan: InstallPlan): void
  onLogin?: (toolId: RemoteToolWithLogin) => void
  onOpenUrl?: (url: string) => void
}

function ToolRow({ tool, report, action, canInstall, onRequestPlan, onLogin, onOpenUrl }: Readonly<ToolRowProps>) {
  const { t } = useTranslation()
  const hasLogin = LOGIN_TOOLS.has(tool.id) && !!tool.login && tool.login !== 'n/a'
  const needsLogin = hasLogin && tool.login !== 'loggedIn'
  // claude keeps macOS credentials in the Keychain, so a missing file proves nothing there (T0408).
  const credentialHint =
    tool.login === 'unknown' && tool.credentialFilePresent !== undefined
      ? tool.credentialFilePresent
        ? 'remoteTools.login.credentialFilePresent'
        : report.env.osFamily === 'darwin' && tool.id === 'claude'
          ? null
          : 'remoteTools.login.credentialFileAbsent'
      : null

  return (
    <li className={`remote-tools-row remote-tools-row--${tool.status}`} data-testid={`remote-tool-${tool.id}`}>
      <div className="remote-tools-row-main">
        <span className="remote-tools-name">{t(`remoteTools.tool.${tool.id}.name`)}</span>
        <span className={`remote-tools-status remote-tools-status--${tool.status}`}>{t(`remoteTools.status.${tool.status}`)}</span>
        {tool.version && <span className="remote-tools-version">{tool.version}</span>}
        {hasLogin && (
          <span className={`remote-tools-login remote-tools-login--${tool.login}`}>{t(`remoteTools.login.${tool.login}`)}</span>
        )}
        {report.serverViewAvailable && (
          <span className="remote-tools-server" title={t('remoteTools.server.tooltip')}>
            {t(tool.serverVisible ? 'remoteTools.server.visible' : 'remoteTools.server.hidden')}
          </span>
        )}
        <span className="remote-tools-actions">
          {canInstall && action.kind === 'install' && (
            <button
              type="button"
              className="remote-tools-btn primary"
              disabled={action.blockedByCurl}
              onClick={() => onRequestPlan(action.plan)}
            >
              {t('remoteTools.install')}
            </button>
          )}
          {canInstall && action.kind === 'update' && (
            <button
              type="button"
              className={`remote-tools-btn${action.emphasized ? ' primary' : ''}`}
              onClick={() => onRequestPlan(action.plan)}
            >
              {t('remoteTools.update')}
            </button>
          )}
          {onLogin && needsLogin && (
            <button type="button" className="remote-tools-btn" onClick={() => onLogin(tool.id as RemoteToolWithLogin)}>
              {t('remoteTools.login.button')}
            </button>
          )}
        </span>
      </div>
      {tool.path && <div className="remote-tools-path" title={tool.path}>{tool.path}</div>}
      {tool.status === 'interop-only' && <div className="remote-tools-hint">{t('remoteTools.hint.interopOnly')}</div>}
      {tool.status === 'not-on-path' && <div className="remote-tools-hint">{t('remoteTools.hint.notOnPath')}</div>}
      {tool.status === 'too-old' && <div className="remote-tools-hint remote-tools-hint--warn">{t('remoteTools.hint.tooOld')}</div>}
      {tool.status === 'error' && <div className="remote-tools-hint">{t('remoteTools.hint.versionError')}</div>}
      {action.kind === 'install' && action.blockedByCurl && (
        <div className="remote-tools-hint remote-tools-hint--warn">{t('remoteTools.hint.curlMissing')}</div>
      )}
      {action.kind === 'unsupported' && (
        <div className="remote-tools-hint">
          {t(`remoteTools.unsupported.${action.reason}`)}
          {action.docsUrl && (
            <> <ExternalLink href={action.docsUrl} onOpenUrl={onOpenUrl}>{t('remoteTools.docsLink')}</ExternalLink></>
          )}
        </div>
      )}
      {credentialHint && <div className="remote-tools-hint">{t(credentialHint)}</div>}
    </li>
  )
}
