import { useSim } from '../store'
import { api } from '../api/client'

export function LoadingState() {
  return (
    <div className="grid h-full place-items-center p-8" role="status" aria-live="polite">
      <p className="text-sm text-fg-muted">Loading scenario state from the API…</p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  const { retry } = useSim()
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="panel max-w-lg p-5" role="alert">
        <h2 className="text-base font-semibold text-crit">The operations API is not reachable</h2>
        <p className="mt-2 text-[13px] text-fg-muted">{message}</p>
        <p className="mt-2 text-[13px] text-fg-muted">
          Start the backend (<code className="text-cyanx">uvicorn app.main:app --port 8000</code> in <code className="text-cyanx">backend/</code>)
          or set <code className="text-cyanx">VITE_API_BASE_URL</code> (currently <code className="text-cyanx">{api.baseUrl}</code>) and reload.
        </p>
        <button className="btn btn-primary mt-4" onClick={retry}>Retry connection</button>
      </div>
    </div>
  )
}

export function Banners() {
  const { online, notice, dismissNotice } = useSim()
  return (
    <>
      {!online && (
        <div className="border-b border-warn/40 bg-warn/10 px-4 py-1.5 text-[13px] text-warn" role="status">
          Offline: the API stopped responding. Showing the last known state; controls will fail until it reconnects.
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-3 border-b border-crit/40 bg-crit/10 px-4 py-1.5 text-[13px] text-crit" role="alert">
          <span>{notice}</span>
          <button className="btn px-2 py-0.5" onClick={dismissNotice}>Dismiss</button>
        </div>
      )}
    </>
  )
}
