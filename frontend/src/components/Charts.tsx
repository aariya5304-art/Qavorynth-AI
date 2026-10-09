import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSim } from '../store'
import Panel from './Panel'

const AXIS = { fill: '#8193b0', fontSize: 11 }
const TIP = { contentStyle: { background: '#0b1322', border: '1px solid #243653', borderRadius: 0, fontSize: 12 }, labelStyle: { color: '#d8e1f1' } }
const COLORS: Record<string, string> = { Low: '#46c48a', Medium: '#f2b84b', High: '#ef5b5b' }

export function RiskDistributionChart() {
  const { snap } = useSim()
  if (!snap) return null
  const data = snap.charts.risk_distribution
  return (
    <Panel title="Risk distribution (zones)" bodyClass="p-3 h-[190px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#1b2a45" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} stroke="#243653" />
          <YAxis allowDecimals={false} tick={AXIS} stroke="#243653" />
          <Tooltip {...TIP} cursor={{ fill: 'rgba(63,208,232,0.06)' }} />
          <Bar dataKey="value" name="Zones" isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={COLORS[d.name]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function RainWaterChart() {
  const { snap } = useSim()
  if (!snap) return null
  const f = snap.forecast
  const past = f.rain_history.slice(0, 2).map((v, i) => ({ label: `-${2 - i} h`, rain: v }))
  const now = f.series.map((s) => ({
    label: s.label, rain: s.rainfall_mm_hr, level: s.level.mid, lo: s.level.lo, hi: s.level.hi,
  }))
  const data = [...past, ...now]
  return (
    <Panel title="Rainfall and water level" bodyClass="p-3 h-[230px]"
      right={<span className="text-[11px] text-fg-dim">past rain reconstructed from trend · forecast from synthetic-trained model</span>}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#1b2a45" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} stroke="#243653" />
          <YAxis yAxisId="rain" tick={AXIS} stroke="#243653" unit=" mm/h" width={60} />
          <YAxis yAxisId="lvl" orientation="right" tick={AXIS} stroke="#243653" unit=" m" width={44} domain={[0, 'auto']} />
          <Tooltip {...TIP} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="rain" dataKey="rain" name="Rainfall (mm/h)" fill="#2a4a7c" isAnimationActive={false} />
          <Line yAxisId="lvl" dataKey="hi" name="Level, upper 80%" stroke="#3fd0e8" strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
          <Line yAxisId="lvl" dataKey="level" name="Water level (m)" stroke="#3fd0e8" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
          <Line yAxisId="lvl" dataKey="lo" name="Level, lower 80%" stroke="#3fd0e8" strokeDasharray="1 5" dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  )
}
