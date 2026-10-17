-- Notion shows an empty Lesson title as "New page".
-- Fill the rows whose class and date are already known, using the title
-- format already used on that class.

update public.cohort_lesson_log_entries
set lesson_title = 'Cohort 45 - Week 1 - 21 Sept (app)'
where id = '4e7ee6ad-c1ae-4d0b-b160-6be1d89ac4ba'
  and (lesson_title is null or btrim(lesson_title) = '');

update public.cohort_lesson_log_entries
set lesson_title = 'Aman Attalia - Foundational Course - ' || to_char(lesson_date, 'YYYY-MM-DD')
where package_instance_id = 'dc338948-cec2-475f-9c19-a00671589540'
  and lesson_date is not null
  and (lesson_title is null or btrim(lesson_title) = '');
