import { ArrowUpRight, ChevronDown } from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { LeadStatus } from './types'
import './App.css'

const colors = ['#aeb7c5', '#6384f5', '#9c80eb', '#eeb05b', '#4bb28a', '#e28585']
const stages: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Converted', 'Lost']

export default function DashboardCharts({ chartData, statusData, leads, qualified, onView }: {
  chartData: { day: string; Leads: number; Qualified: number }[]
  statusData: { name: string; value: number }[]
  leads: number
  qualified: number
  onView: () => void
}) {
  return <>
    <article className="panel trend-panel">
      <div className="panel-heading"><div><h2>Lead performance</h2><p>New and qualified leads this week</p></div><button className="select-button" onClick={onView}>This week <ChevronDown size={14} /></button></div>
      <div className="chart-legend"><span><i className="legend-leads" />New leads <b>{leads}</b></span><span><i className="legend-qualified" />Qualified <b>{qualified}</b></span></div>
      <div className="line-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6487fa" stopOpacity={0.17} /><stop offset="100%" stopColor="#6487fa" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9098a8', fontSize: 11 }} dy={10} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9098a8', fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8ebf1', boxShadow: '0 12px 30px #15243a12', fontSize: 12 }} /><Area type="monotone" dataKey="Leads" stroke="#6888f7" fill="url(#leadFill)" strokeWidth={2.5} activeDot={{ r: 5 }} /><Area type="monotone" dataKey="Qualified" stroke="#aa8af4" fill="none" strokeWidth={2.2} strokeDasharray="5 5" activeDot={{ r: 4 }} /></AreaChart></ResponsiveContainer></div>
      <div className="chart-axis-caption">Daily enquiry volume · Live CRM data</div>
    </article>
    <article className="panel pipeline-panel">
      <div className="panel-heading"><div><h2>Lead pipeline</h2><p>Where your prospects stand</p></div><button className="icon-button" aria-label="View all leads" onClick={onView}><ArrowUpRight size={17} /></button></div>
      <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={83} paddingAngle={4} stroke="none">{statusData.map((item) => <Cell key={item.name} fill={colors[stages.indexOf(item.name as LeadStatus)] ?? '#d1d5db'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{leads}</strong><span>total leads</span></div></div>
      <div className="pipeline-legend">{statusData.slice(0, 4).map((item) => <div key={item.name}><span><i style={{ backgroundColor: colors[stages.indexOf(item.name as LeadStatus)] ?? '#d1d5db' }} />{item.name}</span><b>{item.value}</b></div>)}</div>
    </article>
  </>
}
