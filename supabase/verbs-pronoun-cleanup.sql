-- Remove non-verb pronoun rows that were accidentally inserted into public.verbs.
-- This script first captures exact row IDs, then deletes only those IDs.

begin;

with candidates as (
  select id, infinitive, infinitive_romanised, english
  from public.verbs
  where infinitive_romanised in ('mainu', 'tuhanu', 'usnu', 'saanu', 'ohna nu')
)
delete from public.verbs
where id in (select id from candidates);

commit;
