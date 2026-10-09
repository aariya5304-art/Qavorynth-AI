import { ReactNode, useEffect, useState } from 'react'
import { useSim } from './store'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import { Banners, ErrorState, LoadingState } from './components/StateViews'
import EvacuationView from './views/EvacuationView'
import EventLogView from './views/EventLogView'
import MethodologyView from './views/MethodologyView'
import OverviewView from './views/OverviewView'
import RiskMapView from './views/RiskMapView'
import SheltersView from './views/SheltersView'
import SimulatorView from './views/SimulatorView'
import type { ViewId } from './types'

const VIEWS: ViewId[] = ['overview', 'map', 'evacuation', 'shelters', 'simulator', 'log', 'method']
const fromHash = (): ViewId => {
  const h = window.location.hash.replace('#/', '') as ViewId
  return VIEWS.includes(h) ? h : 'overview'
}

export default function App() {
  const { snap, loading, error } = useSim()
  const [view, setView] = useState<ViewId>(fromHash)

  useEffect(() => {
    const on = () => setView(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (v: ViewId) => { window.location.hash = `#/${v}`; setView(v) }

  let body: ReactNode
  if (loading && !snap) body = <LoadingState />
  else if (!snap) body = <ErrorState message={error ?? 'No data received from the API.'} />
  else {
    body = {
      overview: <OverviewView />, map: <RiskMapView />, evacuation: <EvacuationView />, shelters: <SheltersView />,
      simulator: <SimulatorView />, log: <EventLogView />, method: <MethodologyView />,
    }[view]
  }

  return (
    <div className="flex h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ink-900 focus:p-2">Skip to content</a>
      <Header />
      <Banners />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar view={view} onChange={go} />
        <main id="main" className="min-h-0 min-w-0 flex-1 overflow-auto">{body}</main>
      </div>
    </div>
  )
}
