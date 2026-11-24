create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  agency_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  address text not null,
  city text not null,
  state text not null check (state in ('TX', 'FL')),
  price integer not null check (price > 0),
  beds smallint not null check (beds >= 0),
  baths numeric(3,1) not null check (baths >= 0),
  sqft integer not null check (sqft > 0),
  type text not null,
  amenities text[] not null default '{}',
  description text not null default '',
  image_url text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (address, city)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null default '',
  source text not null default 'Website',
  score smallint not null default 0 check (score between 0 and 100),
  intent text not null default 'Low' check (intent in ('High', 'Medium', 'Low')),
  temperature text not null default 'Cold' check (temperature in ('Hot', 'Warm', 'Cold')),
  status text not null default 'New' check (status in ('New', 'Contacted', 'Qualified', 'Negotiation', 'Converted', 'Lost')),
  budget text not null default '',
  location text not null default '',
  property_type text not null default '',
  timeline text not null default '',
  requirements text not null default '',
  summary text not null default '',
  explanation text not null default '',
  next_action text not null default '',
  assigned_to text not null default 'Unassigned',
  follow_up_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null default 'New conversation',
  channel text not null default 'assistant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'agent')),
  content text not null check (char_length(content) <= 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  match_score smallint not null check (match_score between 0 and 100),
  explanation text not null default '',
  created_at timestamptz not null default now(),
  unique (lead_id, property_id)
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  channel text not null check (channel in ('Email', 'WhatsApp', 'Property recommendation', 'Appointment confirmation')),
  subject text not null default '',
  message text not null,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  workflow text not null,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed', 'retrying')),
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  error text,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  event_type text not null,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists leads_user_created_idx on public.leads (user_id, created_at desc);
create index if not exists leads_status_score_idx on public.leads (user_id, status, score desc);
create index if not exists leads_follow_up_idx on public.leads (user_id, follow_up_at) where follow_up_at is not null;
create index if not exists properties_location_price_idx on public.properties (city, price);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists activity_user_created_idx on public.ai_activity_logs (user_id, created_at desc);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
for each row execute procedure public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.recommendations enable row level security;
alter table public.follow_ups enable row level security;
alter table public.workflow_executions enable row level security;
alter table public.ai_activity_logs enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Read own and demo properties" on public.properties for select to authenticated using (is_demo or user_id = (select auth.uid()));
create policy "Manage own properties" on public.properties for all to authenticated using (user_id = (select auth.uid()) and not is_demo) with check (user_id = (select auth.uid()) and not is_demo);

create policy "Read own and demo leads" on public.leads for select to authenticated using (is_demo or user_id = (select auth.uid()));
create policy "Create own leads" on public.leads for insert to authenticated with check (user_id = (select auth.uid()) and not is_demo);
create policy "Update own and demo leads" on public.leads for update to authenticated using (is_demo or user_id = (select auth.uid())) with check (is_demo or user_id = (select auth.uid()));
create policy "Delete own leads" on public.leads for delete to authenticated using (user_id = (select auth.uid()) and not is_demo);

create policy "Manage own conversations" on public.conversations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own messages" on public.messages for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own recommendations" on public.recommendations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own follow ups" on public.follow_ups for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own workflow executions" on public.workflow_executions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own AI activity logs" on public.ai_activity_logs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into public.properties (id,address,city,state,price,beds,baths,sqft,type,amenities,description,image_url,is_demo) values
('10000000-0000-4000-8000-000000000001','1421 Barton Springs Rd','Austin','TX',685000,3,2,1840,'Townhouse',array['Pool','Walkable','Patio'],'Bright modern townhome steps from Zilker Park.','https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000002','804 W 10th St','Austin','TX',925000,4,3,2520,'Single family',array['Garage','Office','Garden'],'Thoughtfully updated Clarksville home with a private garden.','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000003','2213 S 2nd St','Austin','TX',545000,2,2,1420,'Condo',array['Gym','Balcony','EV charging'],'Sleek South Congress condo with skyline views.','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000004','5107 Duval St','Austin','TX',775000,4,3,2380,'Single family',array['Garage','Pool','Smart home'],'Renovated mid-century home in the heart of Hyde Park.','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000005','3900 Speedway','Austin','TX',425000,2,1,980,'Condo',array['Walkable','Laundry','Pet friendly'],'Charming central condo near UT and neighborhood cafes.','https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000006','3628 McKinney Ave','Dallas','TX',620000,3,3,2100,'Townhouse',array['Garage','Rooftop deck','Smart home'],'Contemporary Uptown townhome with rooftop entertaining.','https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000007','7114 Lakehurst Ave','Dallas','TX',485000,4,3,2460,'Single family',array['Garden','Garage','Office'],'Spacious renovated home on a quiet North Dallas street.','https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000008','2400 Victory Park Ln','Dallas','TX',395000,2,2,1280,'Condo',array['Pool','Gym','Concierge'],'Move-in-ready condo with resort-style building amenities.','https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000009','1820 N Henderson Ave','Dallas','TX',795000,4,4,2800,'Townhouse',array['Rooftop deck','Garage','Office'],'Light-filled residence near Henderson Avenue dining.','https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000010','5209 Belmont Ave','Dallas','TX',375000,3,2,1670,'Single family',array['Garden','Pet friendly','Laundry'],'Updated East Dallas bungalow with a generous backyard.','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000011','1428 Brickell Ave','Miami','FL',895000,2,2,1360,'Condo',array['Pool','Gym','Waterfront'],'Waterfront residence with a wraparound bay-view balcony.','https://images.unsplash.com/photo-1600047509782-20d39509f26d?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000012','301 Ocean Dr','Miami','FL',1250000,3,3,1980,'Condo',array['Beach access','Pool','Concierge'],'Oceanfront residence moments from South Beach.','https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000013','4220 SW 12th St','Miami','FL',595000,4,3,2320,'Single family',array['Garden','Garage','Pet friendly'],'A welcoming Coral Gables home with lush outdoor space.','https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000014','1700 N Bayshore Dr','Miami','FL',475000,2,2,1180,'Condo',array['Waterfront','Pool','Gym'],'Bayfront condo with floor-to-ceiling windows and sunset views.','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=82',true),
('10000000-0000-4000-8000-000000000015','6800 SW 58th Ct','Miami','FL',1095000,5,4,3210,'Single family',array['Pool','Garden','Garage'],'Private family home with a pool in a leafy neighborhood.','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82',true)
on conflict (id) do nothing;

insert into public.leads (id,name,email,phone,source,score,intent,temperature,status,budget,location,property_type,timeline,requirements,summary,next_action,assigned_to,follow_up_at,is_demo) values
('20000000-0000-4000-8000-000000000001','Olivia Chen','olivia.chen@example.com','512-555-0142','Website',92,'High','Hot','Qualified','$700k–$850k','Austin, TX','Single family','Within 30 days','4 bedrooms, home office, walkable area','Pre-approved and ready to tour this week.','Schedule property tours','Morgan Lee',null,true),
('20000000-0000-4000-8000-000000000002','Marcus Johnson','marcus.j@example.com','214-555-0198','Referral',86,'High','Hot','Contacted','$450k–$600k','Dallas, TX','Townhouse','1–3 months','Rooftop deck, garage, near dining','Has spoken with a lender and is comparing two neighborhoods.','Share Uptown matches','Alex Rivera',null,true),
('20000000-0000-4000-8000-000000000003','Sofia Rodriguez','sofia.r@example.com','305-555-0114','Zillow',78,'High','Warm','New','$800k–$1M','Miami, FL','Condo','3–6 months','Water views, gym, 2+ bedrooms','Relocating from Chicago and researching the market.','Send waterfront shortlist','Taylor Kim',null,true),
('20000000-0000-4000-8000-000000000004','Ethan Williams','ethan.w@example.com','512-555-0161','Website',64,'Medium','Warm','Negotiation','$500k–$650k','Austin, TX','Condo','Within 30 days','Near South Congress, balcony','Requested HOA details on a South Congress condo.','Follow up on HOA docs','Morgan Lee',now() + interval '1 day',true),
('20000000-0000-4000-8000-000000000005','Priya Patel','priya.p@example.com','214-555-0173','Open house',58,'Medium','Warm','Contacted','$350k–$500k','Dallas, TX','Single family','3–6 months','Quiet street, backyard for a dog','First-time buyer; exploring financing options.','Check in on financing','Alex Rivera',null,true),
('20000000-0000-4000-8000-000000000006','Noah Thompson','noah.t@example.com','305-555-0182','Referral',96,'High','Hot','Converted','$1M–$1.3M','Miami, FL','Single family','Within 30 days','Pool, 4+ bedrooms, gated','Offer accepted after two private showings.','Celebrate closing','Taylor Kim',null,true),
('20000000-0000-4000-8000-000000000007','Ava Martinez','ava.m@example.com','512-555-0127','Realtor.com',41,'Low','Cold','New','Under $450k','Austin, TX','Condo','6+ months','Walkable, pet friendly','Just starting to explore options; flexible timing.','Nurture with market guide','Morgan Lee',null,true),
('20000000-0000-4000-8000-000000000008','Liam Davis','liam.d@example.com','214-555-0104','Website',72,'Medium','Warm','Qualified','$700k–$900k','Dallas, TX','Townhouse','1–3 months','Office, rooftop, 3 bedrooms','Remote worker prioritizing home office and outdoor space.','Book virtual tour','Alex Rivera',null,true),
('20000000-0000-4000-8000-000000000009','Isabella Garcia','isabella.g@example.com','305-555-0156','Instagram',32,'Low','Cold','Lost','$400k–$550k','Miami, FL','Condo','6+ months','Beach access, low HOA','Paused her search while deciding on a move date.','Re-engage next quarter','Taylor Kim',null,true),
('20000000-0000-4000-8000-000000000010','James Wilson','james.w@example.com','512-555-0133','Website',83,'High','Hot','Contacted','$650k–$800k','Austin, TX','Single family','1–3 months','Pool, 3+ bedrooms, smart home','Selling current home; wants to tour Hyde Park this weekend.','Confirm Saturday viewing','Morgan Lee',null,true)
on conflict (id) do nothing;
