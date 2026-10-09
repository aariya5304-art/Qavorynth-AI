import AlertFeed from '../components/AlertFeed'
import { RainWaterChart, RiskDistributionChart } from '../components/Charts'
import EventTimeline from '../components/EventTimeline'
import Hotspots from '../components/Hotspots'
import MapView from '../components/MapView'
import MetricStrip from '../components/MetricStrip'
import RouteSummary from '../components/RouteSummary'
import ShelterList from '../components/ShelterList'
import ZonePanel from '../components/ZonePanel'

export default function OverviewView() {
  return (
    <div className="space-y-3 p-3">
      <MetricStrip />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <MapView className="h-[560px]" />
        <div className="grid gap-3 xl:max-h-[560px] xl:grid-rows-[auto_minmax(0,1fr)]">
          <ZonePanel />
          <RouteSummary className="min-h-[220px]" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <RiskDistributionChart />
        <div className="lg:col-span-1 xl:col-span-2"><RainWaterChart /></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <AlertFeed className="h-[320px]" />
        <Hotspots className="h-[320px]" />
        <ShelterList className="h-[320px]" />
        <EventTimeline className="h-[320px]" />
      </div>
    </div>
  )
}
