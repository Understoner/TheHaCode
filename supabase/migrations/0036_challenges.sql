-- 0036: Challenges (01.11.2026).
--
-- Eine Challenge buendelt mehrere Habits (vorgeschlagene oder eigene) fuer
-- einen Zeitraum und plant sie auf Tage. Entscheidungen des Users vom
-- 01.11.2026:
--
--   * Anlegen: die Redaktion stellt Vorlagen bereit (challenge_templates,
--     gepflegt in Supabase Studio), mit Plus baut man auch eigene.
--   * Zugang: Plus; einzelne Vorlagen kann die Redaktion als Vorschau
--     freigeben (is_preview), wie bei den Habits. Lesen, Auswerten,
--     Abbrechen und Loeschen gehen immer, auch nach Abo-Ende (SAD §3.4).
--   * Abhaken in der Challenge ist DERSELBE Eintrag wie im Tagebuch
--     (habit_logs). Die Challenge legt nur einen Plan darueber; es gibt keine
--     eigene Tabelle fuer Haken.
--   * Planung je Habit frei kombinierbar: jeden Tag, feste Wochentage,
--     bestimmte Daten, mehrtaegige Bloecke ("3 Tage Fasten", einmal am Ende
--     abgehakt).
--   * Auswertung: erfuellte von geplanten Terminen, ohne Einfluss auf den
--     Habit Score. Ein Zahlen-Habit gilt als erfuellt, wenn es die Grenze fuer
--     Pluspunkte erreicht (0035), ohne Grenze reicht ein Eintrag.
--   * Plan aendern: nur kuenftige Tage. Vergangene Termine bleiben, damit
--     die Auswertung ehrlich bleibt.
--
-- DATENMODELL
-- -----------
--   challenge_templates       Vorlagen der Redaktion (Laenge in Tagen)
--   challenge_template_items  ihre Habits mit einem Plan relativ zum Start
--   challenges                die Challenge einer Person (Zeitraum, Titel)
--   challenge_items           ihre Habits (user_habits) samt Plan fuer den Editor
--   challenge_slots           die geplanten Termine: starts_on..due_on,
--                             ein Tag oder ein Block; abgehakt wird am due_on
--
-- Der Plan steht zweimal: als Regel im Item (plan, nur fuer den Editor) und
-- als Termine (slots, die Wahrheit fuer Kalender und Auswertung). Die Termine
-- rechnet die App aus der Regel (src/features/challenges/plan.ts) und
-- schreibt sie ueber save_challenge_plan() in einem Rutsch.
--
-- Gesundheitsdaten: Welche Habits jemand plant ("3 Tage Fasten"), ist eine
-- Gesundheitsangabe wie das eigene Habit selbst (0025). Schreiben verlangt
-- deshalb die Einwilligung health_data. delete_my_diary_data() loescht die
-- Challenges mit (Abschnitt 6).
--
-- Additiv (SAD §2.6): nur neue Tabellen und Funktionen; delete_my_diary_data
-- wird ersetzt und loescht zusaetzlich die Challenges. Die alte App kennt
-- nichts davon.

-- ===================================================================
-- 1. Vorlagen der Redaktion
-- ===================================================================
create table public.challenge_templates (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null check (length(btrim(title)) between 1 and 80),
  description_md text check (description_md is null or length(description_md) <= 2000),
  duration_days  int  not null check (duration_days between 1 and 365),
  is_preview     boolean not null default false,
  is_published   boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_challenge_templates_updated
  before update on public.challenge_templates
  for each row execute function public.set_updated_at();

alter table public.challenge_templates enable row level security;

create policy challenge_templates_read on public.challenge_templates
  for select using (is_published);
create policy challenge_templates_admin_write on public.challenge_templates
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.challenge_templates to anon, authenticated;
grant select, insert, update, delete on public.challenge_templates to service_role;

comment on table public.challenge_templates is
  'Challenge-Vorlagen der Redaktion (0036). is_preview = auch ohne Plus startbar.';

-- Der Plan einer Vorlage ist relativ zum Starttag (Tag 0):
--   {"daily": true}                       jeden Tag
--   {"weekdays": [1, 3, 5]}               ISO-Wochentage, 1 = Montag
--   {"days": [0, 7, 14]}                  bestimmte Tage nach dem Start
--   {"blocks": [{"start": 10, "length": 3}]}  Block ab Tag 10, drei Tage
-- Die Schluessel lassen sich kombinieren. Gerechnet wird in plan.ts.
create table public.challenge_template_items (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.challenge_templates(id) on delete cascade,
  habit_template_id uuid not null references public.habit_templates(id) on delete restrict,
  plan              jsonb not null default '{}'::jsonb check (jsonb_typeof(plan) = 'object'),
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (template_id, habit_template_id)
);

create index idx_challenge_template_items_habit on public.challenge_template_items (habit_template_id);

create trigger trg_challenge_template_items_updated
  before update on public.challenge_template_items
  for each row execute function public.set_updated_at();

alter table public.challenge_template_items enable row level security;

create policy challenge_template_items_read on public.challenge_template_items
  for select using (
    exists (select 1 from public.challenge_templates t
             where t.id = template_id and t.is_published)
  );
create policy challenge_template_items_admin_write on public.challenge_template_items
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.challenge_template_items to anon, authenticated;
grant select, insert, update, delete on public.challenge_template_items to service_role;

-- ===================================================================
-- 2. Challenges der Personen
-- ===================================================================
create table public.challenges (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  template_id    uuid references public.challenge_templates(id) on delete set null,
  title          text not null check (length(btrim(title)) between 1 and 80),
  description_md text check (description_md is null or length(description_md) <= 500),
  starts_on      date not null,
  ends_on        date not null,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  client_id      uuid,
  constraint chk_challenge_range check (ends_on >= starts_on and ends_on - starts_on < 365)
);

create index idx_challenges_user on public.challenges (user_id, starts_on desc);
create index idx_challenges_template on public.challenges (template_id) where template_id is not null;
create unique index uq_challenges_client on public.challenges (user_id, client_id) where client_id is not null;

create trigger trg_challenges_updated
  before update on public.challenges
  for each row execute function public.set_updated_at();

create table public.challenge_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  user_habit_id uuid not null references public.user_habits(id) on delete cascade,
  plan          jsonb not null default '{}'::jsonb check (jsonb_typeof(plan) = 'object'),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  client_id     uuid,
  unique (challenge_id, user_habit_id)
);

create index idx_challenge_items_user on public.challenge_items (user_id);
create index idx_challenge_items_habit on public.challenge_items (user_habit_id);
create unique index uq_challenge_items_client on public.challenge_items (user_id, client_id) where client_id is not null;

create trigger trg_challenge_items_updated
  before update on public.challenge_items
  for each row execute function public.set_updated_at();

create table public.challenge_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  item_id      uuid not null references public.challenge_items(id) on delete cascade,
  -- Ein Tag: starts_on = due_on. Ein Block: starts_on..due_on, abgehakt wird
  -- einmal am Ende (due_on).
  starts_on    date not null,
  due_on       date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  client_id    uuid,
  constraint chk_challenge_slot_range check (due_on >= starts_on and due_on - starts_on < 31),
  unique (item_id, due_on)
);

create index idx_challenge_slots_challenge on public.challenge_slots (challenge_id, due_on);
create index idx_challenge_slots_user on public.challenge_slots (user_id, due_on);
create unique index uq_challenge_slots_client on public.challenge_slots (user_id, client_id) where client_id is not null;

create trigger trg_challenge_slots_updated
  before update on public.challenge_slots
  for each row execute function public.set_updated_at();

comment on table public.challenges is
  'Challenge einer Person: Zeitraum und Titel (0036). Haken = habit_logs.';
comment on table public.challenge_items is
  'Habits einer Challenge; plan ist der Stand des Editors, die Termine stehen in challenge_slots (0036).';
comment on table public.challenge_slots is
  'Geplante Termine einer Challenge. Vergangene sind fest (Trigger, 0036).';

-- ===================================================================
-- 3. Wer darf starten, wer darf planen
-- ===================================================================
-- Starten: Plus, oder eine veroeffentlichte Vorschau-Vorlage.
create or replace function public.can_start_challenge(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_plus_access()
      or exists (
           select 1 from public.challenge_templates t
            where t.id = p_template_id and t.is_preview and t.is_published
         );
$$;

-- Planen (Habits und Termine dazu): die eigene, nicht abgebrochene und
-- nicht geloeschte Challenge, und dieselbe Zugangsregel wie beim Start. Nach
-- Abo-Ende ist eine eigene Challenge damit lesbar, aber nicht mehr planbar.
create or replace function public.can_plan_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges c
     where c.id = p_challenge_id
       and c.user_id = (select auth.uid())
       and c.cancelled_at is null
       and c.deleted_at is null
       and public.can_start_challenge(c.template_id)
  );
$$;

revoke execute on function public.can_start_challenge(uuid) from public, anon;
grant execute on function public.can_start_challenge(uuid) to authenticated, service_role;
revoke execute on function public.can_plan_challenge(uuid) from public, anon;
grant execute on function public.can_plan_challenge(uuid) to authenticated, service_role;

-- ===================================================================
-- 4. Schutz-Trigger
-- ===================================================================
-- "Vergangen" heisst: der Termin hat vor heute (UTC) begonnen. Die Sperre
-- gilt fuer Schreibzugriffe der App (Rolle authenticated). Kaskaden beim
-- Loeschen einer ganzen Challenge oder eines Kontos laufen als Eigentuemer
-- der Tabelle und sind davon nicht betroffen - eine ganze Challenge zu
-- loeschen bleibt immer moeglich.

create or replace function public.guard_challenge()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := btrim(coalesce(new.title, ''));
  new.description_md := nullif(btrim(coalesce(new.description_md, '')), '');

  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Ein Tag Spielraum fuer Zeitzonen westlich von UTC.
    if new.starts_on < current_date - 1 then
      raise exception 'Eine Challenge beginnt heute oder spaeter' using errcode = 'check_violation';
    end if;
    new.cancelled_at := null;
    new.deleted_at := null;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.template_id is distinct from old.template_id then
    raise exception 'Eigentuemer und Vorlage einer Challenge sind fest' using errcode = '42501';
  end if;
  if old.cancelled_at is not null and new.cancelled_at is null then
    raise exception 'Eine abgebrochene Challenge laesst sich nicht fortsetzen' using errcode = 'check_violation';
  end if;

  -- Abbrechen und Loeschen gehen immer. Alles andere ist Planen.
  if (new.title, new.description_md, new.starts_on, new.ends_on)
     is distinct from (old.title, old.description_md, old.starts_on, old.ends_on) then
    if old.cancelled_at is not null or not public.can_start_challenge(old.template_id) then
      raise exception 'Challenges planen gehoert zu Plus' using errcode = '42501';
    end if;
    if not public.has_consent('health_data') then
      raise exception 'Challenges planen braucht die Einwilligung' using errcode = '42501';
    end if;
    -- Nur die Zukunft: ein begonnener Start bleibt, das Ende darf nicht vor
    -- gestern liegen.
    if new.starts_on is distinct from old.starts_on
       and (old.starts_on < current_date or new.starts_on < current_date) then
      raise exception 'Der Start einer begonnenen Challenge ist fest' using errcode = 'check_violation';
    end if;
    if new.ends_on is distinct from old.ends_on and new.ends_on < current_date - 1 then
      raise exception 'Das Ende liegt in der Vergangenheit' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

create trigger trg_guard_challenge
  before insert or update on public.challenges
  for each row execute function public.guard_challenge();

-- Abbrechen raeumt die kuenftigen Termine ab; die vergangenen bleiben fuer
-- die Auswertung.
create or replace function public.challenge_cancelled()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.cancelled_at is null and new.cancelled_at is not null then
    delete from public.challenge_slots
     where challenge_id = new.id
       and starts_on >= current_date;
  end if;
  return null;
end $$;

create trigger trg_challenge_cancelled
  after update of cancelled_at on public.challenges
  for each row execute function public.challenge_cancelled();

create or replace function public.guard_challenge_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge_user uuid;
  v_habit_user     uuid;
begin
  if tg_op = 'DELETE' then
    -- Ein Habit mit vergangenen Terminen bleibt in der Challenge - sonst
    -- verschwaenden seine Termine aus der Auswertung. Herausnehmen heisst
    -- dann: die kuenftigen Termine loeschen.
    if current_user = 'authenticated'
       and exists (select 1 from public.challenges c where c.id = old.challenge_id)
       and exists (select 1 from public.challenge_slots s
                    where s.item_id = old.id and s.starts_on < current_date) then
      raise exception 'Habits mit vergangenen Terminen bleiben in der Challenge'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.challenge_id is distinct from old.challenge_id
          or new.user_habit_id is distinct from old.user_habit_id
          or new.user_id is distinct from old.user_id) then
    raise exception 'Challenge und Habit eines Eintrags sind fest' using errcode = '42501';
  end if;

  select c.user_id into v_challenge_user from public.challenges c where c.id = new.challenge_id;
  select uh.user_id into v_habit_user from public.user_habits uh where uh.id = new.user_habit_id;
  -- user_id ist denormalisiert (fuer RLS); er muss zu Challenge und Habit
  -- passen, sonst plante jemand ein fremdes Habit in die eigene Challenge.
  if new.user_id is distinct from v_challenge_user or new.user_id is distinct from v_habit_user then
    raise exception 'Challenge, Habit und Person passen nicht zusammen' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_guard_challenge_item
  before insert or update or delete on public.challenge_items
  for each row execute function public.guard_challenge_item();

create or replace function public.guard_challenge_slot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_user      uuid;
  v_item_challenge uuid;
  v_starts         date;
  v_ends           date;
begin
  if tg_op = 'DELETE' then
    if current_user = 'authenticated'
       and old.starts_on < current_date
       and exists (select 1 from public.challenges c where c.id = old.challenge_id) then
      raise exception 'Vergangene Termine einer Challenge bleiben' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  select i.user_id, i.challenge_id into v_item_user, v_item_challenge
    from public.challenge_items i where i.id = new.item_id;
  if v_item_user is null then
    raise exception 'Dieses Habit gehoert zu keiner Challenge' using errcode = 'foreign_key_violation';
  end if;
  if new.user_id is distinct from v_item_user then
    raise exception 'Termin und Habit gehoeren nicht derselben Person' using errcode = 'check_violation';
  end if;
  -- Die Challenge ergibt sich aus dem Habit, nicht aus der Anfrage.
  new.challenge_id := v_item_challenge;

  select c.starts_on, c.ends_on into v_starts, v_ends
    from public.challenges c where c.id = v_item_challenge;
  if new.starts_on < v_starts or new.due_on > v_ends then
    raise exception 'Der Termin liegt ausserhalb der Challenge' using errcode = 'check_violation';
  end if;

  if current_user = 'authenticated' then
    if tg_op = 'UPDATE' then
      raise exception 'Termine werden nicht geaendert, sondern neu gesetzt' using errcode = '42501';
    end if;
    if new.starts_on < current_date then
      raise exception 'Vergangene Termine lassen sich nicht nachtraeglich planen'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger trg_guard_challenge_slot
  before insert or update or delete on public.challenge_slots
  for each row execute function public.guard_challenge_slot();

-- ===================================================================
-- 5. RLS
-- ===================================================================
alter table public.challenges enable row level security;
alter table public.challenge_items enable row level security;
alter table public.challenge_slots enable row level security;

-- Lesen und Loeschen: immer, fuer die eigenen Zeilen (SAD §3.10).
create policy challenges_select_own on public.challenges
  for select using (user_id = (select auth.uid()));
create policy challenges_insert_own on public.challenges
  for insert with check (
    user_id = (select auth.uid())
    and public.has_consent('health_data')
    and public.can_start_challenge(template_id)
  );
-- Was beim Aendern Plus braucht (Planen) und was immer geht (Abbrechen,
-- Loeschen), unterscheidet der Trigger - eine Policy sieht den alten Wert nicht.
create policy challenges_update_own on public.challenges
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy challenges_delete_own on public.challenges
  for delete using (user_id = (select auth.uid()));

create policy challenge_items_select_own on public.challenge_items
  for select using (user_id = (select auth.uid()));
create policy challenge_items_insert_own on public.challenge_items
  for insert with check (
    user_id = (select auth.uid())
    and public.has_consent('health_data')
    and public.can_plan_challenge(challenge_id)
    and exists (
      select 1 from public.user_habits uh
       where uh.id = user_habit_id
         and uh.user_id = (select auth.uid())
         and public.can_use_habit_template(uh.template_id)
    )
  );
create policy challenge_items_update_own on public.challenge_items
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_consent('health_data')
    and public.can_plan_challenge(challenge_id)
  );
create policy challenge_items_delete_own on public.challenge_items
  for delete using (user_id = (select auth.uid()));

create policy challenge_slots_select_own on public.challenge_slots
  for select using (user_id = (select auth.uid()));
create policy challenge_slots_insert_own on public.challenge_slots
  for insert with check (
    user_id = (select auth.uid())
    and public.has_consent('health_data')
    and public.can_plan_challenge(challenge_id)
  );
create policy challenge_slots_delete_own on public.challenge_slots
  for delete using (user_id = (select auth.uid()));

-- Spaltenrechte: was der Client nennen darf. Termine werden nie geaendert,
-- nur geloescht und neu gesetzt.
grant select, delete on public.challenges to authenticated;
grant insert (id, user_id, template_id, title, description_md, starts_on, ends_on, client_id)
  on public.challenges to authenticated;
grant update (title, description_md, starts_on, ends_on, cancelled_at, deleted_at)
  on public.challenges to authenticated;

grant select, delete on public.challenge_items to authenticated;
grant insert (id, user_id, challenge_id, user_habit_id, plan, sort_order, client_id)
  on public.challenge_items to authenticated;
grant update (plan, sort_order) on public.challenge_items to authenticated;

grant select, delete on public.challenge_slots to authenticated;
grant insert (id, user_id, challenge_id, item_id, starts_on, due_on, client_id)
  on public.challenge_slots to authenticated;

grant select, insert, update, delete on public.challenges, public.challenge_items, public.challenge_slots
  to service_role;

-- ===================================================================
-- 6. Speichern in einem Rutsch
-- ===================================================================
-- Legt eine Challenge an (p_challenge ohne id) oder aendert sie (mit id),
-- waehlt die Habits ins Tagebuch (wie useChooseHabit: reaktivieren, sonst
-- neu), setzt ihre kuenftigen Termine neu und nimmt Habits ohne
-- vergangene Termine heraus, die nicht mehr im Plan stehen.
--
-- security invoker: es gelten dieselben Policies und Trigger wie bei
-- einzelnen Aufrufen. Die Funktion spart nur die halbfertigen Zustaende,
-- die zwischen zwanzig einzelnen Anfragen entstehen koennten.
--
-- p_challenge: {"id"?, "template_id"?, "title", "description"?, "starts_on", "ends_on", "client_id"?}
-- p_items:     [{"habit_template_id", "plan", "slots": [{"starts_on", "due_on"}]}]
create or replace function public.save_challenge_plan(p_challenge jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_id        uuid := nullif(p_challenge->>'id', '')::uuid;
  v_item      jsonb;
  v_slot      jsonb;
  v_template  uuid;
  v_habit     uuid;
  v_item_id   uuid;
  v_keep      uuid[] := array[]::uuid[];
  v_position  int := 0;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Habits als Liste erwartet' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Hoechstens 30 Habits je Challenge' using errcode = 'check_violation';
  end if;

  if v_id is null then
    insert into public.challenges (user_id, template_id, title, description_md, starts_on, ends_on, client_id)
    values (v_uid,
            nullif(p_challenge->>'template_id', '')::uuid,
            p_challenge->>'title',
            p_challenge->>'description',
            (p_challenge->>'starts_on')::date,
            (p_challenge->>'ends_on')::date,
            nullif(p_challenge->>'client_id', '')::uuid)
    returning id into v_id;
  else
    -- Termine nach dem neuen Ende raeumen, bevor das Ende sich bewegt.
    delete from public.challenge_slots s
     where s.challenge_id = v_id
       and s.user_id = v_uid
       and s.starts_on >= current_date;

    update public.challenges
       set title          = p_challenge->>'title',
           description_md = p_challenge->>'description',
           starts_on      = (p_challenge->>'starts_on')::date,
           ends_on        = (p_challenge->>'ends_on')::date
     where id = v_id and user_id = v_uid and deleted_at is null;
    if not found then
      raise exception 'Diese Challenge gibt es nicht' using errcode = 'no_data_found';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_template := (v_item->>'habit_template_id')::uuid;

    -- Das Habit ins Tagebuch: ein aktives nehmen, sonst ein archiviertes
    -- wiederbeleben (seine alten Eintraege haengen daran), sonst neu.
    select uh.id into v_habit
      from public.user_habits uh
     where uh.user_id = v_uid and uh.template_id = v_template and uh.deleted_at is null
     order by uh.is_active desc, uh.created_at desc
     limit 1;
    if v_habit is null then
      insert into public.user_habits (user_id, template_id, sort_order)
      values (v_uid, v_template, 0)
      returning id into v_habit;
    else
      update public.user_habits
         set is_active = true, archived_at = null
       where id = v_habit and not is_active;
    end if;

    insert into public.challenge_items (user_id, challenge_id, user_habit_id, plan, sort_order)
    values (v_uid, v_id, v_habit, coalesce(v_item->'plan', '{}'::jsonb), v_position)
    on conflict (challenge_id, user_habit_id)
      do update set plan = excluded.plan, sort_order = excluded.sort_order
    returning id into v_item_id;
    v_keep := v_keep || v_item_id;
    v_position := v_position + 1;

    for v_slot in select * from jsonb_array_elements(coalesce(v_item->'slots', '[]'::jsonb)) loop
      -- Vergangene Termine stehen schon da (oder sollen nicht nachtraeglich
      -- entstehen): nur ab heute schreiben.
      if (v_slot->>'starts_on')::date >= current_date then
        insert into public.challenge_slots (user_id, challenge_id, item_id, starts_on, due_on)
        values (v_uid, v_id, v_item_id, (v_slot->>'starts_on')::date, (v_slot->>'due_on')::date)
        on conflict (item_id, due_on) do nothing;
      end if;
    end loop;
  end loop;

  -- Nicht mehr geplante Habits: ohne vergangene Termine heraus, mit
  -- vergangenen bleiben sie (ihre kuenftigen Termine sind oben schon weg).
  delete from public.challenge_items i
   where i.challenge_id = v_id
     and i.user_id = v_uid
     and not (i.id = any (v_keep))
     and not exists (select 1 from public.challenge_slots s
                      where s.item_id = i.id and s.starts_on < current_date);

  return v_id;
end $$;

revoke execute on function public.save_challenge_plan(jsonb, jsonb) from public, anon;
grant execute on function public.save_challenge_plan(jsonb, jsonb) to authenticated;

comment on function public.save_challenge_plan(jsonb, jsonb) is
  'Legt eine Challenge an oder aendert ihren kuenftigen Plan in einem Rutsch (0036).';

-- ===================================================================
-- 7. Tagebuch-Daten loeschen: Challenges zuerst
-- ===================================================================
-- Wie 0033, plus Challenges. Sie kommen zuerst: ihre Habits haengen an der
-- Auswahl (user_habits), und die Termine sind sonst ueber zwei Wege
-- verknuepft.
create or replace function public.delete_my_diary_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  delete from public.challenges      where user_id  = v_uid;
  delete from public.habit_logs      where user_id  = v_uid;
  delete from public.user_habits     where user_id  = v_uid;
  delete from public.habit_favorites where user_id  = v_uid;
  delete from public.habit_templates where owner_id = v_uid;
end $$;

comment on function public.delete_my_diary_data() is
  'Loescht alle Tagebuch-Daten der angemeldeten Person (Challenges, Eintraege, '
  'Auswahl, Habit-Favoriten, eigene Habits). Angeboten beim Widerruf von health_data.';
