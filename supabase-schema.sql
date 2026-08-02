-- Landscape Management Pro - Phase 1 Supabase schema
create extension if not exists "uuid-ossp";

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  name text not null,
  phone text,
  line_id text,
  address text,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  style text,
  area numeric(12,2) default 0,
  budget numeric(14,2) default 0,
  status text default 'ลูกค้าใหม่',
  progress integer default 0 check (progress between 0 and 100),
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists plants (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  thai_name text not null,
  scientific_name text,
  category text,
  styles text[] default '{}',
  light text,
  water text,
  size_spec text,
  unit text,
  cost numeric(14,2) default 0,
  sale_price numeric(14,2) default 0,
  stock numeric(14,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ai_designs (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  title text not null,
  style text,
  area_label text,
  budget_label text,
  image_url text,
  plants jsonb default '[]',
  materials jsonb default '[]',
  prompt text,
  favorite boolean default false,
  created_at timestamptz default now()
);

alter table customers enable row level security;
alter table projects enable row level security;
alter table plants enable row level security;
alter table ai_designs enable row level security;
