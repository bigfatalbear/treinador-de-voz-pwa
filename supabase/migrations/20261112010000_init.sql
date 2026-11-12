-- TREINADOR DE VOZ - Supabase schema, RLS and RPCs
-- Branding UUID: 2dfce9de-de4b-57ae-a291-a170c20195cd

create extension if not exists pgcrypto;

create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  choir_id text not null default 'principal',
  name text not null check (char_length(name) between 2 and 80),
  email text not null,
  role text not null default 'coralista' check (role in ('regente', 'coralista')),
  voice_part text not null default 'soprano'
    check (voice_part in ('soprano', 'contralto', 'tenor', 'baixo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  title text not null check (char_length(title) between 2 and 140),
  body text not null check (char_length(body) between 2 and 5000),
  author_name text not null check (char_length(author_name) <= 80),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  title text not null check (char_length(title) between 2 and 140),
  composer text check (composer is null or char_length(composer) <= 140),
  bpm integer not null default 100 check (bpm between 50 and 150),
  lyrics text check (lyrics is null or char_length(lyrics) <= 20000),
  demo boolean not null default false,
  parts jsonb not null default '{}'::jsonb check (jsonb_typeof(parts) = 'object'),
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  title text not null check (char_length(title) between 2 and 140),
  pdf_path text not null check (char_length(pdf_path) <= 500),
  created_at timestamptz not null default now()
);

create table public.warmups (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '',
  audio_path text not null default '' check (char_length(audio_path) <= 500),
  category text not null default 'Aquecimento',
  created_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  title text not null check (char_length(title) between 2 and 140),
  event_date date not null,
  author_name text not null check (char_length(author_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  value text not null check (value in ('sim', 'nao', 'talvez')),
  name text not null check (char_length(name) <= 80),
  updated_at timestamptz not null default now(),
  primary key (poll_id, member_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  room text not null check (room in ('geral', 'soprano', 'contralto', 'tenor', 'baixo')),
  text text check (text is null or (char_length(text) between 1 and 2000)),
  audio_path text check (audio_path is null or char_length(audio_path) <= 500),
  audio_duration integer check (audio_duration is null or audio_duration between 1 and 60),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) <= 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  check (text is not null or audio_path is not null)
);

create table public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create index members_choir_idx on public.members (choir_id);
create index notices_choir_created_idx on public.notices (choir_id, created_at);
create index tracks_choir_created_idx on public.tracks (choir_id, created_at);
create index scores_choir_created_idx on public.scores (choir_id, created_at);
create index warmups_choir_created_idx on public.warmups (choir_id, created_at);
create index polls_choir_created_idx on public.polls (choir_id, created_at);
create index poll_votes_poll_idx on public.poll_votes (poll_id, updated_at);
create index messages_room_created_idx on public.messages (choir_id, room, created_at);
create index messages_expires_idx on public.messages (expires_at);

alter table public.members enable row level security;
alter table public.notices enable row level security;
alter table public.tracks enable row level security;
alter table public.scores enable row level security;
alter table public.warmups enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.messages enable row level security;
alter table public.app_secrets enable row level security;

create or replace function public.is_member(p_choir text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and choir_id = p_choir
  );
$$;

create or replace function public.is_regent(p_choir text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and choir_id = p_choir and role = 'regente'
  );
$$;

create or replace function public.can_use_room(p_choir text, p_room text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid()
      and choir_id = p_choir
      and (p_room = 'geral' or role = 'regente' or voice_part = p_room)
  );
$$;

create or replace function public.is_regent_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_secrets s,
      unnest(string_to_array(coalesce(s.value, ''), ',')) as allowed(email)
    where s.key = 'regent_emails'
      and lower(btrim(allowed.email)) = lower(btrim(coalesce(p_email, '')))
      and btrim(coalesce(p_email, '')) <> ''
  );
$$;

create or replace function public.sync_regent_role()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_existing public.members%rowtype;
  v_regent boolean;
begin
  if v_uid is null then
    raise exception 'Sessão não encontrada.' using errcode = '42501';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Coralista'
  );
  v_regent := public.is_regent_email(v_email);

  select * into v_existing from public.members where id = v_uid;

  if v_regent then
    insert into public.members (id, choir_id, name, email, role, voice_part, updated_at)
    values (
      v_uid,
      'principal',
      left(v_name, 80),
      v_email,
      'regente',
      coalesce(v_existing.voice_part, 'soprano'),
      now()
    )
    on conflict (id) do update
      set email = excluded.email,
          role = 'regente',
          updated_at = now();
    return jsonb_build_object('regent', true);
  end if;

  if v_existing.id is not null and v_existing.role = 'regente' then
    update public.members
      set role = 'coralista', updated_at = now()
      where id = v_uid;
  end if;

  return jsonb_build_object('regent', false);
end;
$$;

create or replace function public.join_choir(
  p_code text,
  p_voice_part text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_expected text;
  v_role text;
begin
  if v_uid is null then
    raise exception 'Sessão não encontrada.' using errcode = '42501';
  end if;

  select value into v_expected from public.app_secrets where key = 'invite_code';
  if v_expected is null or btrim(coalesce(p_code, '')) <> btrim(v_expected) then
    raise exception 'Código de convite inválido.' using errcode = '42501';
  end if;

  if p_voice_part not in ('soprano', 'contralto', 'tenor', 'baixo') then
    raise exception 'Naipe inválido.' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Informe seu nome com pelo menos 2 caracteres.' using errcode = '22023';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_role := case when public.is_regent_email(v_email) then 'regente' else 'coralista' end;

  insert into public.members (id, choir_id, name, email, role, voice_part, created_at, updated_at)
  values (v_uid, 'principal', v_name, v_email, v_role, p_voice_part, now(), now())
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        role = excluded.role,
        voice_part = excluded.voice_part,
        updated_at = now();

  return jsonb_build_object(
    'id', v_uid,
    'name', v_name,
    'email', v_email,
    'role', v_role,
    'voicePart', p_voice_part
  );
end;
$$;

create policy members_select on public.members
  for select to authenticated
  using (id = auth.uid() or public.is_regent(choir_id));

create policy members_update_self on public.members
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy notices_select on public.notices
  for select to authenticated using (public.is_member(choir_id));
create policy notices_write on public.notices
  for all to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));

create policy tracks_select on public.tracks
  for select to authenticated using (public.is_member(choir_id));
create policy tracks_write on public.tracks
  for all to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));

create policy scores_select on public.scores
  for select to authenticated using (public.is_member(choir_id));
create policy scores_write on public.scores
  for all to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));

create policy warmups_select on public.warmups
  for select to authenticated using (public.is_member(choir_id));
create policy warmups_write on public.warmups
  for all to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));

create policy polls_select on public.polls
  for select to authenticated using (public.is_member(choir_id));
create policy polls_write on public.polls
  for all to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));

create policy poll_votes_select on public.poll_votes
  for select to authenticated
  using (exists (
    select 1 from public.polls p
    where p.id = poll_votes.poll_id and public.is_member(p.choir_id)
  ));
create policy poll_votes_insert on public.poll_votes
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id and public.is_member(p.choir_id)
    )
  );
create policy poll_votes_update on public.poll_votes
  for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());
create policy poll_votes_delete on public.poll_votes
  for delete to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id and public.is_regent(p.choir_id)
    )
  );

create policy messages_select on public.messages
  for select to authenticated
  using (public.can_use_room(choir_id, room) and expires_at > now());
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    public.can_use_room(choir_id, room)
    and author_id = auth.uid()
    and expires_at > now()
  );
create policy messages_update on public.messages
  for update to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));
create policy messages_delete on public.messages
  for delete to authenticated
  using (public.is_regent(choir_id) or author_id = auth.uid());

revoke all on public.app_secrets from anon, authenticated;
revoke all on public.members from anon;
revoke insert, delete on public.members from authenticated;
revoke update on public.members from authenticated;
grant select on public.members to authenticated;
grant update (name, voice_part, updated_at) on public.members to authenticated;

revoke all on public.notices, public.tracks, public.scores, public.warmups,
  public.polls, public.poll_votes, public.messages from anon;
grant select, insert, update, delete on public.notices, public.tracks, public.scores,
  public.warmups, public.polls, public.poll_votes, public.messages to authenticated;

revoke execute on function public.sync_regent_role() from public, anon;
revoke execute on function public.join_choir(text, text, text) from public, anon;
revoke execute on function public.is_member(text) from public, anon;
revoke execute on function public.is_regent(text) from public, anon;
revoke execute on function public.can_use_room(text, text) from public, anon;
revoke execute on function public.is_regent_email(text) from public, anon;
grant execute on function public.sync_regent_role() to authenticated;
grant execute on function public.join_choir(text, text, text) to authenticated;
grant execute on function public.is_member(text) to authenticated;
grant execute on function public.is_regent(text) to authenticated;
grant execute on function public.can_use_room(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and public.is_member((storage.foldername(name))[2])
  );

create policy media_regent_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_regent((storage.foldername(name))[2])
    and (storage.foldername(name))[3] in ('tracks', 'scores', 'warmups')
    and (
      ((storage.foldername(name))[3] = 'scores'
        and coalesce((metadata ->> 'mimetype'), '') = 'application/pdf'
        and coalesce((metadata ->> 'size')::bigint, 0) <= 10485760)
      or
      ((storage.foldername(name))[3] in ('tracks', 'warmups')
        and coalesce((metadata ->> 'mimetype'), '') like 'audio/%'
        and coalesce((metadata ->> 'size')::bigint, 0) <= 26214400)
    )
  );

create policy media_chat_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[3] = 'chat'
    and public.can_use_room((storage.foldername(name))[2], (storage.foldername(name))[4])
    and storage.filename(name) like auth.uid()::text || '-%'
    and coalesce((metadata ->> 'mimetype'), '') like 'audio/%'
    and coalesce((metadata ->> 'size')::bigint, 0) <= 2097152
  );

create policy media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and public.is_regent((storage.foldername(name))[2])
    and (storage.foldername(name))[3] in ('tracks', 'scores', 'warmups')
  )
  with check (
    bucket_id = 'media'
    and public.is_regent((storage.foldername(name))[2])
    and (storage.foldername(name))[3] in ('tracks', 'scores', 'warmups')
  );

create policy media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (
      public.is_regent((storage.foldername(name))[2])
      or (
        (storage.foldername(name))[3] = 'chat'
        and storage.filename(name) like auth.uid()::text || '-%'
      )
    )
  );

alter table public.members replica identity full;
alter table public.notices replica identity full;
alter table public.tracks replica identity full;
alter table public.scores replica identity full;
alter table public.warmups replica identity full;
alter table public.polls replica identity full;
alter table public.poll_votes replica identity full;
alter table public.messages replica identity full;

alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.notices;
alter publication supabase_realtime add table public.tracks;
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.warmups;
alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;
alter publication supabase_realtime add table public.messages;
