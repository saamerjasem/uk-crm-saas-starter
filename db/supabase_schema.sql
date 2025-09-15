-- Postgres schema for UK CRM SaaS, multi-tenant with RLS

create extension if not exists "uuid-ossp";

-- tenants and domains
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  region text default 'UK',
  plan text default 'starter',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists domains (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  hostname text not null unique,
  primary_domain boolean default true,
  created_at timestamptz default now()
);

-- core CRM tables
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  domain text,
  phone text,
  address_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  job_title text,
  owner_id uuid,
  created_at timestamptz default now()
);

create table if not exists pipelines (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists stages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  default_probability int default 50
);

create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  value numeric(12,2) default 0,
  currency text default 'GBP',
  pipeline_id uuid references pipelines(id) on delete set null,
  stage_id uuid references stages(id) on delete set null,
  probability int default 50,
  close_date date,
  owner_id uuid,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null default 'note',
  subject text,
  body text,
  due_at timestamptz,
  done_at timestamptz,
  user_id uuid,
  deal_id uuid references deals(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists quotes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  number text,
  status text default 'draft',
  subtotal numeric(12,2) default 0,
  tax numeric(12,2) default 0,
  total numeric(12,2) generated always as (subtotal + tax) stored,
  pdf_key text,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stripe_customer_id text,
  stripe_sub_id text,
  plan text default 'starter',
  status text default 'active',
  renews_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid,
  action text not null,
  object_type text not null,
  object_id uuid,
  meta_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- helper function to ensure defaults
create or replace function ensure_default_pipeline_and_stage() returns void as $$
declare p_id uuid;
declare s_id uuid;
begin
  select id into p_id from pipelines limit 1;
  if p_id is null then
    insert into pipelines(tenant_id, name) values (uuid(nil), 'Default') returning id into p_id;
  end if;
  select id into s_id from stages where pipeline_id = p_id order by order_index limit 1;
  if s_id is null then
    insert into stages(tenant_id, pipeline_id, name, order_index) values (uuid(nil), p_id, 'New', 0);
  end if;
end;
$$ language plpgsql;

-- GUC based RLS
alter table tenants enable row level security;
alter table domains enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table deals enable row level security;
alter table activities enable row level security;
alter table quotes enable row level security;
alter table subscriptions enable row level security;
alter table audit_log enable row level security;

-- Allow admin full access
do $$
declare tbl record;
begin
  for tbl in
    select tablename from pg_tables where schemaname = 'public' and tablename in
      ('tenants','domains','companies','contacts','pipelines','stages','deals','activities','quotes','subscriptions','audit_log')
  loop
    execute format('
      create policy admin_all on %I
      using ( current_setting(''app.role'', true) = ''admin'' )
      with check ( current_setting(''app.role'', true) = ''admin'' );
    ', tbl.tablename);
  end loop;
end $$;

-- Tenant scoped policies
create policy tenant_isolation_companies on companies
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_contacts on contacts
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_pipelines on pipelines
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_stages on stages
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_deals on deals
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_activities on activities
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_quotes on quotes
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_subscriptions on subscriptions
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

create policy tenant_isolation_audit on audit_log
  using ( tenant_id = current_setting('app.tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.tenant_id', true)::uuid );

-- Domains and tenants read policy to resolve the tenant by host
create policy tenant_domains_read on domains
  for select using ( true );
create policy tenant_tenants_read on tenants
  for select using ( true );

-- Seed a demo tenant and domain
insert into tenants(name, plan, status) values ('Demo Ltd', 'pro', 'active')
  on conflict do nothing;
insert into domains(tenant_id, hostname, primary_domain)
select id, 'demo.local', true from tenants where name = 'Demo Ltd'
on conflict do nothing;

-- Note: for Supabase, also set RLS to "enabled" at the table level and ensure auth is configured.
