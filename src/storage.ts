import { demoActivities, demoLeads, demoProperties } from './data'
import { isCloudMode, supabase } from './supabase'
import type { Activity, ChatMessage, Lead, Property } from './types'

const KEYS = { leads: 'estateai-leads-v1', activities: 'estateai-activities-v1' }
const load = <T,>(key: string, initial: T): T => {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : initial
  } catch (reason) {
    throw new Error(`Could not read saved workspace data (${key}). Clear the corrupted browser record and retry: ${reason instanceof Error ? reason.message : String(reason)}`)
  }
}
const save = <T,>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value))

const mapLead = (row: Record<string, unknown>): Lead => ({
  id: String(row.id), name: String(row.name), email: String(row.email ?? ''), phone: String(row.phone ?? ''),
  source: String(row.source ?? 'Website'), createdAt: String(row.created_at),
  score: Number(row.score ?? 0), intent: (row.intent ?? 'Low') as Lead['intent'],
  temperature: (row.temperature ?? 'Cold') as Lead['temperature'],
  status: (row.status ?? 'New') as Lead['status'], budget: String(row.budget ?? ''),
  location: String(row.location ?? ''), propertyType: String(row.property_type ?? ''),
  timeline: String(row.timeline ?? ''), requirements: String(row.requirements ?? ''),
  summary: String(row.summary ?? ''), explanation: String(row.explanation ?? ''), nextAction: String(row.next_action ?? ''),
  assignedTo: String(row.assigned_to ?? 'Unassigned'), followUpAt: row.follow_up_at ? String(row.follow_up_at) : null,
  isDemo: Boolean(row.is_demo),
})

export async function getData() {
  if (isCloudMode && supabase) {
    const [leadResult, propertyResult, activityResult] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('properties').select('*').order('price'),
      supabase.from('ai_activity_logs').select('*').order('created_at', { ascending: false }).limit(40),
    ])
    if (leadResult.error) throw new Error(`Could not load leads: ${leadResult.error.message}`)
    if (propertyResult.error) throw new Error(`Could not load properties: ${propertyResult.error.message}`)
    if (activityResult.error) throw new Error(`Could not load activity history: ${activityResult.error.message}`)
    const leads = (leadResult.data ?? []).map((row) => mapLead(row as Record<string, unknown>))
    const properties: Property[] = (propertyResult.data ?? []).map((row) => ({
      id: String(row.id), address: String(row.address), city: String(row.city), state: String(row.state),
      price: Number(row.price), beds: Number(row.beds), baths: Number(row.baths), sqft: Number(row.sqft),
      type: String(row.type), amenities: row.amenities as string[], description: String(row.description ?? ''),
      image: String(row.image_url ?? ''), isDemo: Boolean(row.is_demo),
    }))
    const activities: Activity[] = (activityResult.data ?? []).map((row) => ({
      id: String(row.id), title: String(row.title), detail: String(row.detail),
      time: row.created_at ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(String(row.created_at))) : 'Earlier',
      kind: (row.event_type ?? 'system') as Activity['kind'],
    }))
    return { leads, properties, activities }
  }
  const leads = load<Lead[]>(KEYS.leads, demoLeads)
  const properties = demoProperties
  const activities = load<Activity[]>(KEYS.activities, demoActivities)
  if (!localStorage.getItem(KEYS.leads)) save(KEYS.leads, leads)
  if (!localStorage.getItem(KEYS.activities)) save(KEYS.activities, activities)
  return { leads, properties, activities }
}

export async function saveLead(lead: Lead): Promise<string> {
  if (isCloudMode && supabase) {
    const { data, error } = await supabase.from('leads').insert({
      name: lead.name, email: lead.email, phone: lead.phone, source: lead.source,
      score: lead.score, intent: lead.intent, temperature: lead.temperature, status: lead.status, budget: lead.budget,
      location: lead.location, property_type: lead.propertyType, timeline: lead.timeline,
      requirements: lead.requirements, summary: lead.summary, explanation: lead.explanation, next_action: lead.nextAction,
      assigned_to: lead.assignedTo, follow_up_at: lead.followUpAt,
    }).select('id').single()
    if (error) throw new Error(`Could not save lead: ${error.message}`)
    return String(data.id)
  } else {
    save(KEYS.leads, [lead, ...load<Lead[]>(KEYS.leads, demoLeads)])
    return lead.id
  }
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  if (isCloudMode && supabase) {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.status) dbUpdates.status = updates.status
    if (updates.score !== undefined) dbUpdates.score = updates.score
    if (updates.intent) dbUpdates.intent = updates.intent
    if (updates.temperature) dbUpdates.temperature = updates.temperature
    if (updates.budget !== undefined) dbUpdates.budget = updates.budget
    if (updates.location !== undefined) dbUpdates.location = updates.location
    if (updates.propertyType !== undefined) dbUpdates.property_type = updates.propertyType
    if (updates.timeline !== undefined) dbUpdates.timeline = updates.timeline
    if (updates.requirements !== undefined) dbUpdates.requirements = updates.requirements
    if (updates.summary !== undefined) dbUpdates.summary = updates.summary
    if (updates.explanation !== undefined) dbUpdates.explanation = updates.explanation
    if (updates.nextAction !== undefined) dbUpdates.next_action = updates.nextAction
    if (updates.followUpAt !== undefined) dbUpdates.follow_up_at = updates.followUpAt
    const { error } = await supabase.from('leads').update(dbUpdates).eq('id', id)
    if (error) throw new Error(`Could not update lead: ${error.message}`)
  } else {
    const leads = load<Lead[]>(KEYS.leads, demoLeads).map((lead) => lead.id === id ? { ...lead, ...updates } : lead)
    save(KEYS.leads, leads)
  }
}

export async function saveActivity(activity: Activity) {
  const activities = [activity, ...load<Activity[]>(KEYS.activities, demoActivities)].slice(0, 40)
  save(KEYS.activities, activities)
  if (isCloudMode && supabase) {
    const { error } = await supabase.from('ai_activity_logs').insert({ event_type: activity.kind, title: activity.title, detail: activity.detail })
    if (error) throw new Error(`Could not save activity log: ${error.message}`)
    const { error: workflowError } = await supabase.from('workflow_executions').insert({
      workflow: activity.kind, status: 'completed', input: { title: activity.title }, output: { detail: activity.detail }, completed_at: new Date().toISOString(),
    })
    if (workflowError) throw new Error(`Could not save workflow execution: ${workflowError.message}`)
  }
}

const CHAT_KEY = 'estateai-chat-history-v1'
export async function loadConversation() {
  if (isCloudMode && supabase) {
    let { data: conversations, error } = await supabase.from('conversations').select('id').eq('channel', 'assistant').order('updated_at', { ascending: false }).limit(1)
    if (error) throw new Error(`Could not load conversations: ${error.message}`)
    let conversationId = conversations?.[0]?.id as string | undefined
    if (!conversationId) {
      const created = await supabase.from('conversations').insert({ title: 'Property assistant', channel: 'assistant' }).select('id').single()
      if (created.error) throw new Error(`Could not create conversation: ${created.error.message}`)
      conversationId = String(created.data.id)
    }
    const { data, error: messageError } = await supabase.from('messages').select('role,content').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(60)
    if (messageError) throw new Error(`Could not load conversation messages: ${messageError.message}`)
    const messages = (data ?? []).map((row) => ({ role: row.role as 'user' | 'assistant', content: String(row.content) }))
    return { conversationId, messages }
  }
  return { conversationId: null, messages: load<ChatMessage[]>(CHAT_KEY, []) }
}

export async function appendConversationMessage(conversationId: string | null, message: ChatMessage) {
  if (isCloudMode && supabase) {
    if (!conversationId) throw new Error('Conversation is not ready. Please start a new chat.')
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId, role: message.role, content: message.content,
    })
    if (error) throw new Error(`Could not save conversation: ${error.message}`)
    const { error: updateError } = await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
    if (updateError) throw new Error(`Could not update conversation: ${updateError.message}`)
  } else {
    const messages = [...load<ChatMessage[]>(CHAT_KEY, []), message].slice(-60)
    save(CHAT_KEY, messages)
  }
}

export async function startConversation() {
  if (isCloudMode && supabase) {
    const { data, error } = await supabase.from('conversations').insert({ title: 'Property assistant', channel: 'assistant' }).select('id').single()
    if (error) throw new Error(`Could not start conversation: ${error.message}`)
    return String(data.id)
  }
  save(CHAT_KEY, [])
  return null
}

export async function saveFollowupDraft(leadId: string, channel: string, subject: string, message: string, propertyId?: string) {
  if (isCloudMode && supabase) {
    const { error } = await supabase.from('follow_ups').insert({
      lead_id: leadId, channel, subject, message, property_id: propertyId, status: 'draft',
    })
    if (error) throw new Error(`Could not save follow-up draft: ${error.message}`)
  } else {
    const key = 'estateai-followups-v1'
    const drafts = load<Record<string, unknown>[]>(key, [])
    save(key, [{ id: crypto.randomUUID(), leadId, propertyId, channel, subject, message, createdAt: new Date().toISOString() }, ...drafts].slice(0, 30))
  }
}
