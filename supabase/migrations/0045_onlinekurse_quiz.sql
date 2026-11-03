-- 0045: Onlinekurse, Schritt 7 - Wissensquiz (V1.2, SAD §11.2).
--
-- Genau ein Quiz je Kurs, am Ende (0042: uq_online_course_blocks_one_quiz).
-- Bestanden ab pass_percent des Kurses (Vorgabe 80 %), beliebig oft
-- wiederholbar.
--
-- DIE LOESUNG ERREICHT DEN BROWSER NIE VOR DER ABGABE
-- ---------------------------------------------------
--   * Fragen und Antworten sind mit Zugang zum Kurs lesbar - aber ohne die
--     Spalte is_correct (Spaltenrechte) und ohne die Erklaerung, die die
--     Loesung verraten wuerde.
--   * Ausgewertet wird nur in submit_quiz(): alle Fragen auf einmal. Erst
--     danach gibt die Funktion je Frage richtig/falsch, die richtige Antwort
--     und die Erklaerung zurueck. Eine Pruefung Frage fuer Frage gibt es
--     bewusst nicht - sonst liesse sich jede Frage vor der Abgabe ausprobieren.
--   * Wer besteht, bekommt den Quiz-Block in course_progress eingetragen -
--     nur diese Funktion darf das (Trigger aus 0043).
--
-- Keine Gesundheitsdaten (Verzeichnis V13). Additiv (SAD §2.6).

-- ===================================================================
-- 1. Fragen und Antworten (Redaktion)
-- ===================================================================
create table public.online_quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references public.online_course_blocks(id) on delete cascade,
  sort_order  int not null default 0,
  question    text not null check (length(btrim(question)) between 1 and 400),
  explanation text check (explanation is null or length(explanation) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_online_quiz_questions_block on public.online_quiz_questions (block_id, sort_order);

create trigger trg_online_quiz_questions_updated
  before update on public.online_quiz_questions
  for each row execute function public.set_updated_at();

create table public.online_quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.online_quiz_questions(id) on delete cascade,
  sort_order  int not null default 0,
  label       text not null check (length(btrim(label)) between 1 and 300),
  is_correct  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_online_quiz_options_question on public.online_quiz_options (question_id, sort_order);
-- Genau eine richtige Antwort je Frage (Multiple Choice mit einer Loesung).
create unique index uq_online_quiz_options_one_correct
  on public.online_quiz_options (question_id) where is_correct;

create trigger trg_online_quiz_options_updated
  before update on public.online_quiz_options
  for each row execute function public.set_updated_at();

-- Fragen nur an Quiz-Bloecke.
create or replace function public.online_quiz_question_block_is_quiz()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.online_course_blocks b
                  where b.id = new.block_id and b.kind = 'quiz') then
    raise exception 'Quizfragen gehoeren an einen Quiz-Block' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_online_quiz_question_block
  before insert or update on public.online_quiz_questions
  for each row execute function public.online_quiz_question_block_is_quiz();

alter table public.online_quiz_questions enable row level security;
alter table public.online_quiz_options enable row level security;

create policy online_quiz_questions_read on public.online_quiz_questions
  for select using (
    exists (select 1 from public.online_course_blocks b
             where b.id = block_id and public.can_open_course(b.course_id))
  );
create policy online_quiz_questions_admin_write on public.online_quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

create policy online_quiz_options_read on public.online_quiz_options
  for select using (
    exists (select 1 from public.online_quiz_questions q
              join public.online_course_blocks b on b.id = q.block_id
             where q.id = question_id and public.can_open_course(b.course_id))
  );
create policy online_quiz_options_admin_write on public.online_quiz_options
  for all using (public.is_admin()) with check (public.is_admin());

-- Spaltenrechte: die Loesung (is_correct) und die Erklaerung (explanation)
-- sind fuer die App-Rollen nicht lesbar. Admins pflegen im Studio als
-- postgres/service_role.
revoke all on public.online_quiz_questions from anon, authenticated;
revoke all on public.online_quiz_options from anon, authenticated;
grant select (id, block_id, sort_order, question, created_at, updated_at)
  on public.online_quiz_questions to anon, authenticated;
grant select (id, question_id, sort_order, label, created_at, updated_at)
  on public.online_quiz_options to anon, authenticated;
grant select, insert, update, delete on public.online_quiz_questions, public.online_quiz_options to service_role;

comment on table public.online_quiz_questions is
  'Quizfragen eines Onlinekurses (0045). explanation erst nach submit_quiz().';
comment on table public.online_quiz_options is
  'Antworten (0045). is_correct ist fuer die App-Rollen nicht lesbar.';

-- ===================================================================
-- 2. Versuche
-- ===================================================================
create table public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  uuid not null references public.online_courses(id) on delete cascade,
  block_id   uuid not null references public.online_course_blocks(id) on delete cascade,
  answers    jsonb not null check (jsonb_typeof(answers) = 'object'),
  score      int not null check (score >= 0),
  total      int not null check (total > 0 and score <= total),
  passed     boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id  uuid
);

create index idx_quiz_attempts_user_course on public.quiz_attempts (user_id, course_id, created_at desc);
create index idx_quiz_attempts_block on public.quiz_attempts (block_id);
create unique index uq_quiz_attempts_client on public.quiz_attempts (user_id, client_id) where client_id is not null;

create trigger trg_quiz_attempts_updated
  before update on public.quiz_attempts
  for each row execute function public.set_updated_at();

alter table public.quiz_attempts enable row level security;

-- Nur lesen, und nur die eigenen. Geschrieben wird ausschliesslich von
-- submit_quiz() - sonst koennte man sich ein bestandenes Ergebnis eintragen.
create policy quiz_attempts_read_own on public.quiz_attempts
  for select to authenticated using (user_id = auth.uid());

grant select on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.quiz_attempts to service_role;

comment on table public.quiz_attempts is
  'Quizversuche (0045). Schreibt nur submit_quiz().';

-- ===================================================================
-- 3. Abgabe
-- ===================================================================
-- p_answers: {"<question_id>": "<option_id>", ...} - jede Frage genau einmal.
create or replace function public.submit_quiz(p_block_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_course  public.online_courses;
  v_total   int;
  v_score   int;
  v_percent int;
  v_passed  boolean;
  v_results jsonb;
begin
  if v_user is null then
    raise exception 'Anmeldung erforderlich' using errcode = '42501';
  end if;

  select c.* into v_course
    from public.online_course_blocks b
    join public.online_courses c on c.id = b.course_id
   where b.id = p_block_id and b.kind = 'quiz';
  if v_course.id is null then
    raise exception 'Kein Quiz' using errcode = 'P0002';
  end if;
  if not public.can_open_course(v_course.id) then
    raise exception 'Kein Zugang zu diesem Kurs' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Antworten fehlen' using errcode = '22023';
  end if;

  select count(*) into v_total from public.online_quiz_questions where block_id = p_block_id;
  if v_total = 0 then
    raise exception 'Das Quiz hat noch keine Fragen' using errcode = 'P0002';
  end if;

  -- Jede Frage genau einmal, mit einer Antwort, die zu ihr gehoert. Fremde
  -- oder doppelte Schluessel zaehlen nicht still mit, sondern werden abgewiesen.
  if (select count(*) from jsonb_object_keys(p_answers)) <> v_total
     or exists (
       select 1 from jsonb_each_text(p_answers) a
        where not exists (
          select 1 from public.online_quiz_questions q
            join public.online_quiz_options o on o.question_id = q.id
           where q.block_id = p_block_id
             and q.id::text = a.key
             and o.id::text = a.value)) then
    raise exception 'Bitte jede Frage genau einmal beantworten' using errcode = '22023';
  end if;

  select count(*) into v_score
    from jsonb_each_text(p_answers) a
    join public.online_quiz_options o on o.id::text = a.value
   where o.is_correct;

  v_percent := floor(100.0 * v_score / v_total);
  v_passed := v_percent >= v_course.pass_percent;

  insert into public.quiz_attempts (user_id, course_id, block_id, answers, score, total, passed)
  values (v_user, v_course.id, p_block_id, p_answers, v_score, v_total, v_passed);

  if v_passed then
    insert into public.course_progress (user_id, course_id, block_id)
    values (v_user, v_course.id, p_block_id)
    on conflict (user_id, block_id) do nothing;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', q.id,
           'correct', (a.value = c.id::text),
           'correct_option_id', c.id,
           'explanation', q.explanation) order by q.sort_order), '[]'::jsonb)
    into v_results
    from public.online_quiz_questions q
    join public.online_quiz_options c on c.question_id = q.id and c.is_correct
    left join jsonb_each_text(p_answers) a on a.key = q.id::text
   where q.block_id = p_block_id;

  return jsonb_build_object(
    'score', v_score, 'total', v_total, 'percent', v_percent,
    'pass_percent', v_course.pass_percent, 'passed', v_passed, 'results', v_results);
end;
$$;

revoke execute on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated, service_role;

comment on function public.submit_quiz(uuid, jsonb) is
  'Wertet ein Quiz serverseitig aus (0045). Einzige Stelle, die quiz_attempts schreibt und das Quiz als erledigt eintraegt.';
