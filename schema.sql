create table pieces (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  name text not null,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table pieces enable row level security;

create policy "leer piezas" on pieces for select using (true);
create policy "generar piezas" on pieces for insert with check (true);

-- Solo permite pasar de used = false a used = true, nunca al revés,
-- y solo si la fila todavía dice used = false. Esto es lo que hace
-- que el "un solo uso" sea real incluso si dos personas suben la
-- misma pieza casi al mismo tiempo.
create policy "canjear una sola vez" on pieces for update
  using (used = false)
  with check (used = true);
