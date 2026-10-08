-- Kids course grants confirm a student_packages row, which runs
-- match_onboarding_sales_call. That function cleared its candidate temp table
-- with DELETE FROM _cand and no WHERE. PostgREST sessions reject that
-- ("DELETE requires a WHERE clause"), the purchase RPC catches it, and the
-- kids queue was marked granted anyway. WHERE true still clears every candidate
-- and satisfies the WHERE requirement.
--
-- Also stop two signup paths from inserting the same child twice.

CREATE OR REPLACE FUNCTION public.match_onboarding_sales_call(p_checklist_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid; v_email text; v_pkg text; v_paid date; v_id uuid; v_n int;
begin
  select coalesce(sp.user_id, kp.parent_user_id), lower(u.email), pk.name, coalesce(oc.payment_date, sp.purchased_at::date)
    into v_uid, v_email, v_pkg, v_paid
  from public.onboarding_checklists oc
  join public.student_packages sp on sp.id = oc.student_package_id and sp.status = 'confirmed'
  left join public.kid_profiles kp on kp.id = sp.kid_profile_id
  left join auth.users u on u.id = coalesce(sp.user_id, kp.parent_user_id)
  left join public.packages pk on pk.id = sp.package_id
  where oc.id = p_checklist_id;
  if v_uid is null then return null; end if;

  create temp table if not exists _cand (id uuid, linked_other boolean, gap int) on commit drop;
  delete from _cand where true;
  insert into _cand
  select s.id,
    exists (select 1 from public.onboarding_checklists o2 join public.student_packages sp2 on sp2.id = o2.student_package_id
            left join public.kid_profiles kp2 on kp2.id = sp2.kid_profile_id
            where o2.sales_call_id = s.id and o2.id <> p_checklist_id),
    abs(coalesce(s.payment_date::date, s.call_date::date) - v_paid)
  from public.sales_calls s
  left join public.notion_leads_cache l on l.notion_page_id = s.lead_notion_page_id
  where (s.closed or s.payment_made)
    and (s.user_id = v_uid or (v_email is not null and lower(l.email) = v_email))
    and (s.course is null or v_pkg ilike '%' || rtrim(split_part(s.course,' ',1),'s') || '%')
    -- exclude calls already used by a different account
    and not exists (select 1 from public.onboarding_checklists o3 join public.student_packages sp3 on sp3.id = o3.student_package_id
                    left join public.kid_profiles kp3 on kp3.id = sp3.kid_profile_id
                    where o3.sales_call_id = s.id and coalesce(sp3.user_id, kp3.parent_user_id) <> v_uid);

  select count(*) into v_n from _cand;
  if v_n = 0 then return null; end if;
  if v_n = 1 then select id into v_id from _cand; return v_id; end if;

  -- several: prefer unlinked, then closest date; must be within 21 days and not tied
  select id into v_id from _cand c
  where c.gap <= 21
    and not exists (select 1 from _cand d where d.id <> c.id and d.linked_other = c.linked_other and d.gap = c.gap and not d.linked_other)
  order by c.linked_other, c.gap limit 1;
  return v_id;
end $function$;

CREATE UNIQUE INDEX IF NOT EXISTS kid_profiles_parent_name_lower_trim_idx
  ON public.kid_profiles (parent_user_id, lower(trim(name)));

NOTIFY pgrst, 'reload schema';
