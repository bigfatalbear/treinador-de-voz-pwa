-- CORAL PIBENS ACADEMY - gerenciamento de regentes e vídeos de treino
-- Branding UUID: 2dfce9de-de4b-57ae-a291-a170c20195cd

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  choir_id text not null default 'principal',
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  category text not null default 'Treino' check (char_length(category) between 2 and 40),
  voice_part text check (
    voice_part is null or voice_part in ('soprano', 'contralto', 'tenor', 'baixo')
  ),
  created_at timestamptz not null default now()
);

create index videos_choir_created_idx on public.videos (choir_id, created_at);

alter table public.videos enable row level security;

create policy videos_select on public.videos
  for select to authenticated using (public.is_member(choir_id));
create policy videos_write on public.videos
  for all to authenticated
  using (public.is_regent(choir_id))
  with check (public.is_regent(choir_id));

revoke all on public.videos from anon;
grant select, insert, update, delete on public.videos to authenticated;

alter table public.videos replica identity full;
alter publication supabase_realtime add table public.videos;

create or replace function public.set_regent_role(p_member_id uuid, p_regent boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_choir text;
  v_email text;
  v_current_role text;
  v_emails text[];
  v_regent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão não encontrada.' using errcode = '42501';
  end if;
  if p_member_id is null then
    raise exception 'Membro inválido.' using errcode = '22023';
  end if;

  select choir_id, lower(btrim(email)), role
    into v_choir, v_email, v_current_role
    from public.members
    where id = p_member_id;

  if not found then
    raise exception 'Membro não encontrado.' using errcode = 'P0002';
  end if;
  if v_choir is null or not public.is_regent(v_choir) then
    raise exception 'Apenas um regente pode alterar papéis.' using errcode = '42501';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'O membro não possui e-mail cadastrado.' using errcode = '22023';
  end if;

  if p_regent then
    select array_agg(distinct lower(btrim(allowed.email)))
      into v_emails
      from public.app_secrets s,
        unnest(string_to_array(coalesce(s.value, ''), ',')) as allowed(email)
      where s.key = 'regent_emails'
        and btrim(allowed.email) <> '';

    v_emails := coalesce(v_emails, array[]::text[]);
    if not (v_email = any (v_emails)) then
      v_emails := array_append(v_emails, v_email);
    end if;

    insert into public.app_secrets (key, value, updated_at)
    values ('regent_emails', array_to_string(v_emails, ','), now())
    on conflict (key) do update
      set value = excluded.value,
          updated_at = now();

    update public.members
      set role = 'regente', email = v_email, updated_at = now()
      where id = p_member_id;
  else
    select count(*)
      into v_regent_count
      from public.members
      where choir_id = v_choir and role = 'regente';

    if v_current_role = 'regente' and v_regent_count <= 1 then
      raise exception 'O coral precisa de pelo menos um regente.' using errcode = '22023';
    end if;

    select array_agg(distinct lower(btrim(allowed.email)))
      into v_emails
      from public.app_secrets s,
        unnest(string_to_array(coalesce(s.value, ''), ',')) as allowed(email)
      where s.key = 'regent_emails'
        and btrim(allowed.email) <> ''
        and lower(btrim(allowed.email)) <> v_email;

    v_emails := coalesce(v_emails, array[]::text[]);

    insert into public.app_secrets (key, value, updated_at)
    values ('regent_emails', array_to_string(v_emails, ','), now())
    on conflict (key) do update
      set value = excluded.value,
          updated_at = now();

    update public.members
      set role = 'coralista', updated_at = now()
      where id = p_member_id;
  end if;

  return jsonb_build_object(
    'id', p_member_id,
    'role', case when p_regent then 'regente' else 'coralista' end
  );
end;
$$;

revoke execute on function public.set_regent_role(uuid, boolean) from public, anon;
grant execute on function public.set_regent_role(uuid, boolean) to authenticated;
