export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Negotiation' | 'Converted' | 'Lost'
export type LeadTemperature = 'Hot' | 'Warm' | 'Cold'
export type LeadIntent = 'High' | 'Medium' | 'Low'

export interface Property {
  id: string
  address: string
  city: string
  state: string
  price: number
  beds: number
  baths: number
  sqft: number
  type: string
  image: string
  amenities: string[]
  description: string
  isDemo: boolean
}

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: string
  createdAt: string
  score: number
  intent: LeadIntent
  temperature: LeadTemperature
  status: LeadStatus
  budget: string
  location: string
  propertyType: string
  timeline: string
  requirements: string
  summary: string
  explanation: string
  nextAction: string
  assignedTo: string
  followUpAt: string | null
  isDemo: boolean
}

export interface Activity {
  id: string
  title: string
  detail: string
  time: string
  kind: 'qualification' | 'match' | 'follow-up' | 'conversion' | 'system'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  propertyIds?: string[]
}

export type ViewName = 'Overview' | 'Leads' | 'Properties' | 'AI assistant' | 'Follow-ups' | 'Insights'
