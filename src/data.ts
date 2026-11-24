import type { Activity, Lead, Property } from './types'

const photos = [
  'photo-1600596542815-ffad4c1539a9', 'photo-1600607687939-ce8a6c25118c',
  'photo-1600607687920-4e2a09cf159d', 'photo-1600566753086-00f18fb6b3ea',
  'photo-1600566753190-17f0baa2a6c3', 'photo-1600047509807-ba8f99d2cdde',
  'photo-1600585154340-be6161a56a0c', 'photo-1600607687644-c7171b42498f',
  'photo-1600566752355-35792bedcfea', 'photo-1600607687920-4e2a09cf159d',
  'photo-1600047509782-20d39509f26d', 'photo-1600566753190-17f0baa2a6c3',
  'photo-1600585154526-990dced4db0d', 'photo-1600566753086-00f18fb6b3ea',
  'photo-1600607687939-ce8a6c25118c',
]
const img = (index: number) => `https://images.unsplash.com/${photos[index]}?auto=format&fit=crop&w=900&q=82`

export const demoProperties: Property[] = [
  ['1421 Barton Springs Rd', 'Austin', 685000, 3, 2, 1840, 'Townhouse', ['Pool', 'Walkable', 'Patio'], 'Bright modern townhome steps from Zilker Park.'],
  ['804 W 10th St', 'Austin', 925000, 4, 3, 2520, 'Single family', ['Garage', 'Office', 'Garden'], 'Thoughtfully updated Clarksville home with a private garden.'],
  ['2213 S 2nd St', 'Austin', 545000, 2, 2, 1420, 'Condo', ['Gym', 'Balcony', 'EV charging'], 'Sleek South Congress condo with skyline views.'],
  ['5107 Duval St', 'Austin', 775000, 4, 3, 2380, 'Single family', ['Garage', 'Pool', 'Smart home'], 'Renovated mid-century home in the heart of Hyde Park.'],
  ['3900 Speedway', 'Austin', 425000, 2, 1, 980, 'Condo', ['Walkable', 'Laundry', 'Pet friendly'], 'Charming central condo near UT and neighborhood cafes.'],
  ['3628 McKinney Ave', 'Dallas', 620000, 3, 3, 2100, 'Townhouse', ['Garage', 'Rooftop deck', 'Smart home'], 'Contemporary Uptown townhome with rooftop entertaining.'],
  ['7114 Lakehurst Ave', 'Dallas', 485000, 4, 3, 2460, 'Single family', ['Garden', 'Garage', 'Office'], 'Spacious renovated home on a quiet North Dallas street.'],
  ['2400 Victory Park Ln', 'Dallas', 395000, 2, 2, 1280, 'Condo', ['Pool', 'Gym', 'Concierge'], 'Move-in-ready condo with resort-style building amenities.'],
  ['1820 N Henderson Ave', 'Dallas', 795000, 4, 4, 2800, 'Townhouse', ['Rooftop deck', 'Garage', 'Office'], 'Light-filled residence near Henderson Avenue dining.'],
  ['5209 Belmont Ave', 'Dallas', 375000, 3, 2, 1670, 'Single family', ['Garden', 'Pet friendly', 'Laundry'], 'Updated East Dallas bungalow with a generous backyard.'],
  ['1428 Brickell Ave', 'Miami', 895000, 2, 2, 1360, 'Condo', ['Pool', 'Gym', 'Waterfront'], 'Waterfront residence with a wraparound bay-view balcony.'],
  ['301 Ocean Dr', 'Miami', 1250000, 3, 3, 1980, 'Condo', ['Beach access', 'Pool', 'Concierge'], 'Oceanfront residence moments from South Beach.'],
  ['4220 SW 12th St', 'Miami', 595000, 4, 3, 2320, 'Single family', ['Garden', 'Garage', 'Pet friendly'], 'A welcoming Coral Gables home with lush outdoor space.'],
  ['1700 N Bayshore Dr', 'Miami', 475000, 2, 2, 1180, 'Condo', ['Waterfront', 'Pool', 'Gym'], 'Bayfront condo with floor-to-ceiling windows and sunset views.'],
  ['6800 SW 58th Ct', 'Miami', 1095000, 5, 4, 3210, 'Single family', ['Pool', 'Garden', 'Garage'], 'Private family home with a pool in a leafy neighborhood.'],
].map((p, index) => ({
  id: `demo-property-${index + 1}`, address: p[0] as string, city: p[1] as string,
  state: p[1] === 'Miami' ? 'FL' : 'TX', price: p[2] as number, beds: p[3] as number,
  baths: p[4] as number, sqft: p[5] as number, type: p[6] as string, amenities: p[7] as string[],
  description: p[8] as string, image: img(index), isDemo: true,
}))

const today = new Date()
const daysAgo = (days: number) => new Date(today.getTime() - days * 86400000).toISOString()
export const demoLeads: Lead[] = [
  ['Olivia Chen', 'olivia.chen@example.com', '512-555-0142', 'Website', 92, 'Hot', 'Qualified', '$700k–$850k', 'Austin, TX', 'Single family', 'Within 30 days', '4 bedrooms, home office, walkable area', 'Pre-approved and ready to tour this week.', 'Schedule property tours'],
  ['Marcus Johnson', 'marcus.j@example.com', '214-555-0198', 'Referral', 86, 'Hot', 'Contacted', '$450k–$600k', 'Dallas, TX', 'Townhouse', '1–3 months', 'Rooftop deck, garage, near dining', 'Has spoken with a lender and is comparing two neighborhoods.', 'Share Uptown matches'],
  ['Sofia Rodriguez', 'sofia.r@example.com', '305-555-0114', 'Zillow', 78, 'Warm', 'New', '$800k–$1M', 'Miami, FL', 'Condo', '3–6 months', 'Water views, gym, 2+ bedrooms', 'Relocating from Chicago and researching the market.', 'Send waterfront shortlist'],
  ['Ethan Williams', 'ethan.w@example.com', '512-555-0161', 'Website', 64, 'Warm', 'Negotiation', '$500k–$650k', 'Austin, TX', 'Condo', 'Within 30 days', 'Near South Congress, balcony', 'Requested HOA details on a South Congress condo.', 'Follow up on HOA docs'],
  ['Priya Patel', 'priya.p@example.com', '214-555-0173', 'Open house', 58, 'Warm', 'Contacted', '$350k–$500k', 'Dallas, TX', 'Single family', '3–6 months', 'Quiet street, backyard for a dog', 'First-time buyer; exploring financing options.', 'Check in on financing'],
  ['Noah Thompson', 'noah.t@example.com', '305-555-0182', 'Referral', 96, 'Hot', 'Converted', '$1M–$1.3M', 'Miami, FL', 'Single family', 'Within 30 days', 'Pool, 4+ bedrooms, gated', 'Offer accepted after two private showings.', 'Celebrate closing'],
  ['Ava Martinez', 'ava.m@example.com', '512-555-0127', 'Realtor.com', 41, 'Cold', 'New', 'Under $450k', 'Austin, TX', 'Condo', '6+ months', 'Walkable, pet friendly', 'Just starting to explore options; flexible timing.', 'Nurture with market guide'],
  ['Liam Davis', 'liam.d@example.com', '214-555-0104', 'Website', 72, 'Warm', 'Qualified', '$700k–$900k', 'Dallas, TX', 'Townhouse', '1–3 months', 'Office, rooftop, 3 bedrooms', 'Remote worker prioritizing home office and outdoor space.', 'Book virtual tour'],
  ['Isabella Garcia', 'isabella.g@example.com', '305-555-0156', 'Instagram', 32, 'Cold', 'Lost', '$400k–$550k', 'Miami, FL', 'Condo', '6+ months', 'Beach access, low HOA', 'Paused her search while deciding on a move date.', 'Re-engage next quarter'],
  ['James Wilson', 'james.w@example.com', '512-555-0133', 'Website', 83, 'Hot', 'Contacted', '$650k–$800k', 'Austin, TX', 'Single family', '1–3 months', 'Pool, 3+ bedrooms, smart home', 'Selling current home; wants to tour Hyde Park this weekend.', 'Confirm Saturday viewing'],
].map((lead, index) => ({
  id: `demo-lead-${index + 1}`, name: lead[0] as string, email: lead[1] as string,
  phone: lead[2] as string, source: lead[3] as string, createdAt: daysAgo(index),
  score: lead[4] as number, intent: (lead[4] as number) >= 75 ? 'High' : (lead[4] as number) >= 45 ? 'Medium' : 'Low',
  temperature: lead[5] as Lead['temperature'],
  status: lead[6] as Lead['status'], budget: lead[7] as string, location: lead[8] as string,
  propertyType: lead[9] as string, timeline: lead[10] as string, requirements: lead[11] as string,
  summary: lead[12] as string, explanation: 'Demonstration score based on the buyer’s stated budget, timeline, and intent.',
  nextAction: lead[13] as string, assignedTo: ['Morgan Lee', 'Alex Rivera', 'Taylor Kim'][index % 3],
  followUpAt: index === 3 ? new Date(Date.now() + 86400000).toISOString() : null, isDemo: true,
}))

export const demoActivities: Activity[] = [
  { id: 'a1', title: 'Olivia Chen qualified as high intent', detail: 'Score 92 · Austin, TX · Website enquiry', time: '2 min ago', kind: 'qualification' },
  { id: 'a2', title: '3 properties matched Marcus Johnson', detail: 'Uptown Dallas · Rooftop deck · $450k–$600k', time: '18 min ago', kind: 'match' },
  { id: 'a3', title: 'Follow-up due tomorrow', detail: 'Ethan Williams · South Congress condo', time: '1 hr ago', kind: 'follow-up' },
  { id: 'a4', title: 'Noah Thompson converted', detail: 'Miami, FL · $1M–$1.3M budget', time: '3 hrs ago', kind: 'conversion' },
]
