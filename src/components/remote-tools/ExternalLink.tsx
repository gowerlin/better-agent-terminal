import type { ReactNode } from 'react'

interface ExternalLinkProps {
  href: string
  /** Injected opener (e.g. `shell.openExternal`); without it the window-open handler sends the link to the browser. */
  onOpenUrl?: (url: string) => void
  className?: string
  children: ReactNode
}

/** A link that opens in the external browser — `target="_blank"` is routed there by `setWindowOpenHandler`. */
export function ExternalLink({ href, onOpenUrl, className, children }: Readonly<ExternalLinkProps>) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpenUrl ? (e) => { e.preventDefault(); onOpenUrl(href) } : undefined}
    >
      {children}
    </a>
  )
}
