-- Harteer, Hartegh and Prabhbir are taught the adult Beginners Course.
-- Their kid profiles, cohort, and packages were stored on Kids Level 1.
-- Move those rows onto the adult course and keep each logged week number.

update public.cohort_lesson_log_entries as entry
set lesson_id = adult.id
from public.lessons as kids
join public.lessons as adult
  on adult.course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
 and adult.lesson_number = kids.lesson_number
where entry.cohort_id = 'eb9b8795-713e-48a4-8d4a-bf995d188120'
  and entry.lesson_id = kids.id
  and kids.course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.cohort_lesson_unlocks as unlock
set lesson_id = adult.id
from public.lessons as kids
join public.lessons as adult
  on adult.course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
 and adult.lesson_number = kids.lesson_number
where unlock.cohort_id = 'eb9b8795-713e-48a4-8d4a-bf995d188120'
  and unlock.lesson_id = kids.id
  and kids.course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.cohort_lesson_attendance as mark
set lesson_id = adult.id
from public.lessons as kids
join public.lessons as adult
  on adult.course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
 and adult.lesson_number = kids.lesson_number
where mark.cohort_id = 'eb9b8795-713e-48a4-8d4a-bf995d188120'
  and mark.lesson_id = kids.id
  and kids.course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.cohort_lesson_homework as mark
set lesson_id = adult.id
from public.lessons as kids
join public.lessons as adult
  on adult.course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
 and adult.lesson_number = kids.lesson_number
where mark.cohort_id = 'eb9b8795-713e-48a4-8d4a-bf995d188120'
  and mark.lesson_id = kids.id
  and kids.course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.cohorts
set course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
where id = 'eb9b8795-713e-48a4-8d4a-bf995d188120'
  and course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.course_enrollments
set course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
where kid_profile_id in (
  'e1d8c5f5-2492-4d84-85fc-8d66de3097d4',
  '95ffbf0a-3d47-4765-90ce-85680466366b',
  'b8824453-1a0b-4967-a46d-345aebfbe130'
)
  and course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.course_access
set course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
where kid_profile_id in (
  'e1d8c5f5-2492-4d84-85fc-8d66de3097d4',
  '95ffbf0a-3d47-4765-90ce-85680466366b',
  'b8824453-1a0b-4967-a46d-345aebfbe130'
)
  and course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';

update public.student_packages
set course_id = '155d5df5-c442-4e95-a908-2a16fa2e8c8d'
where kid_profile_id in (
  'e1d8c5f5-2492-4d84-85fc-8d66de3097d4',
  '95ffbf0a-3d47-4765-90ce-85680466366b',
  'b8824453-1a0b-4967-a46d-345aebfbe130'
)
  and course_id = '9db3685b-15fe-41a3-b902-1c2db3000b33';
