import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Activity as ActivityIcon, ArrowRight, Bell, Bot, Building2, CalendarClock,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clipboard, Clock3, Command, Compass,
  Download, Filter, Flame, Home, LayoutDashboard, LogOut, Mail, Menu, MessageCircle, MoreHorizontal,
  Plus, Search, Send, Settings2, Sparkles, Target, TrendingUp, Users, WandSparkles, X,
} from 'lucide-react'
import { demoProperties } from './data'
const DashboardCharts = lazy(() => import('./DashboardCharts'))
import { appendConversationMessage, getData, loadConversation, saveActivity, saveFollowupDraft, saveLead, startConversation, updateLead } from './storage'
import { isCloudMode, supabase } from './supabase'
import type { Activity, ChatMessage, Lead, LeadStatus, Property, ViewName } from './types'
import './App.css'

const navigation: { name: ViewName; icon: typeof Home }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Leads', icon: Users },
  { name: 'Properties', icon: Building2 },
  { name: 'AI assistant', icon: MessageCircle },
  { name: 'Follow-ups', icon: CalendarClock },
  { name: 'Insights', icon: TrendingUp },
]
const statuses: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Converted', 'Lost']
const currency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date))
const todayInputValue = () => new Date().toISOString().slice(0, 10)
const currentYear = () => new Date().getFullYear()
const dashboardDate = () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()
const dateInDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString()
const isUpcomingFollowup = (lead: Lead) => Boolean(lead.followUpAt && new Date(lead.followUpAt).getTime() < Date.now() + 7 * 86400000 && !['Converted', 'Lost'].includes(lead.status))
const buildLeadChart = (leads: Lead[]) => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(); date.setDate(date.getDate() - (6 - index)); date.setHours(0, 0, 0, 0)
  const records = leads.filter((lead) => new Date(lead.createdAt).toDateString() === date.toDateString())
  return { day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date), Leads: records.length, Qualified: records.filter((lead) => lead.score >= 60).length }
})
const timeAgo = (date: string) => {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4500)
    return () => window.clearTimeout(timer)
  }, [message, onClose])
  return <div className="toast"><Check size={16} />{message}<button aria-label="Dismiss notification" onClick={onClose}><X size={15} /></button></div>
}

function LeadForm({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (lead: Omit<Lead, 'id' | 'createdAt' | 'isDemo'>, enquiry: string) => void; busy: boolean }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'Website', enquiry: '' })
  const change = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onCreate({
      name: form.name, email: form.email, phone: form.phone, source: form.source, score: 0,
      intent: 'Low', temperature: 'Cold', status: 'New', budget: 'Not specified', location: 'Not specified',
      propertyType: 'Not specified', timeline: 'Not specified', requirements: form.enquiry,
      summary: 'Awaiting AI qualification', explanation: '', nextAction: 'Review enquiry', assignedTo: 'Morgan Lee',
      followUpAt: null,
    }, form.enquiry)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="modal lead-modal" onSubmit={submit}>
        <div className="modal-head"><div><div className="eyebrow"><Sparkles size={14} /> AI-POWERED INTAKE</div><h2>Add a new lead</h2><p>Share the enquiry and EstateAI will qualify it for you.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="form-grid">
          <label>Full name<input required minLength={2} maxLength={120} value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="e.g. Alex Morgan" /></label>
          <label>Email address<input required type="email" maxLength={254} value={form.email} onChange={(e) => change('email', e.target.value)} placeholder="alex@example.com" /></label>
          <label>Phone number<input type="tel" maxLength={32} value={form.phone} onChange={(e) => change('phone', e.target.value)} placeholder="(512) 555-0100" /></label>
          <label>Lead source<select value={form.source} onChange={(e) => change('source', e.target.value)}><option>Website</option><option>Referral</option><option>Zillow</option><option>Open house</option><option>Instagram</option><option>Other</option></select></label>
          <label className="form-wide">Customer enquiry<textarea required minLength={10} maxLength={5000} rows={5} value={form.enquiry} onChange={(e) => change('enquiry', e.target.value)} placeholder="Tell us what they're looking for, their budget, timeline, must-haves…" /></label>
        </div>
        <div className="modal-foot"><span className="privacy-note"><Bot size={15} /> AI will extract preferences and explain its score.</span><button className="button button-primary" disabled={busy}>{busy ? <><span className="spinner" /> Qualifying…</> : <><Sparkles size={16} /> Add & qualify lead</>}</button></div>
      </form>
    </div>
  )
}

function AuthScreen() {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError('')
    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) setError(result.error.message)
    else if (register && !result.data.session) setError('Check your email to confirm your new account, then sign in.')
  }
  return <main className="auth-screen"><div className="auth-card"><Logo /><div className="eyebrow">YOUR REAL ESTATE GROWTH ENGINE</div><h1>{register ? 'Create your workspace' : 'Welcome back'}</h1><p>Turn every enquiry into a better client experience.</p><form onSubmit={submit}><label>Work email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" /></label><label>Password<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>{error && <div className="inline-error">{error}</div>}<button className="button button-primary full-button" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></form><button className="text-button auth-switch" onClick={() => { setRegister(!register); setError('') }}>{register ? 'Already have an account? Sign in' : 'New to EstateAI? Create an account'}</button><div className="auth-secure"><span className="secure-dot" /> Secure workspace powered by Supabase Auth</div></div></main>
}

function Logo() {
  return <div className="brand-lockup"><div className="brand-mark"><Home size={17} strokeWidth={2.5} /></div><span>estate<span className="brand-ai">ai</span></span></div>
}

function Score({ value }: { value: number }) {
  const cls = value >= 75 ? 'hot' : value >= 45 ? 'warm' : 'cold'
  return <span className={`score-pill ${cls}`}><span className="score-dot" />{value}</span>
}

function DetailPanel({ lead, onClose, onStatus, onSchedule, properties }: { lead: Lead; onClose: () => void; onStatus: (status: LeadStatus) => void; onSchedule: (date: string) => void; properties: Property[] }) {
  const matches = recommendProperties(lead, properties).slice(0, 3)
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="detail-drawer"><div className="drawer-top"><span className="eyebrow">LEAD PROFILE</span><button className="icon-button" onClick={onClose} aria-label="Close profile"><X size={18} /></button></div><div className="profile-header"><div className="avatar avatar-large">{lead.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div><div><h2>{lead.name}</h2><span className="muted">{lead.source} · Added {prettyDate(lead.createdAt)}</span></div><Score value={lead.score} /></div><div className="profile-contact"><a href={`mailto:${encodeURIComponent(lead.email)}`}><Mail size={15} />{lead.email}</a><a href={`tel:${encodeURIComponent(lead.phone)}`}><MessageCircle size={15} />{lead.phone || 'No phone provided'}</a></div><div className="drawer-section"><div className="section-title">Lead status</div><select className="status-select" value={lead.status} onChange={(e) => onStatus(e.target.value as LeadStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div className="drawer-section"><div className="section-title">AI qualification</div><div className="score-explainer"><div className={`score-ring ${lead.score >= 75 ? 'hot' : lead.score >= 45 ? 'warm' : 'cold'}`}>{lead.score}<small>/100</small></div><div><strong>{lead.temperature} intent</strong><p>{lead.summary}</p></div></div><div className="explanation-box"><Sparkles size={14} /><span><b>Why this score</b>{lead.explanation || 'Score is based on the buyer’s stated budget, timeline, location, and intent.'}</span></div><div className="next-action-box"><ArrowRight size={14} /><span><b>Suggested next action</b>{lead.nextAction || 'Review enquiry and ask about missing preferences.'}</span></div></div><div className="drawer-section preferences"><div className="section-title">Buyer preferences</div><Preference label="Budget" value={lead.budget} /><Preference label="Location" value={lead.location} /><Preference label="Property" value={lead.propertyType} /><Preference label="Timeline" value={lead.timeline} /><Preference label="Must-haves" value={lead.requirements} /></div><div className="drawer-section"><div className="section-title">Follow-up reminder</div><label className="schedule-label">Next contact date<input type="date" min={todayInputValue()} value={lead.followUpAt?.slice(0, 10) ?? ''} onChange={(event) => { if (event.target.value) onSchedule(new Date(`${event.target.value}T12:00:00`).toISOString()) }} /></label><small className="schedule-help">{lead.followUpAt ? `Scheduled for ${prettyDate(lead.followUpAt)}` : 'Choose a date to create a reminder.'}</small></div><div className="drawer-section"><div className="section-title">Best property matches</div>{matches.length ? matches.map((property) => <div key={property.id} className="mini-match"><img src={property.image} alt="" /><span><b>{property.address}</b><small>{property.matchWhy}</small></span><strong>{property.match}%</strong></div>) : <div className="empty-note">Add preferences to find matching homes.</div>}</div><div className="drawer-assignee"><div className="avatar">ML</div><span><small>ASSIGNED AGENT</small><b>{lead.assignedTo}</b></span><button className="text-button"><MoreHorizontal size={19} /></button></div></aside></div>
}

function Preference({ label, value }: { label: string; value: string }) {
  return <div className="preference-row"><span>{label}</span><b>{value || 'Not specified'}</b></div>
}

function recommendProperties(lead: Lead, properties: Property[]) {
  const location = lead.location.toLowerCase()
  const budgetValues = parseBudget(lead.budget)
  const maxBudget = budgetValues.length ? Math.max(...budgetValues) : 1_000_000
  const minBudget = budgetValues.length > 1 ? Math.min(...budgetValues) : 0
  const needs = lead.requirements.toLowerCase().split(/[,; ]+/).filter((word) => word.length > 3)
  const desiredBedrooms = Number(lead.requirements.match(/\b(\d+)\s*(?:\+|or more)?\s*(?:bed(?:room)?s?|br)\b/i)?.[1] ?? 0)
  return properties.map((property) => {
    let score = 20
    const priceFits = property.price >= minBudget * 0.8 && property.price <= maxBudget * 1.1
    if (priceFits) score += 25
    const locationFits = location.includes(property.city.toLowerCase())
    if (locationFits) score += 25
    const typeFits = lead.propertyType.toLowerCase().includes(property.type.toLowerCase().split(' ')[0]) || property.type.toLowerCase().includes(lead.propertyType.toLowerCase())
    if (typeFits) score += 10
    const bedroomsFit = desiredBedrooms === 0 || property.beds >= desiredBedrooms
    if (bedroomsFit && desiredBedrooms > 0) score += 10
    const matchAmenities = needs.filter((word) => property.amenities.some((amenity) => amenity.toLowerCase().includes(word)) || property.description.toLowerCase().includes(word)).length
    score += Math.min(10, matchAmenities * 3)
    const matchWhy = [priceFits && 'budget fit', locationFits && `${property.city} location`, typeFits && 'property type', desiredBedrooms > 0 && bedroomsFit && `${property.beds}+ bedrooms`, matchAmenities > 0 && 'amenities'].filter(Boolean).join(' · ') || 'General inventory match'
    return { ...property, match: Math.min(99, score), matchWhy }
  }).sort((a, b) => b.match - a.match)
}
function parseBudget(budget: string) {
  const defaultMultiplier = /million|\bm\b/i.test(budget) ? 1_000_000 : /thousand|\bk\b/i.test(budget) ? 1_000 : 1
  return [...budget.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|m|k)?/gi)].map(([, amount, unit]) => {
    const multiplier = /million|^m$/i.test(unit ?? '') ? 1_000_000 : /thousand|^k$/i.test(unit ?? '') ? 1_000 : defaultMultiplier
    return Number(amount.replaceAll(',', '')) * multiplier
  }).filter((amount) => Number.isFinite(amount) && amount > 0)
}

function PropertyCard({ property, match, onRecommend }: { property: Property; match?: number; onRecommend?: () => void }) {
  return <article className="property-card"><div className="property-image-wrap"><img className="property-image" src={property.image} alt={`${property.address}, ${property.city}`} loading="lazy" />{match !== undefined && <span className="match-label"><Sparkles size={12} />{match}% match</span>}</div><div className="property-content"><div className="property-price">{currency(property.price)}</div><h3>{property.address}</h3><div className="property-location">{property.city}, {property.state}</div><div className="property-specs"><span>{property.beds} beds</span><i /><span>{property.baths} baths</span><i /><span>{property.sqft.toLocaleString()} sqft</span></div><div className="property-tags">{property.amenities.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>{onRecommend && <button className="button button-outline property-action" onClick={onRecommend}><MessageCircle size={14} />Draft a recommendation</button>}</div></article>
}

function App() {
  const [view, setView] = useState<ViewName>('Overview')
  const [leads, setLeads] = useState<Lead[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadedDataKey, setLoadedDataKey] = useState('')
  const [dataError, setDataError] = useState<{ key: string; message: string } | null>(null)
  const [toast, setToast] = useState('')
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All status')
  const [sort, setSort] = useState('Recent')
  const [cityFilter, setCityFilter] = useState('All locations')
  const [mobileNav, setMobileNav] = useState(false)
  const [session, setSession] = useState<{ access_token: string } | null>(null)
  const [followupProperty, setFollowupProperty] = useState<Property | null>(null)
  const [aiConfigured, setAiConfigured] = useState(false)
  const dataKey = isCloudMode ? session?.access_token ?? '' : 'demo'
  const loading = Boolean(dataKey) && loadedDataKey !== dataKey && dataError?.key !== dataKey
  const error = dataError?.key === dataKey ? dataError.message : ''

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (isCloudMode && !session) return
    let alive = true
    void getData().then((data) => {
      if (!alive) return
      setLeads(data.leads); setProperties(data.properties); setActivities(data.activities)
      setLoadedDataKey(dataKey); setDataError(null)
    }).catch((reason: unknown) => {
      if (alive) setDataError({ key: dataKey, message: reason instanceof Error ? reason.message : 'Unable to load your workspace.' })
    })
    return () => { alive = false }
  }, [session, dataKey])

  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => {
    let active = true
    void fetch('/api/health').then(async (response) => {
      if (!response.ok) throw new Error(`API health check failed (${response.status}).`)
      const health = await response.json() as { aiConfigured: boolean }
      if (active) setAiConfigured(health.aiConfigured)
    }).catch((reason: unknown) => {
      if (active) notify(reason instanceof Error ? reason.message : 'Could not reach the EstateAI API.')
    })
    return () => { active = false }
  }, [notify])
  const log = async (activity: Activity) => {
    setActivities((current) => [activity, ...current].slice(0, 40))
    try { await saveActivity(activity) }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Could not save this activity.') }
  }
  const api = async <T,>(body: Record<string, unknown>): Promise<T> => {
    const token = session?.access_token
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    const payload = await response.json() as { result?: T; error?: string }
    if (!response.ok || !payload.result) throw new Error(payload.error || 'AI request failed.')
    return payload.result
  }

  const createLead = async (details: Omit<Lead, 'id' | 'createdAt' | 'isDemo'>, enquiry: string) => {
    setCreating(true)
    const newLead: Lead = { ...details, id: crypto.randomUUID(), createdAt: new Date().toISOString(), isDemo: false }
    try {
      const savedId = await saveLead(newLead)
      const lead = { ...newLead, id: savedId }
      setLeads((current) => [lead, ...current])
      await log({ id: crypto.randomUUID(), title: `New enquiry from ${lead.name}`, detail: `${lead.source} · Awaiting qualification`, time: 'Just now', kind: 'system' })
      setShowLeadForm(false)
      try {
        const result = await api<{
          score: number; intent: Lead['intent']; temperature: Lead['temperature']; budget: string; location: string;
          propertyType: string; timeline: string; requirements: string; explanation: string; nextAction: string; summary: string
        }>({ task: 'qualify', name: lead.name, enquiry })
        const qualified = { score: result.score, intent: result.intent, temperature: result.temperature, budget: result.budget, location: result.location, propertyType: result.propertyType, timeline: result.timeline, requirements: result.requirements, summary: result.summary, explanation: result.explanation, nextAction: result.nextAction }
        await updateLead(lead.id, qualified)
        const updated = { ...lead, ...qualified }
        setLeads((current) => current.map((item) => item.id === lead.id ? updated : item))
        await log({ id: crypto.randomUUID(), title: `${lead.name} qualified as ${result.temperature.toLowerCase()} intent`, detail: `Score ${result.score} · ${result.location} · ${result.nextAction}`, time: 'Just now', kind: 'qualification' })
        if (result.score >= 75) await log({ id: crypto.randomUUID(), title: 'Priority lead alert', detail: `${lead.name} scored ${result.score}/100 and needs prompt follow-up.`, time: 'Just now', kind: 'system' })
        notify(`${lead.name} added and AI-qualified`)
      } catch (reason) {
        notify(`Lead saved, but AI qualification failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`)
      }
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Could not save this lead.')
    } finally { setCreating(false) }
  }

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    try {
      await updateLead(lead.id, { status })
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status } : item))
      setSelectedLead((current) => current?.id === lead.id ? { ...current, status } : current)
      await log({ id: crypto.randomUUID(), title: `${lead.name} moved to ${status}`, detail: 'CRM status updated by your team.', time: 'Just now', kind: status === 'Converted' ? 'conversion' : 'system' })
      notify(`Lead moved to ${status}`)
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Could not update lead status.') }
  }

  const scheduleFollowup = async (lead: Lead, date: string) => {
    try {
      await updateLead(lead.id, { followUpAt: date })
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, followUpAt: date } : item))
      setSelectedLead((current) => current?.id === lead.id ? { ...current, followUpAt: date } : current)
      await log({ id: crypto.randomUUID(), title: `Follow-up scheduled for ${lead.name}`, detail: `Reminder set for ${prettyDate(date)}.`, time: 'Just now', kind: 'follow-up' })
      notify(`Follow-up reminder set for ${prettyDate(date)}`)
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Could not schedule follow-up.') }
  }

  const qualified = leads.filter((lead) => lead.score >= 60).length
  const hot = leads.filter((lead) => lead.temperature === 'Hot' && lead.status !== 'Lost' && lead.status !== 'Converted').length
  const converted = leads.filter((lead) => lead.status === 'Converted').length
  const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0
  const pending = leads.filter(isUpcomingFollowup).length
  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const query = search.toLowerCase()
    const matchesText = !query || [lead.name, lead.email, lead.location, lead.source].some((value) => value.toLowerCase().includes(query))
    return matchesText && (statusFilter === 'All status' || lead.status === statusFilter)
  }).sort((a, b) => sort === 'Score' ? b.score - a.score : sort === 'Name' ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt)), [leads, search, statusFilter, sort])
  const filteredProperties = useMemo(() => properties.filter((property) => cityFilter === 'All locations' || property.city === cityFilter), [properties, cityFilter])
  const chartData = useMemo(() => buildLeadChart(leads), [leads])
  const statusData = statuses.map((status) => ({ name: status, value: leads.filter((lead) => lead.status === status).length })).filter((item) => item.value > 0)
  if (isCloudMode && !session) return <AuthScreen />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand"><Logo /><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="workspace-switch"><div className="workspace-mark">N</div><span><b>Northstar Realty</b><small>Workspace</small></span><ChevronDown size={15} /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? 'active' : ''}`} onClick={() => { setView(name); setMobileNav(false) }}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === 'Leads' && <span className="nav-count">{leads.length}</span>}{name === 'Follow-ups' && pending > 0 && <span className="nav-alert" />}</button>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><WandSparkles size={17} /></div><b>Let AI do the busywork</b><p>Qualify, match, and follow up in a fraction of the time.</p><button onClick={() => setView('AI assistant')}>Explore AI <ArrowRight size={14} /></button></div><button className="nav-item settings-nav" onClick={() => notify(isCloudMode ? 'Workspace security is managed in Supabase.' : 'Demo workspace settings')}><Settings2 size={18} />Settings</button><div className="account-row"><div className="avatar">ML</div><span><b>Morgan Lee</b><small>Real estate agent</small></span><button className="icon-button" aria-label="Sign out" onClick={() => { void supabase?.auth.signOut(); notify('Signed out') }}>{isCloudMode ? <LogOut size={16} /> : <MoreHorizontal size={17} />}</button></div></div>
      </aside>
      {mobileNav && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileNav(false)} />}
      <main className="main-shell">
        <header className="topbar"><div className="topbar-left"><button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{view}</b></div></div><div className="topbar-right"><button className="command-search" onClick={() => { setView('Leads'); document.getElementById('lead-search')?.focus() }}><Search size={16} /><span>Search anything…</span><kbd><Command size={11} /> K</kbd></button><button className="top-icon" aria-label="Notifications" onClick={() => notify(`${hot} high-intent leads need a personal follow-up.`)}><Bell size={18} /><i /></button><div className="top-divider" /><div className="top-avatar">ML</div></div></header>
        <div className="content-area">
          {error && <div className="error-banner"><CircleHelp size={17} /><span>{error}</span><button onClick={() => window.location.reload()}>Retry</button></div>}
          {loading ? <div className="loading-panel"><span className="spinner spinner-dark" /><span>Loading your workspace…</span></div> : <>
            {view === 'Overview' && <Dashboard leads={leads} activities={activities} qualified={qualified} hot={hot} conversionRate={conversionRate} pending={pending} chartData={chartData} statusData={statusData} onNewLead={() => setShowLeadForm(true)} onView={setView} onSelect={setSelectedLead} />}
            {view === 'Leads' && <LeadsPage leads={filteredLeads} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sort={sort} setSort={setSort} onNewLead={() => setShowLeadForm(true)} onSelect={setSelectedLead} onStatus={changeStatus} />}
            {view === 'Properties' && <PropertiesPage properties={filteredProperties} cityFilter={cityFilter} setCityFilter={setCityFilter} onRecommend={(property) => { setFollowupProperty(property); setView('Follow-ups') }} />}
            {view === 'AI assistant' && <AssistantPage properties={properties} aiConfigured={aiConfigured} onActivity={log} onError={notify} api={api} />}
            {view === 'Follow-ups' && <FollowupsPage leads={leads} suggestedProperty={followupProperty} onClearProperty={() => setFollowupProperty(null)} onSchedule={(leadId, date) => { const lead = leads.find((item) => item.id === leadId); if (lead) void scheduleFollowup(lead, date) }} onActivity={log} onError={(message) => notify(message)} api={api} />}
            {view === 'Insights' && <InsightsPage leads={leads} api={api} onError={(message) => notify(message)} />}
          </>}
        </div>
        <footer className="app-footer"><span>© {currentYear()} EstateAI, Inc.</span><span className="footer-demo"><i />{isCloudMode ? 'Connected to Supabase' : 'Demo data · stored in this browser'}</span><span>Made for agents, powered by AI <Sparkles size={13} /></span></footer>
      </main>
      {showLeadForm && <LeadForm onClose={() => setShowLeadForm(false)} onCreate={createLead} busy={creating} />}
      {selectedLead && <DetailPanel lead={leads.find((item) => item.id === selectedLead.id) ?? selectedLead} properties={properties} onClose={() => setSelectedLead(null)} onStatus={(status) => void changeStatus(selectedLead, status)} onSchedule={(date) => void scheduleFollowup(selectedLead, date)} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

type DashboardProps = {
  leads: Lead[]; activities: Activity[]; qualified: number; hot: number; conversionRate: number; pending: number;
  chartData: { day: string; Leads: number; Qualified: number }[]; statusData: { name: string; value: number }[];
  onNewLead: () => void; onView: (view: ViewName) => void; onSelect: (lead: Lead) => void
}

function Dashboard({ leads, activities, qualified, hot, conversionRate, pending, chartData, statusData, onNewLead, onView, onSelect }: DashboardProps) {
  const metrics = [
    { label: 'Total leads', value: leads.length, hint: 'Across all channels', icon: Users, tone: 'blue' },
    { label: 'Qualified leads', value: qualified, hint: 'Score of 60 or higher', icon: Target, tone: 'purple' },
    { label: 'High intent', value: hot, hint: 'Ready for a conversation', icon: Flame, tone: 'orange' },
    { label: 'Conversion rate', value: `${conversionRate}%`, hint: `${leads.filter((l) => l.status === 'Converted').length} deals closed`, icon: TrendingUp, tone: 'green' },
  ]
  return <div className="page dashboard-page"><div className="page-heading"><div><div className="eyebrow">{dashboardDate()}</div><h1>Good morning, Morgan <span className="wave">✦</span></h1><p>Here’s what’s happening with your leads today.</p></div><div className="heading-actions"><button className="button button-outline" onClick={() => onView('Insights')}><TrendingUp size={16} />View insights</button><button className="button button-primary" onClick={onNewLead}><Plus size={17} />Add a lead</button></div></div>
    <section className="metric-grid">{metrics.map(({ label, value, hint, icon: Icon, tone }) => <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={17} /></div></div><div className="metric-value">{value}</div><div className="metric-bottom"><span className="metric-hint">{hint}</span><span className="metric-live"><i />LIVE</span></div></article>)}</section>
    <section className="dashboard-panels"><Suspense fallback={<div className="chart-loading">Preparing analytics…</div>}><DashboardCharts chartData={chartData} statusData={statusData} leads={leads.length} qualified={qualified} onView={() => onView('Leads')} /></Suspense></section>
    <section className="bottom-grid"><article className="panel recent-panel"><div className="panel-heading"><div><h2>Recent leads</h2><p>Your latest opportunities</p></div><button className="text-link" onClick={() => onView('Leads')}>View all <ArrowRight size={14} /></button></div><div className="recent-list">{leads.slice(0, 5).map((lead) => <button className="recent-row" key={lead.id} onClick={() => onSelect(lead)}><div className={`avatar ${lead.score >= 75 ? 'avatar-blue' : ''}`}>{lead.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div><span className="recent-person"><b>{lead.name}</b><small>{lead.location || 'Location not set'}</small></span><span className="recent-source">{lead.source}</span><Score value={lead.score} /><span className="recent-time">{timeAgo(lead.createdAt)}</span><ChevronRight size={15} className="recent-chevron" /></button>)}</div></article>
      <article className="panel activity-panel"><div className="panel-heading"><div><h2>AI activity</h2><p>Your agents are on it</p></div><span className="live-pill"><i />LIVE</span></div><div className="activity-list">{activities.slice(0, 4).map((activity) => <div className="activity-row" key={activity.id}><div className={`activity-icon activity-${activity.kind}`}>{activity.kind === 'qualification' ? <Sparkles size={14} /> : activity.kind === 'match' ? <Home size={14} /> : activity.kind === 'conversion' ? <Check size={14} /> : activity.kind === 'follow-up' ? <Clock3 size={14} /> : <ActivityIcon size={14} />}</div><div className="activity-copy"><b>{activity.title}</b><p>{activity.detail}</p><small>{activity.time}</small></div></div>)}</div><button className="activity-view" onClick={() => onView('Insights')}>View activity log <ArrowRight size={14} /></button></article></section>
    <div className="priority-banner"><div className="priority-mark"><Sparkles size={17} /></div><div><b>Your AI team is keeping things moving</b><p>{hot} high-intent {hot === 1 ? 'lead is' : 'leads are'} ready for a personal touch. {pending > 0 ? `${pending} follow-up${pending === 1 ? '' : 's'} coming up.` : 'Keep up the great work.'}</p></div><button onClick={() => onView(hot > 0 ? 'Leads' : 'AI assistant')}>Take a look <ArrowRight size={14} /></button></div>
  </div>
}

function LeadsPage({ leads, search, setSearch, statusFilter, setStatusFilter, sort, setSort, onNewLead, onSelect, onStatus }: {
  leads: Lead[]; search: string; setSearch: (value: string) => void; statusFilter: string;
  setStatusFilter: (value: string) => void; sort: string; setSort: (value: string) => void;
  onNewLead: () => void; onSelect: (lead: Lead) => void; onStatus: (lead: Lead, status: LeadStatus) => void
}) {
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">RELATIONSHIPS, NOT JUST RECORDS</div><h1>Lead management</h1><p>Stay close to every opportunity, from hello to handed-over keys.</p></div><button className="button button-primary" onClick={onNewLead}><Plus size={17} />Add a lead</button></div><div className="lead-summary-strip"><div><Users size={17} /><span><b>{leads.length}</b> leads in your view</span></div><span className="summary-separator" /><div><Flame size={17} /><span><b>{leads.filter((lead) => lead.temperature === 'Hot').length}</b> high-intent leads</span></div><button className="text-link" onClick={() => { setSearch(''); setStatusFilter('All status') }}>Reset filters</button></div><div className="panel leads-panel"><div className="table-toolbar"><div className="table-search"><Search size={16} /><input id="lead-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads, locations…" /></div><div className="toolbar-filters"><label className="filter-control"><Filter size={15} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={13} /></label><label className="filter-control"><span>Sort:</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option>Recent</option><option>Score</option><option>Name</option></select><ChevronDown size={13} /></label><button className="icon-button" title="Export leads" onClick={() => { const csv = ['Name,Email,Phone,Status,Score,Location', ...leads.map((lead) => [lead.name, lead.email, lead.phone, lead.status, lead.score, lead.location].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'estateai-leads.csv'; link.click(); URL.revokeObjectURL(link.href) }}><Download size={16} /></button></div></div><div className="table-scroll"><table className="leads-table"><thead><tr><th>LEAD</th><th>STATUS</th><th>AI SCORE</th><th>BUYER PREFERENCES</th><th>SOURCE</th><th>FOLLOW-UP</th><th /></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} onClick={() => onSelect(lead)}><td><div className="table-person"><div className="avatar">{lead.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div><span><b>{lead.name}</b><small>{lead.email}</small></span></div></td><td onClick={(event) => event.stopPropagation()}><select className={`compact-status status-${lead.status.toLowerCase()}`} aria-label={`Status for ${lead.name}`} value={lead.status} onChange={(e) => void onStatus(lead, e.target.value as LeadStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td><div className="table-score"><Score value={lead.score} /><span>{lead.temperature}</span></div></td><td><span className="pref-main">{lead.location}</span><small className="pref-sub">{lead.budget} · {lead.propertyType}</small></td><td><span className="source-tag">{lead.source}</span></td><td><span className="follow-date">{lead.followUpAt ? <><CalendarClock size={14} />{prettyDate(lead.followUpAt)}</> : <span className="muted">—</span>}</span></td><td><button className="icon-button row-more" aria-label={`View ${lead.name}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>{leads.length === 0 && <div className="empty-state"><div><Search size={22} /></div><h3>No leads found</h3><p>Try a different search or update your filters.</p></div>}<div className="table-footer"><span>Showing <b>{leads.length}</b> leads</span><div><button className="icon-button" disabled><ChevronLeft size={16} /></button><button className="page-number">1</button><button className="icon-button" disabled><ChevronRight size={16} /></button></div></div></div></div>
}

function PropertiesPage({ properties, cityFilter, setCityFilter, onRecommend }: { properties: Property[]; cityFilter: string; setCityFilter: (city: string) => void; onRecommend: (property: Property) => void }) {
  const cities = ['All locations', ...new Set(demoProperties.map((property) => property.city))]
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">A BETTER WAY HOME</div><h1>Property inventory</h1><p>Explore your listings and find the right fit for every buyer.</p></div><button className="button button-outline" onClick={() => setCityFilter('All locations')}><Compass size={16} />All properties</button></div><div className="inventory-toolbar"><div><b>{properties.length}</b> thoughtfully matched homes <span>·</span> <span>Updated just now</span></div><label className="filter-control"><Filter size={15} /><select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>{cities.map((city) => <option key={city}>{city}</option>)}</select><ChevronDown size={14} /></label></div><div className="property-grid">{properties.map((property) => <PropertyCard key={property.id} property={property} onRecommend={() => onRecommend(property)} />)}</div>{properties.length === 0 && <div className="empty-state"><div><Home size={22} /></div><h3>No listings in this location</h3><p>Try another city to see available properties.</p></div>}</div>
}

function AssistantPage({ properties, aiConfigured, onActivity, onError, api }: { properties: Property[]; aiConfigured: boolean; onActivity: (activity: Activity) => void; onError: (message: string) => void; api: <T,>(body: Record<string, unknown>) => Promise<T> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Hi Morgan! I’ve got your property listings ready. Tell me what a buyer is looking for and I’ll find the best matches—or ask me anything about the homes in your portfolio.' }])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyReady, setHistoryReady] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chatError, setChatError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy, bottomRef])
  useEffect(() => {
    let active = true
    void loadConversation().then((history) => {
      if (!active) return
      setConversationId(history.conversationId)
      if (history.messages.length) setMessages(history.messages)
    }).catch((reason: unknown) => { if (active) onError(reason instanceof Error ? reason.message : 'Could not load conversation history.') })
      .finally(() => { if (active) setHistoryReady(true) })
    return () => { active = false }
  }, [onError])
  const send = async (event?: FormEvent, prompt?: string) => {
    event?.preventDefault()
    const message = (prompt ?? draft).trim()
    if (!message || busy || !historyReady) return
    const history = messages.slice(-30).map(({ role, content }) => ({ role, content }))
    const next = [...messages, { role: 'user' as const, content: message }]
    setMessages(next); setDraft(''); setBusy(true); setChatError('')
    try {
      await appendConversationMessage(conversationId, { role: 'user', content: message })
      const result = await api<{ reply: string; propertyIds: string[]; followUpQuestion: string }>({
        task: 'chat', message, history,
        properties: properties.map(({ id, address, city, state, price, beds, baths, type, amenities, description }) => ({ id, address, city, state, price, beds, baths, type, amenities, description })),
      })
      setMessages((current) => [...current, { role: 'assistant', content: result.reply, propertyIds: result.propertyIds }])
      try { await appendConversationMessage(conversationId, { role: 'assistant', content: result.reply }) }
      catch (reason) { onError(reason instanceof Error ? reason.message : 'Could not save assistant response.') }
      if (result.propertyIds.length) onActivity({ id: crypto.randomUUID(), title: `${result.propertyIds.length} property matches found`, detail: 'AI assistant matched homes from your current inventory.', time: 'Just now', kind: 'match' })
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Assistant request failed.'
      setChatError(text)
      onError(text)
    } finally { setBusy(false) }
  }
  const newConversation = async () => {
    try {
      const id = await startConversation()
      setConversationId(id)
      setMessages([{ role: 'assistant', content: 'Fresh start! What kind of home are we looking for today?' }])
      setChatError('')
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Could not start a new conversation.') }
  }
  return <div className="page assistant-page"><div className="page-heading"><div><div className="eyebrow">YOUR ALWAYS-ON REAL ESTATE COPILOT</div><h1>AI assistant</h1><p>A property expert that knows your inventory and remembers the conversation.</p></div><span className={`ai-ready ${aiConfigured ? 'connected' : 'not-connected'}`}><span />{aiConfigured ? 'AI agent ready' : 'AI key required'}</span></div><div className="assistant-layout"><section className="panel chat-panel"><div className="chat-top"><div className="chat-bot-icon"><Bot size={19} /></div><span><b>EstateAI assistant</b><small><i /> Connected to {properties.length} property listings</small></span><button className="icon-button" onClick={() => void newConversation()} aria-label="New conversation"><Plus size={17} /></button></div><div className="chat-messages">{messages.map((message, index) => <div className={`message-row ${message.role}`} key={index}><div className={`chat-avatar ${message.role}`}>{message.role === 'assistant' ? <Sparkles size={14} /> : 'ML'}</div><div className="message-content"><div className="message-bubble">{message.content}</div>{message.propertyIds?.length ? <div className="chat-recommendations">{message.propertyIds.map((id) => properties.find((item) => item.id === id)).filter((item): item is Property => Boolean(item)).map((property) => <div className="chat-property" key={property.id}><img src={property.image} alt="" /><span><b>{property.address}</b><small>{property.city}, {property.state} · {property.beds} bd · {currency(property.price)}</small></span></div>)}</div> : null}<small className="message-time">{message.role === 'assistant' ? 'EstateAI · Just now' : 'You · Just now'}</small></div></div>)}{busy && <div className="message-row assistant"><div className="chat-avatar assistant"><Sparkles size={14} /></div><div className="message-bubble typing"><i /><i /><i /></div></div>}<div ref={(node) => { bottomRef.current = node }} /></div>{chatError && <div className="chat-error"><CircleHelp size={13} />{chatError}<button onClick={() => setChatError('')} aria-label="Dismiss error"><X size={12} /></button></div>}<div className="suggested-prompts"><span>Try asking</span>{['Find 3-bed homes in Austin under $800k', 'Which Miami homes have a pool?', 'What should I ask a first-time buyer?'].map((prompt) => <button key={prompt} onClick={() => void send(undefined, prompt)}>{prompt}</button>)}</div><form className="chat-composer" onSubmit={(event) => void send(event)}><textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} rows={1} placeholder={historyReady ? 'Ask about your listings or a buyer’s needs…' : 'Loading conversation…'} /><button aria-label="Send message" disabled={busy || !draft.trim() || !historyReady}><Send size={17} /></button><span>AI can make mistakes. Verify listing details before sharing.</span></form></section><aside className="assistant-side"><div className="assistant-side-card"><div className="side-card-icon"><Sparkles size={18} /></div><h3>Built around your listings</h3><p>Every recommendation is grounded in your current inventory—not made-up homes.</p><div className="inventory-count"><Building2 size={15} /><b>{properties.length}</b> active properties</div></div><div className="assistant-side-card prompt-card"><h3>Ask better questions</h3><p>The assistant can help uncover what matters most to each buyer.</p>{['Budget & financing', 'Neighborhood priorities', 'Must-have features', 'Buying timeline'].map((text) => <div className="prompt-topic" key={text}><Check size={14} />{text}</div>)}</div><div className="privacy-card"><span><ActivityIcon size={16} /></span><div><b>Context-aware by design</b><p>Conversation context is sent securely to your configured AI provider.</p></div></div></aside></div></div>
}

function FollowupsPage({ leads, suggestedProperty, onClearProperty, onSchedule, onActivity, onError, api }: {
  leads: Lead[]; suggestedProperty: Property | null; onClearProperty: () => void;
  onSchedule: (leadId: string, date: string) => void; onActivity: (activity: Activity) => void;
  onError: (message: string) => void; api: <T,>(body: Record<string, unknown>) => Promise<T>
}) {
  const [leadId, setLeadId] = useState(leads[0]?.id ?? '')
  const [channel, setChannel] = useState(suggestedProperty ? 'Property recommendation' : 'Email')
  const [tone, setTone] = useState('Friendly')
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [reminder, setReminder] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const selectedLead = leads.find((lead) => lead.id === leadId)
  const generate = async () => {
    if (!selectedLead) return
    setBusy(true); setMessage('')
    try {
      const result = await api<{ message: string; subject: string; suggestedReminder: string }>({
        task: 'followup', channel, tone,
        lead: { name: selectedLead.name, budget: selectedLead.budget, location: selectedLead.location, requirements: selectedLead.requirements, nextAction: selectedLead.nextAction, summary: selectedLead.summary },
        ...(suggestedProperty ? { property: { id: suggestedProperty.id, address: suggestedProperty.address, city: suggestedProperty.city, state: suggestedProperty.state, price: suggestedProperty.price, type: suggestedProperty.type, beds: suggestedProperty.beds, amenities: suggestedProperty.amenities } } : {}),
      })
      setMessage(result.message); setSubject(result.subject); setReminder(result.suggestedReminder)
      await saveFollowupDraft(selectedLead.id, channel, result.subject, result.message, suggestedProperty?.id)
      onActivity({ id: crypto.randomUUID(), title: `${channel} draft created for ${selectedLead.name}`, detail: 'AI-generated draft is ready for agent review; nothing was sent.', time: 'Just now', kind: 'follow-up' })
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Could not generate this follow-up.') }
    finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${subject ? `${subject}\n\n` : ''}${message}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { onError('Clipboard access is unavailable in this browser.') }
  }
  const scheduleReminder = () => {
    if (selectedLead) onSchedule(selectedLead.id, dateInDays(2))
  }
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow">THE RIGHT WORDS, RIGHT ON TIME</div><h1>Follow-up studio</h1><p>Personal messages that sound like you. Review and approve before anything goes out.</p></div><span className="approval-pill"><Check size={14} />Nothing sends automatically</span></div>
    <div className="followup-layout">
      <section className="panel followup-form-panel">
        <div className="panel-heading"><div><h2>Compose a follow-up</h2><p>Choose a lead and let AI help with the first draft.</p></div><div className="draft-icon"><WandSparkles size={18} /></div></div>
        <div className="followup-controls">
          <label>Who are we writing to?<select value={leadId} onChange={(e) => setLeadId(e.target.value)}>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.location}</option>)}</select></label>
          <div className="followup-two-col"><label>Message type<select value={channel} onChange={(e) => setChannel(e.target.value)}><option>Email</option><option>WhatsApp</option><option>Property recommendation</option><option>Appointment confirmation</option></select></label><label>Tone<select value={tone} onChange={(e) => setTone(e.target.value)}><option>Friendly</option><option>Professional</option><option>Concise</option></select></label></div>
          <div className="lead-context"><div className="context-avatar">{selectedLead?.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div><div><b>{selectedLead?.name ?? 'Choose a lead'}</b><small>{selectedLead?.summary ?? 'No lead summary available.'}</small><div className="context-tags"><span>{selectedLead?.budget}</span><span>{selectedLead?.timeline}</span><span>{selectedLead?.temperature} intent</span></div></div></div>
          {suggestedProperty && <div className="selected-property"><Building2 size={14} /><span><b>Property in draft</b>{suggestedProperty.address} · {currency(suggestedProperty.price)}</span><button className="icon-button" aria-label="Remove property from draft" onClick={onClearProperty}><X size={14} /></button></div>}
          <button className="button button-primary generate-button" disabled={busy || !selectedLead} onClick={() => void generate()}>{busy ? <><span className="spinner" />Writing a thoughtful draft…</> : <><Sparkles size={16} />Generate with AI</>}</button>
        </div>
      </section>
      <section className="panel draft-panel">
        <div className="draft-top"><div><span className="eyebrow">YOUR DRAFT</span><h2>{message ? 'Ready for your review' : 'A thoughtful note, in seconds'}</h2></div>{message && <div className="draft-tools"><button className="button button-outline" onClick={() => void generate()} disabled={busy}><WandSparkles size={15} />Regenerate</button><button className="button button-outline" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? 'Copied' : 'Copy'}</button></div>}</div>
        {message ? <>
          <div className="draft-editor">{subject && <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>}<label>Message<textarea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} /></label><div className="draft-meta"><span><Sparkles size={14} />AI-generated · Review before sending</span><span>{message.length} characters</span></div></div>
          {reminder && <div className="reminder-suggestion"><CalendarClock size={16} /><span><b>Suggested reminder</b>{reminder}</span><button className="text-link" onClick={scheduleReminder}>Schedule in 2 days</button></div>}
          <div className="send-notice"><CircleHelp size={15} />This is a draft only. Sending requires your approval in your email or messaging app.</div>
        </> : <div className="draft-empty"><div className="draft-empty-icon"><Mail size={24} /></div><h3>Your next great conversation starts here</h3><p>Select a lead and message type, then generate a personalized draft grounded in their preferences.</p><div className="draft-example"><span><Check size={14} />Personalized to the lead</span><span><Check size={14} />Editable before use</span><span><Check size={14} />Never sent automatically</span></div></div>}
      </section>
    </div>
  </div>
}

type InsightResult = { headline: string; summary: string; trends: { title: string; detail: string }[]; recommendations: string[]; dailyBriefing: string }
function InsightsPage({ leads, api, onError }: { leads: Lead[]; api: <T,>(body: Record<string, unknown>) => Promise<T>; onError: (message: string) => void }) {
  const [result, setResult] = useState<InsightResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [generatedAt, setGeneratedAt] = useState('')
  const generate = async () => {
    setBusy(true)
    try {
      const insight = await api<InsightResult>({ task: 'insights', leads: leads.map(({ status, score, location, propertyType, source }) => ({ status, score, location, propertyType, source })) })
      setResult(insight); setGeneratedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Could not generate insights.') }
    finally { setBusy(false) }
  }
  const popular = ['Austin, TX', 'Dallas, TX', 'Miami, FL'].map((city) => ({ city, count: leads.filter((lead) => lead.location.includes(city.split(',')[0])).length })).sort((a, b) => b.count - a.count)
  const types = [...new Set(leads.map((lead) => lead.propertyType).filter((value) => value && value !== 'Not specified'))]
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">SIGNALS BECOME STRATEGY</div><h1>AI insights</h1><p>Understand what’s resonating, where deals are slowing down, and what to do next.</p></div><button className="button button-primary" disabled={busy || leads.length === 0} onClick={() => void generate()}>{busy ? <><span className="spinner" />Analyzing CRM…</> : <><Sparkles size={16} />Generate insights</>}</button></div><div className="insights-summary-grid"><article className="insight-stat"><div className="stat-icon blue"><Users size={17} /></div><span>Lead records analyzed</span><b>{leads.length}</b><small>Live CRM data</small></article><article className="insight-stat"><div className="stat-icon green"><TrendingUp size={17} /></div><span>Converted</span><b>{leads.filter((lead) => lead.status === 'Converted').length}</b><small>{leads.length ? Math.round(leads.filter((lead) => lead.status === 'Converted').length / leads.length * 100) : 0}% of all leads</small></article><article className="insight-stat"><div className="stat-icon orange"><Flame size={17} /></div><span>Avg. intent score</span><b>{leads.length ? Math.round(leads.reduce((sum, lead) => sum + lead.score, 0) / leads.length) : 0}<small>/100</small></b><small>Across active prospects</small></article><article className="insight-stat"><div className="stat-icon purple"><Building2 size={17} /></div><span>Buyer locations</span><b>{new Set(leads.map((lead) => lead.location).filter(Boolean)).size}</b><small>Across the current pipeline</small></article></div>{result ? <div className="insights-results"><section className="panel ai-summary-panel"><div className="ai-summary-label"><span><Sparkles size={15} />ESTATEAI BUSINESS BRIEFING</span><small>Generated {generatedAt}</small></div><h2>{result.headline}</h2><p>{result.summary}</p><div className="daily-brief"><div className="brief-icon"><CalendarClock size={17} /></div><div><b>Daily briefing</b><p>{result.dailyBriefing}</p></div></div></section><div className="insight-detail-grid"><section className="panel insight-list-panel"><div className="panel-heading"><div><h2>What we’re seeing</h2><p>Patterns found in your lead data</p></div></div>{result.trends.map((trend, index) => <div className="trend-item" key={`${trend.title}-${index}`}><div className="trend-number">0{index + 1}</div><div><b>{trend.title}</b><p>{trend.detail}</p></div></div>)}</section><section className="panel insight-list-panel"><div className="panel-heading"><div><h2>Ideas worth trying</h2><p>Practical next steps for your team</p></div></div>{result.recommendations.map((recommendation, index) => <div className="recommendation-item" key={`${recommendation}-${index}`}><div><Check size={15} /></div><p>{recommendation}</p></div>)}</section></div></div> : <div className="insights-layout"><section className="panel insights-prompt-panel"><div className="insights-prompt-icon"><WandSparkles size={22} /></div><div className="eyebrow">YOUR AI BUSINESS ANALYST</div><h2>A clearer picture of what’s working.</h2><p>Generate a fresh read on your customer enquiries. EstateAI will look across lead intent, conversion outcomes, sources, and the places people want to call home.</p><button className="button button-primary" disabled={busy || leads.length === 0} onClick={() => void generate()}>{busy ? 'Analyzing your CRM…' : <><Sparkles size={15} />Build my business briefing</>}</button><span className="data-note"><Check size={14} />Insights are grounded in your actual lead records.</span></section><aside className="insight-side-column"><section className="panel locations-panel"><div className="panel-heading"><div><h2>Popular locations</h2><p>Based on your current leads</p></div><Compass size={18} className="muted-icon" /></div>{popular.map((item, index) => <div className="location-ranking" key={item.city}><span className="location-rank">0{index + 1}</span><span className="location-name">{item.city}<small>{item.count} interested {item.count === 1 ? 'buyer' : 'buyers'}</small></span><div className="location-bar"><i style={{ width: `${leads.length ? Math.max(8, item.count / leads.length * 100) : 0}%` }} /></div></div>)}</section><section className="panel categories-panel"><div className="panel-heading"><div><h2>Property interests</h2><p>Buyer preferences across your pipeline</p></div></div><div className="category-chips">{(types.length ? types : ['No preferences yet']).map((type) => <span key={type}><Home size={13} />{type}</span>)}</div><div className="category-foot"><span><Target size={14} />{types.length} categories represented</span></div></section></aside></div>}</div>
}

export default App
