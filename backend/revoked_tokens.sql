create table if not exists public.revoked_tokens (
  jti uuid primary key,
  reason text not null
);
alter table public.revoked_tokens enable row level security;
revoke all on public.revoked_tokens from public, anon, authenticated;
grant select, insert on public.revoked_tokens to service_role;
