-- Wrap bare auth.uid()/auth.jwt() in RLS policies as (select auth.uid()) / (select auth.jwt()).
-- Mechanical rewrite only: cmd, roles, permissive flag, and remaining logic unchanged.
-- Generated from live pg_policies. DO NOT APPLY until reviewed.

BEGIN;

-- public.admin_saved_views / Admins create saved views / INSERT
DROP POLICY IF EXISTS "Admins create saved views" ON public.admin_saved_views;
CREATE POLICY "Admins create saved views" ON public.admin_saved_views
  FOR INSERT
  TO authenticated
  WITH CHECK ((is_community_lead() AND (created_by = (select auth.uid()))));

-- public.admin_saved_views / Admins delete saved views / DELETE
DROP POLICY IF EXISTS "Admins delete saved views" ON public.admin_saved_views;
CREATE POLICY "Admins delete saved views" ON public.admin_saved_views
  FOR DELETE
  TO authenticated
  USING ((is_community_lead() AND ((created_by = (select auth.uid())) OR is_master_admin())));

-- public.admin_saved_views / Admins update saved views / UPDATE
DROP POLICY IF EXISTS "Admins update saved views" ON public.admin_saved_views;
CREATE POLICY "Admins update saved views" ON public.admin_saved_views
  FOR UPDATE
  TO authenticated
  USING ((is_community_lead() AND ((created_by = (select auth.uid())) OR is_master_admin())))
  WITH CHECK ((is_community_lead() AND ((created_by = (select auth.uid())) OR is_master_admin())));

-- public.audio_assets / Admins manage audio assets / ALL
DROP POLICY IF EXISTS "Admins manage audio assets" ON public.audio_assets;
CREATE POLICY "Admins manage audio assets" ON public.audio_assets
  FOR ALL
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

-- public.audio_generations / Admins manage audio generations / ALL
DROP POLICY IF EXISTS "Admins manage audio generations" ON public.audio_generations;
CREATE POLICY "Admins manage audio generations" ON public.audio_generations
  FOR ALL
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

-- public.battle_rounds / players can view their own rounds / SELECT
DROP POLICY IF EXISTS "players can view their own rounds" ON public.battle_rounds;
CREATE POLICY "players can view their own rounds" ON public.battle_rounds
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM battle_sessions bs
  WHERE ((bs.id = battle_rounds.session_id) AND ((bs.player_one_id = (select auth.uid())) OR (bs.player_two_id = (select auth.uid())))))));

-- public.battle_sessions / players can view their own sessions / SELECT
DROP POLICY IF EXISTS "players can view their own sessions" ON public.battle_sessions;
CREATE POLICY "players can view their own sessions" ON public.battle_sessions
  FOR SELECT
  TO authenticated
  USING ((((select auth.uid()) = player_one_id) OR ((select auth.uid()) = player_two_id)));

-- public.certificates / Learners read own certificates / SELECT
DROP POLICY IF EXISTS "Learners read own certificates" ON public.certificates;
CREATE POLICY "Learners read own certificates" ON public.certificates
  FOR SELECT
  TO authenticated
  USING (((profile_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id) OR is_master_admin() OR (is_tutor() AND ((issued_by = (select auth.uid())) OR tutor_can_issue_certificate((select auth.uid()), profile_id, kid_profile_id, level)))));

-- public.certificates / Tutors insert certificates for students they teach / INSERT
DROP POLICY IF EXISTS "Tutors insert certificates for students they teach" ON public.certificates;
CREATE POLICY "Tutors insert certificates for students they teach" ON public.certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (((issued_by = (select auth.uid())) AND (is_tutor() OR is_master_admin()) AND tutor_can_issue_certificate((select auth.uid()), profile_id, kid_profile_id, level)));

-- public.cohort_lesson_attendance / Students read own attendance / SELECT
DROP POLICY IF EXISTS "Students read own attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Students read own attendance" ON public.cohort_lesson_attendance
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)));

-- public.cohort_lesson_attendance / Tutors manage cohort attendance / INSERT
DROP POLICY IF EXISTS "Tutors manage cohort attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Tutors manage cohort attendance" ON public.cohort_lesson_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK ((tutor_can_manage_cohort(cohort_id) AND (marked_by = (select auth.uid()))));

-- public.cohort_lesson_attendance / Tutors update cohort attendance / UPDATE
DROP POLICY IF EXISTS "Tutors update cohort attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Tutors update cohort attendance" ON public.cohort_lesson_attendance
  FOR UPDATE
  TO authenticated
  USING (tutor_can_manage_cohort(cohort_id))
  WITH CHECK ((tutor_can_manage_cohort(cohort_id) AND (marked_by = (select auth.uid()))));

-- public.cohort_lesson_homework / Students read own homework marks / SELECT
DROP POLICY IF EXISTS "Students read own homework marks" ON public.cohort_lesson_homework;
CREATE POLICY "Students read own homework marks" ON public.cohort_lesson_homework
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)));

-- public.cohort_lesson_homework / Tutors manage cohort homework / INSERT
DROP POLICY IF EXISTS "Tutors manage cohort homework" ON public.cohort_lesson_homework;
CREATE POLICY "Tutors manage cohort homework" ON public.cohort_lesson_homework
  FOR INSERT
  TO authenticated
  WITH CHECK ((tutor_can_manage_cohort(cohort_id) AND (marked_by = (select auth.uid()))));

-- public.cohort_lesson_homework / Tutors update cohort homework / UPDATE
DROP POLICY IF EXISTS "Tutors update cohort homework" ON public.cohort_lesson_homework;
CREATE POLICY "Tutors update cohort homework" ON public.cohort_lesson_homework
  FOR UPDATE
  TO authenticated
  USING (tutor_can_manage_cohort(cohort_id))
  WITH CHECK ((tutor_can_manage_cohort(cohort_id) AND (marked_by = (select auth.uid()))));

-- public.cohort_lesson_log_entries / Students read own cohort lesson logs / SELECT
DROP POLICY IF EXISTS "Students read own cohort lesson logs" ON public.cohort_lesson_log_entries;
CREATE POLICY "Students read own cohort lesson logs" ON public.cohort_lesson_log_entries
  FOR SELECT
  TO authenticated
  USING (((cohort_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM cohort_members cm
  WHERE ((cm.cohort_id = cohort_lesson_log_entries.cohort_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL))))));

-- public.cohort_lesson_log_entries / Tutors read own cohort lesson logs / SELECT
DROP POLICY IF EXISTS "Tutors read own cohort lesson logs" ON public.cohort_lesson_log_entries;
CREATE POLICY "Tutors read own cohort lesson logs" ON public.cohort_lesson_log_entries
  FOR SELECT
  TO authenticated
  USING ((((cohort_id IS NOT NULL) AND tutor_can_manage_cohort(cohort_id)) OR ((package_instance_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM package_instances pi
  WHERE ((pi.id = cohort_lesson_log_entries.package_instance_id) AND ((pi.tutor_id = (select auth.uid())) OR is_master_admin())))))));

-- public.cohort_lesson_unlocks / Read cohort unlocks / SELECT
DROP POLICY IF EXISTS "Read cohort unlocks" ON public.cohort_lesson_unlocks;
CREATE POLICY "Read cohort unlocks" ON public.cohort_lesson_unlocks
  FOR SELECT
  TO authenticated
  USING ((is_master_admin() OR is_tutor() OR (EXISTS ( SELECT 1
   FROM cohort_members cm
  WHERE ((cm.cohort_id = cohort_lesson_unlocks.cohort_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL))))));

-- public.cohort_members / Read cohort membership / SELECT
DROP POLICY IF EXISTS "Read cohort membership" ON public.cohort_members;
CREATE POLICY "Read cohort membership" ON public.cohort_members
  FOR SELECT
  TO authenticated
  USING (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id) OR is_master_admin() OR tutor_can_manage_cohort(cohort_id)));

-- public.cohort_seat_holds / Users manage own cohort seat holds / ALL
DROP POLICY IF EXISTS "Users manage own cohort seat holds" ON public.cohort_seat_holds;
CREATE POLICY "Users manage own cohort seat holds" ON public.cohort_seat_holds
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.cohort_switch_requests / Students cancel own pending cohort switch requests / UPDATE
DROP POLICY IF EXISTS "Students cancel own pending cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Students cancel own pending cohort switch requests" ON public.cohort_switch_requests
  FOR UPDATE
  TO authenticated
  USING (((student_id = (select auth.uid())) AND (status = 'pending'::text)))
  WITH CHECK (((student_id = (select auth.uid())) AND (status = 'cancelled'::text)));

-- public.cohort_switch_requests / Students create cohort switch requests / INSERT
DROP POLICY IF EXISTS "Students create cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Students create cohort switch requests" ON public.cohort_switch_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (((student_id = (select auth.uid())) AND student_can_view_session(session_id, (select auth.uid()))));

-- public.cohort_switch_requests / Students read own cohort switch requests / SELECT
DROP POLICY IF EXISTS "Students read own cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Students read own cohort switch requests" ON public.cohort_switch_requests
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR tutor_owns_session(session_id, (select auth.uid())) OR is_master_admin()));

-- public.cohorts / Staff read cohorts / SELECT
DROP POLICY IF EXISTS "Staff read cohorts" ON public.cohorts;
CREATE POLICY "Staff read cohorts" ON public.cohorts
  FOR SELECT
  TO authenticated
  USING ((is_master_admin() OR tutor_can_manage_cohort(id) OR (EXISTS ( SELECT 1
   FROM cohort_members cm
  WHERE ((cm.cohort_id = cm.id) AND (cm.left_at IS NULL) AND ((cm.user_id = (select auth.uid())) OR parent_owns_kid_profile(cm.kid_profile_id)))))));

-- public.course_access / Users can read own course access / SELECT
DROP POLICY IF EXISTS "Users can read own course access" ON public.course_access;
CREATE POLICY "Users can read own course access" ON public.course_access
  FOR SELECT
  TO authenticated
  USING ((((select auth.uid()) = user_id) OR parent_owns_kid_profile(kid_profile_id)));

-- public.course_enrollments / Read own enrollment / SELECT
DROP POLICY IF EXISTS "Read own enrollment" ON public.course_enrollments;
CREATE POLICY "Read own enrollment" ON public.course_enrollments
  FOR SELECT
  TO authenticated
  USING (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id) OR (tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.course_enrollments / Staff manage enrollments / ALL
DROP POLICY IF EXISTS "Staff manage enrollments" ON public.course_enrollments;
CREATE POLICY "Staff manage enrollments" ON public.course_enrollments
  FOR ALL
  TO authenticated
  USING ((is_master_admin() OR (tutor_id = (select auth.uid()))))
  WITH CHECK ((is_master_admin() OR (tutor_id = (select auth.uid()))));

-- public.course_interest_signups / Users insert own course interest / INSERT
DROP POLICY IF EXISTS "Users insert own course interest" ON public.course_interest_signups;
CREATE POLICY "Users insert own course interest" ON public.course_interest_signups
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (select auth.uid())));

-- public.course_interest_signups / Users read own course interest / SELECT
DROP POLICY IF EXISTS "Users read own course interest" ON public.course_interest_signups;
CREATE POLICY "Users read own course interest" ON public.course_interest_signups
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.course_resource_tours_seen / Users can insert their own tour records / INSERT
DROP POLICY IF EXISTS "Users can insert their own tour records" ON public.course_resource_tours_seen;
CREATE POLICY "Users can insert their own tour records" ON public.course_resource_tours_seen
  FOR INSERT
  TO public
  WITH CHECK (((select auth.uid()) = user_id));

-- public.course_resource_tours_seen / Users can view their own tour records / SELECT
DROP POLICY IF EXISTS "Users can view their own tour records" ON public.course_resource_tours_seen;
CREATE POLICY "Users can view their own tour records" ON public.course_resource_tours_seen
  FOR SELECT
  TO public
  USING (((select auth.uid()) = user_id));

-- public.courses / Read visible courses / SELECT
DROP POLICY IF EXISTS "Read visible courses" ON public.courses;
CREATE POLICY "Read visible courses" ON public.courses
  FOR SELECT
  TO anon, authenticated
  USING (((is_public = true) OR is_admin() OR (EXISTS ( SELECT 1
   FROM course_access ca
  WHERE ((ca.course_id = courses.id) AND (ca.user_id = (select auth.uid())))))));

-- public.custom_sets / Users manage own custom sets / ALL
DROP POLICY IF EXISTS "Users manage own custom sets" ON public.custom_sets;
CREATE POLICY "Users manage own custom sets" ON public.custom_sets
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.elevenlabs_tts_config / Admins manage elevenlabs tts config / ALL
DROP POLICY IF EXISTS "Admins manage elevenlabs tts config" ON public.elevenlabs_tts_config;
CREATE POLICY "Admins manage elevenlabs tts config" ON public.elevenlabs_tts_config
  FOR ALL
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

-- public.english_lesson_xp_awarded / Users can read own english lesson xp awards / SELECT
DROP POLICY IF EXISTS "Users can read own english lesson xp awards" ON public.english_lesson_xp_awarded;
CREATE POLICY "Users can read own english lesson xp awards" ON public.english_lesson_xp_awarded
  FOR SELECT
  TO authenticated
  USING (((select auth.uid()) = user_id));

-- public.feedback_submissions / Users insert own feedback / INSERT
DROP POLICY IF EXISTS "Users insert own feedback" ON public.feedback_submissions;
CREATE POLICY "Users insert own feedback" ON public.feedback_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (select auth.uid())));

-- public.feedback_submissions / Users read own feedback / SELECT
DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback_submissions;
CREATE POLICY "Users read own feedback" ON public.feedback_submissions
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.feedback_submissions / Users update own feedback sync / UPDATE
DROP POLICY IF EXISTS "Users update own feedback sync" ON public.feedback_submissions;
CREATE POLICY "Users update own feedback sync" ON public.feedback_submissions
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.fill_blank_questions / Read fill blank when lesson unlocked / SELECT
DROP POLICY IF EXISTS "Read fill blank when lesson unlocked" ON public.fill_blank_questions;
CREATE POLICY "Read fill blank when lesson unlocked" ON public.fill_blank_questions
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM lesson_segments ls
  WHERE ((ls.id = fill_blank_questions.segment_id) AND is_lesson_content_unlocked((select auth.uid()), ls.lesson_id)))));

-- public.flashcard_progress / Users manage own flashcard progress / ALL
DROP POLICY IF EXISTS "Users manage own flashcard progress" ON public.flashcard_progress;
CREATE POLICY "Users manage own flashcard progress" ON public.flashcard_progress
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.forum_likes / Forum members like content / INSERT
DROP POLICY IF EXISTS "Forum members like content" ON public.forum_likes;
CREATE POLICY "Forum members like content" ON public.forum_likes
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_can_access_forum() AND (user_id = (select auth.uid())) AND (((post_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM forum_posts p
  WHERE ((p.id = forum_likes.post_id) AND (p.status = 'visible'::text))))) OR ((reply_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM forum_replies r
  WHERE ((r.id = forum_likes.reply_id) AND (r.status = 'visible'::text))))))));

-- public.forum_likes / Forum members unlike content / DELETE
DROP POLICY IF EXISTS "Forum members unlike content" ON public.forum_likes;
CREATE POLICY "Forum members unlike content" ON public.forum_likes
  FOR DELETE
  TO authenticated
  USING ((user_can_access_forum() AND (user_id = (select auth.uid()))));

-- public.forum_posts / Forum delete own posts / DELETE
DROP POLICY IF EXISTS "Forum delete own posts" ON public.forum_posts;
CREATE POLICY "Forum delete own posts" ON public.forum_posts
  FOR DELETE
  TO authenticated
  USING ((user_can_access_forum() AND (author_id = (select auth.uid()))));

-- public.forum_posts / Forum members create posts / INSERT
DROP POLICY IF EXISTS "Forum members create posts" ON public.forum_posts;
CREATE POLICY "Forum members create posts" ON public.forum_posts
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_can_access_forum() AND (author_id = (select auth.uid())) AND (status = 'visible'::text)));

-- public.forum_posts / Forum members read posts / SELECT
DROP POLICY IF EXISTS "Forum members read posts" ON public.forum_posts;
CREATE POLICY "Forum members read posts" ON public.forum_posts
  FOR SELECT
  TO authenticated
  USING ((user_can_access_forum() AND ((status = 'visible'::text) OR (author_id = (select auth.uid())) OR is_forum_moderator())));

-- public.forum_posts / Forum update posts / UPDATE
DROP POLICY IF EXISTS "Forum update posts" ON public.forum_posts;
CREATE POLICY "Forum update posts" ON public.forum_posts
  FOR UPDATE
  TO authenticated
  USING ((user_can_access_forum() AND ((author_id = (select auth.uid())) OR is_forum_moderator())))
  WITH CHECK ((user_can_access_forum() AND ((author_id = (select auth.uid())) OR is_forum_moderator())));

-- public.forum_replies / Forum delete own replies / DELETE
DROP POLICY IF EXISTS "Forum delete own replies" ON public.forum_replies;
CREATE POLICY "Forum delete own replies" ON public.forum_replies
  FOR DELETE
  TO authenticated
  USING ((user_can_access_forum() AND (author_id = (select auth.uid()))));

-- public.forum_replies / Forum members create replies / INSERT
DROP POLICY IF EXISTS "Forum members create replies" ON public.forum_replies;
CREATE POLICY "Forum members create replies" ON public.forum_replies
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_can_access_forum() AND (author_id = (select auth.uid())) AND (status = 'visible'::text) AND (EXISTS ( SELECT 1
   FROM forum_posts p
  WHERE ((p.id = forum_replies.post_id) AND (p.status = 'visible'::text)))) AND ((parent_reply_id IS NULL) OR (EXISTS ( SELECT 1
   FROM forum_replies pr
  WHERE ((pr.id = pr.parent_reply_id) AND (pr.post_id = pr.post_id) AND (pr.status = 'visible'::text)))))));

-- public.forum_replies / Forum members read replies / SELECT
DROP POLICY IF EXISTS "Forum members read replies" ON public.forum_replies;
CREATE POLICY "Forum members read replies" ON public.forum_replies
  FOR SELECT
  TO authenticated
  USING ((user_can_access_forum() AND ((status = 'visible'::text) OR (author_id = (select auth.uid())) OR is_forum_moderator())));

-- public.forum_replies / Forum update replies / UPDATE
DROP POLICY IF EXISTS "Forum update replies" ON public.forum_replies;
CREATE POLICY "Forum update replies" ON public.forum_replies
  FOR UPDATE
  TO authenticated
  USING ((user_can_access_forum() AND ((author_id = (select auth.uid())) OR is_forum_moderator())))
  WITH CHECK ((user_can_access_forum() AND ((author_id = (select auth.uid())) OR is_forum_moderator())));

-- public.forum_reports / Forum members create reports / INSERT
DROP POLICY IF EXISTS "Forum members create reports" ON public.forum_reports;
CREATE POLICY "Forum members create reports" ON public.forum_reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_can_access_forum() AND (reporter_id = (select auth.uid()))));

-- public.forum_reports / Forum read own reports / SELECT
DROP POLICY IF EXISTS "Forum read own reports" ON public.forum_reports;
CREATE POLICY "Forum read own reports" ON public.forum_reports
  FOR SELECT
  TO authenticated
  USING (((reporter_id = (select auth.uid())) OR is_forum_moderator()));

-- public.friend_game_challenges / Participants read own challenges / SELECT
DROP POLICY IF EXISTS "Participants read own challenges" ON public.friend_game_challenges;
CREATE POLICY "Participants read own challenges" ON public.friend_game_challenges
  FOR SELECT
  TO public
  USING ((((select auth.uid()) = challenger_id) OR ((select auth.uid()) = challenged_id)));

-- public.friend_requests / Users read friend requests they participate in / SELECT
DROP POLICY IF EXISTS "Users read friend requests they participate in" ON public.friend_requests;
CREATE POLICY "Users read friend requests they participate in" ON public.friend_requests
  FOR SELECT
  TO authenticated
  USING (((from_user_id = (select auth.uid())) OR (to_user_id = (select auth.uid()))));

-- public.friendships / Users read own friendships / SELECT
DROP POLICY IF EXISTS "Users read own friendships" ON public.friendships;
CREATE POLICY "Users read own friendships" ON public.friendships
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.game_room_jeopardy_tiles / participants can view jeopardy tiles / SELECT
DROP POLICY IF EXISTS "participants can view jeopardy tiles" ON public.game_room_jeopardy_tiles;
CREATE POLICY "participants can view jeopardy tiles" ON public.game_room_jeopardy_tiles
  FOR SELECT
  TO authenticated
  USING (_game_room_is_active_participant(room_id, (select auth.uid())));

-- public.game_room_ladder_questions / participants can view ladder questions / SELECT
DROP POLICY IF EXISTS "participants can view ladder questions" ON public.game_room_ladder_questions;
CREATE POLICY "participants can view ladder questions" ON public.game_room_ladder_questions
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM game_room_ladder_runs r
  WHERE ((r.id = game_room_ladder_questions.run_id) AND _game_room_is_active_participant(r.room_id, (select auth.uid()))))));

-- public.game_room_ladder_runs / participants can view ladder runs / SELECT
DROP POLICY IF EXISTS "participants can view ladder runs" ON public.game_room_ladder_runs;
CREATE POLICY "participants can view ladder runs" ON public.game_room_ladder_runs
  FOR SELECT
  TO authenticated
  USING (_game_room_is_active_participant(room_id, (select auth.uid())));

-- public.game_room_ladder_votes / participants can view ladder votes / SELECT
DROP POLICY IF EXISTS "participants can view ladder votes" ON public.game_room_ladder_votes;
CREATE POLICY "participants can view ladder votes" ON public.game_room_ladder_votes
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (game_room_ladder_questions q
     JOIN game_room_ladder_runs r ON ((r.id = q.run_id)))
  WHERE ((q.id = game_room_ladder_votes.question_id) AND _game_room_is_active_participant(r.room_id, (select auth.uid()))))));

-- public.game_room_participants / participants can view room roster / SELECT
DROP POLICY IF EXISTS "participants can view room roster" ON public.game_room_participants;
CREATE POLICY "participants can view room roster" ON public.game_room_participants
  FOR SELECT
  TO authenticated
  USING (_game_room_is_active_participant(room_id, (select auth.uid())));

-- public.game_room_race_state / players can view own race state / SELECT
DROP POLICY IF EXISTS "players can view own race state" ON public.game_room_race_state;
CREATE POLICY "players can view own race state" ON public.game_room_race_state
  FOR SELECT
  TO authenticated
  USING (((player_id = (select auth.uid())) AND _game_room_is_active_participant(room_id, (select auth.uid()))));

-- public.game_room_rounds / participants can view room rounds / SELECT
DROP POLICY IF EXISTS "participants can view room rounds" ON public.game_room_rounds;
CREATE POLICY "participants can view room rounds" ON public.game_room_rounds
  FOR SELECT
  TO authenticated
  USING (_game_room_is_active_participant(room_id, (select auth.uid())));

-- public.game_rooms / participants can view their game rooms / SELECT
DROP POLICY IF EXISTS "participants can view their game rooms" ON public.game_rooms;
CREATE POLICY "participants can view their game rooms" ON public.game_rooms
  FOR SELECT
  TO authenticated
  USING (_game_room_is_active_participant(id, (select auth.uid())));

-- public.game_scores / Users manage own game scores / ALL
DROP POLICY IF EXISTS "Users manage own game scores" ON public.game_scores;
CREATE POLICY "Users manage own game scores" ON public.game_scores
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.homework_due_reminder_logs / Students read own homework due reminders / SELECT
DROP POLICY IF EXISTS "Students read own homework due reminders" ON public.homework_due_reminder_logs;
CREATE POLICY "Students read own homework due reminders" ON public.homework_due_reminder_logs
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR is_master_admin()));

-- public.homework_submissions / Students insert own homework / INSERT
DROP POLICY IF EXISTS "Students insert own homework" ON public.homework_submissions;
CREATE POLICY "Students insert own homework" ON public.homework_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK ((((student_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)) AND (status = 'pending_review'::text) AND (approved IS NULL)));

-- public.homework_submissions / Students read own homework / SELECT
DROP POLICY IF EXISTS "Students read own homework" ON public.homework_submissions;
CREATE POLICY "Students read own homework" ON public.homework_submissions
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)));

-- public.homework_submissions / Tutors read student homework / SELECT
DROP POLICY IF EXISTS "Tutors read student homework" ON public.homework_submissions;
CREATE POLICY "Tutors read student homework" ON public.homework_submissions
  FOR SELECT
  TO authenticated
  USING ((is_master_admin() OR tutor_teaches_student_for_lesson((select auth.uid()), student_id, lesson_id) OR tutor_teaches_kid_for_lesson((select auth.uid()), kid_profile_id, lesson_id)));

-- public.homework_submissions / Tutors review pending homework / UPDATE
DROP POLICY IF EXISTS "Tutors review pending homework" ON public.homework_submissions;
CREATE POLICY "Tutors review pending homework" ON public.homework_submissions
  FOR UPDATE
  TO authenticated
  USING (((status = 'pending_review'::text) AND (is_master_admin() OR tutor_teaches_student_for_lesson((select auth.uid()), student_id, lesson_id) OR tutor_teaches_kid_for_lesson((select auth.uid()), kid_profile_id, lesson_id))))
  WITH CHECK (((status = 'reviewed'::text) AND (is_master_admin() OR tutor_teaches_student_for_lesson((select auth.uid()), student_id, lesson_id) OR tutor_teaches_kid_for_lesson((select auth.uid()), kid_profile_id, lesson_id))));

-- public.homework_text_questions / Read homework text when lesson unlocked / SELECT
DROP POLICY IF EXISTS "Read homework text when lesson unlocked" ON public.homework_text_questions;
CREATE POLICY "Read homework text when lesson unlocked" ON public.homework_text_questions
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM lesson_segments ls
  WHERE ((ls.id = homework_text_questions.segment_id) AND is_lesson_content_unlocked((select auth.uid()), ls.lesson_id)))));

-- public.kid_activity_log / Parents insert kid activity / INSERT
DROP POLICY IF EXISTS "Parents insert kid activity" ON public.kid_activity_log;
CREATE POLICY "Parents insert kid activity" ON public.kid_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM kid_profiles kp
  WHERE ((kp.id = kid_activity_log.kid_profile_id) AND (kp.parent_user_id = (select auth.uid()))))));

-- public.kid_activity_log / Parents read kid activity / SELECT
DROP POLICY IF EXISTS "Parents read kid activity" ON public.kid_activity_log;
CREATE POLICY "Parents read kid activity" ON public.kid_activity_log
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM kid_profiles kp
  WHERE ((kp.id = kid_activity_log.kid_profile_id) AND (kp.parent_user_id = (select auth.uid()))))));

-- public.kid_lesson_xp_awarded / Parents insert kid lesson xp awards / INSERT
DROP POLICY IF EXISTS "Parents insert kid lesson xp awards" ON public.kid_lesson_xp_awarded;
CREATE POLICY "Parents insert kid lesson xp awards" ON public.kid_lesson_xp_awarded
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM kid_profiles kp
  WHERE ((kp.id = kid_lesson_xp_awarded.kid_profile_id) AND (kp.parent_user_id = (select auth.uid()))))));

-- public.kid_lesson_xp_awarded / Parents read kid lesson xp awards / SELECT
DROP POLICY IF EXISTS "Parents read kid lesson xp awards" ON public.kid_lesson_xp_awarded;
CREATE POLICY "Parents read kid lesson xp awards" ON public.kid_lesson_xp_awarded
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM kid_profiles kp
  WHERE ((kp.id = kid_lesson_xp_awarded.kid_profile_id) AND (kp.parent_user_id = (select auth.uid()))))));

-- public.kid_profiles / Parents manage own kid profiles / ALL
DROP POLICY IF EXISTS "Parents manage own kid profiles" ON public.kid_profiles;
CREATE POLICY "Parents manage own kid profiles" ON public.kid_profiles
  FOR ALL
  TO authenticated
  USING ((parent_user_id = (select auth.uid())))
  WITH CHECK ((parent_user_id = (select auth.uid())));

-- public.kid_session_context / Parents manage own kid session / ALL
DROP POLICY IF EXISTS "Parents manage own kid session" ON public.kid_session_context;
CREATE POLICY "Parents manage own kid session" ON public.kid_session_context
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.kid_stickers / Parents insert kid stickers / INSERT
DROP POLICY IF EXISTS "Parents insert kid stickers" ON public.kid_stickers;
CREATE POLICY "Parents insert kid stickers" ON public.kid_stickers
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM kid_profiles kp
  WHERE ((kp.id = kid_stickers.kid_profile_id) AND (kp.parent_user_id = (select auth.uid()))))));

-- public.kid_stickers / Parents read kid stickers / SELECT
DROP POLICY IF EXISTS "Parents read kid stickers" ON public.kid_stickers;
CREATE POLICY "Parents read kid stickers" ON public.kid_stickers
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM kid_profiles kp
  WHERE ((kp.id = kid_stickers.kid_profile_id) AND (kp.parent_user_id = (select auth.uid()))))));

-- public.lesson_audio_generations / Admins manage lesson audio generations / ALL
DROP POLICY IF EXISTS "Admins manage lesson audio generations" ON public.lesson_audio_generations;
CREATE POLICY "Admins manage lesson audio generations" ON public.lesson_audio_generations
  FOR ALL
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

-- public.lesson_progress / Users manage own lesson progress / ALL
DROP POLICY IF EXISTS "Users manage own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users manage own lesson progress" ON public.lesson_progress
  FOR ALL
  TO authenticated
  USING (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)))
  WITH CHECK (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)));

-- public.lesson_recordings / Read visible lesson recordings / SELECT
DROP POLICY IF EXISTS "Read visible lesson recordings" ON public.lesson_recordings;
CREATE POLICY "Read visible lesson recordings" ON public.lesson_recordings
  FOR SELECT
  TO authenticated
  USING (can_view_lesson_recording((select auth.uid()), id));

-- public.lesson_recordings / Staff manage lesson recordings / ALL
DROP POLICY IF EXISTS "Staff manage lesson recordings" ON public.lesson_recordings;
CREATE POLICY "Staff manage lesson recordings" ON public.lesson_recordings
  FOR ALL
  TO authenticated
  USING ((is_master_admin() OR (is_tutor() AND (((student_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM course_enrollments ce
  WHERE ((ce.user_id = lesson_recordings.student_id) AND (ce.tutor_id = (select auth.uid())))))) OR ((cohort_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM cohorts co
  WHERE ((co.id = lesson_recordings.cohort_id) AND ((co.tutor_id = (select auth.uid())) OR is_master_admin())))))))))
  WITH CHECK ((is_master_admin() OR (is_tutor() AND (uploaded_by = (select auth.uid())))));

-- public.lesson_reschedule_requests / Students cancel own pending requests / UPDATE
DROP POLICY IF EXISTS "Students cancel own pending requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Students cancel own pending requests" ON public.lesson_reschedule_requests
  FOR UPDATE
  TO authenticated
  USING (((student_id = (select auth.uid())) AND (status = 'pending'::text)))
  WITH CHECK (((student_id = (select auth.uid())) AND (status = 'cancelled'::text)));

-- public.lesson_reschedule_requests / Students create reschedule requests / INSERT
DROP POLICY IF EXISTS "Students create reschedule requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Students create reschedule requests" ON public.lesson_reschedule_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (((student_id = (select auth.uid())) AND student_can_view_session(session_id, (select auth.uid()))));

-- public.lesson_reschedule_requests / Students read own reschedule requests / SELECT
DROP POLICY IF EXISTS "Students read own reschedule requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Students read own reschedule requests" ON public.lesson_reschedule_requests
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR tutor_owns_session(session_id, (select auth.uid())) OR is_master_admin()));

-- public.lesson_reschedule_requests / Tutors resolve reschedule requests / UPDATE
DROP POLICY IF EXISTS "Tutors resolve reschedule requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Tutors resolve reschedule requests" ON public.lesson_reschedule_requests
  FOR UPDATE
  TO authenticated
  USING (((status = 'pending'::text) AND (tutor_owns_session(session_id, (select auth.uid())) OR is_master_admin())))
  WITH CHECK (((status = ANY (ARRAY['approved'::text, 'denied'::text])) AND (tutor_owns_session(session_id, (select auth.uid())) OR is_master_admin())));

-- public.lesson_segment_beats / Read beats when segment lesson unlocked / SELECT
DROP POLICY IF EXISTS "Read beats when segment lesson unlocked" ON public.lesson_segment_beats;
CREATE POLICY "Read beats when segment lesson unlocked" ON public.lesson_segment_beats
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM lesson_segments ls
  WHERE ((ls.id = lesson_segment_beats.segment_id) AND is_lesson_content_unlocked((select auth.uid()), ls.lesson_id)))));

-- public.lesson_segment_progress / Users manage own segment progress / ALL
DROP POLICY IF EXISTS "Users manage own segment progress" ON public.lesson_segment_progress;
CREATE POLICY "Users manage own segment progress" ON public.lesson_segment_progress
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.lesson_segments / Read lesson segments when lesson unlocked / SELECT
DROP POLICY IF EXISTS "Read lesson segments when lesson unlocked" ON public.lesson_segments;
CREATE POLICY "Read lesson segments when lesson unlocked" ON public.lesson_segments
  FOR SELECT
  TO authenticated
  USING (is_lesson_content_unlocked((select auth.uid()), lesson_id));

-- public.lesson_sentences / Read visible lesson_sentences / SELECT
DROP POLICY IF EXISTS "Read visible lesson_sentences" ON public.lesson_sentences;
CREATE POLICY "Read visible lesson_sentences" ON public.lesson_sentences
  FOR SELECT
  TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = lesson_sentences.lesson_id) AND ((c.is_public = true) OR is_admin() OR (EXISTS ( SELECT 1
           FROM course_access ca
          WHERE ((ca.course_id = c.id) AND (ca.user_id = (select auth.uid()))))))))));

-- public.lessons / Read visible lessons / SELECT
DROP POLICY IF EXISTS "Read visible lessons" ON public.lessons;
CREATE POLICY "Read visible lessons" ON public.lessons
  FOR SELECT
  TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND ((c.is_public = true) OR is_admin() OR (EXISTS ( SELECT 1
           FROM course_access ca
          WHERE ((ca.course_id = c.id) AND (ca.user_id = (select auth.uid()))))))))));

-- public.level_test_attempts / Users read own level test attempts / SELECT
DROP POLICY IF EXISTS "Users read own level test attempts" ON public.level_test_attempts;
CREATE POLICY "Users read own level test attempts" ON public.level_test_attempts
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.level_test_skill_results / Users read own level test skill results / SELECT
DROP POLICY IF EXISTS "Users read own level test skill results" ON public.level_test_skill_results;
CREATE POLICY "Users read own level test skill results" ON public.level_test_skill_results
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM level_test_attempts a
  WHERE ((a.id = level_test_skill_results.attempt_id) AND (a.user_id = (select auth.uid()))))));

-- public.live_translate_usage / Users read own live translate usage / SELECT
DROP POLICY IF EXISTS "Users read own live translate usage" ON public.live_translate_usage;
CREATE POLICY "Users read own live translate usage" ON public.live_translate_usage
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.match_scores / Users manage own match scores / ALL
DROP POLICY IF EXISTS "Users manage own match scores" ON public.match_scores;
CREATE POLICY "Users manage own match scores" ON public.match_scores
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.memberships / Users can view own memberships / SELECT
DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
CREATE POLICY "Users can view own memberships" ON public.memberships
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.monthly_reward_winners / Users read own monthly reward wins / SELECT
DROP POLICY IF EXISTS "Users read own monthly reward wins" ON public.monthly_reward_winners;
CREATE POLICY "Users read own monthly reward wins" ON public.monthly_reward_winners
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.notification_kudos / Users read kudos on own notifications / SELECT
DROP POLICY IF EXISTS "Users read kudos on own notifications" ON public.notification_kudos;
CREATE POLICY "Users read kudos on own notifications" ON public.notification_kudos
  FOR SELECT
  TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM notifications n
  WHERE ((n.id = notification_kudos.notification_id) AND (n.user_id = (select auth.uid()))))) OR (from_user_id = (select auth.uid()))));

-- public.notification_settings / Users manage own notification settings / ALL
DROP POLICY IF EXISTS "Users manage own notification settings" ON public.notification_settings;
CREATE POLICY "Users manage own notification settings" ON public.notification_settings
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.notifications / Users read own notifications / SELECT
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.package_instances / Staff manage package instances / ALL
DROP POLICY IF EXISTS "Staff manage package instances" ON public.package_instances;
CREATE POLICY "Staff manage package instances" ON public.package_instances
  FOR ALL
  TO authenticated
  USING ((is_community_lead() OR (tutor_id = (select auth.uid()))))
  WITH CHECK ((is_community_lead() OR (tutor_id = (select auth.uid()))));

-- public.package_instances / Staff read package instances / SELECT
DROP POLICY IF EXISTS "Staff read package instances" ON public.package_instances;
CREATE POLICY "Staff read package instances" ON public.package_instances
  FOR SELECT
  TO authenticated
  USING ((is_community_lead() OR (tutor_id = (select auth.uid())) OR is_tutor()));

-- public.pending_rebookings / Students read own pending rebookings / SELECT
DROP POLICY IF EXISTS "Students read own pending rebookings" ON public.pending_rebookings;
CREATE POLICY "Students read own pending rebookings" ON public.pending_rebookings
  FOR SELECT
  TO authenticated
  USING ((student_profile_id = (select auth.uid())));

-- public.photo_translate_usage / Users read own photo translate usage / SELECT
DROP POLICY IF EXISTS "Users read own photo translate usage" ON public.photo_translate_usage;
CREATE POLICY "Users read own photo translate usage" ON public.photo_translate_usage
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.profile_course_access / Users can read own course access / SELECT
DROP POLICY IF EXISTS "Users can read own course access" ON public.profile_course_access;
CREATE POLICY "Users can read own course access" ON public.profile_course_access
  FOR SELECT
  TO authenticated
  USING ((((select auth.uid()) = user_id) OR parent_owns_kid_profile(kid_profile_id)));

-- public.profile_roles / Users read own profile roles / SELECT
DROP POLICY IF EXISTS "Users read own profile roles" ON public.profile_roles;
CREATE POLICY "Users read own profile roles" ON public.profile_roles
  FOR SELECT
  TO authenticated
  USING (((user_id = (select auth.uid())) OR is_master_admin() OR is_staff()));

-- public.profiles / Users can insert own profile / INSERT
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (((select auth.uid()) = id));

-- public.profiles / Users can read own profile / SELECT
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (((select auth.uid()) = id));

-- public.profiles / Users can update own profile / UPDATE
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (((select auth.uid()) = id))
  WITH CHECK (((select auth.uid()) = id));

-- public.profiles / Users can view own profile / SELECT
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((id = (select auth.uid())));

-- public.pronunciation_dictionary_rules / Admins manage pronunciation rules / ALL
DROP POLICY IF EXISTS "Admins manage pronunciation rules" ON public.pronunciation_dictionary_rules;
CREATE POLICY "Admins manage pronunciation rules" ON public.pronunciation_dictionary_rules
  FOR ALL
  TO authenticated
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

-- public.quiz_progress / Users manage own quiz progress / ALL
DROP POLICY IF EXISTS "Users manage own quiz progress" ON public.quiz_progress;
CREATE POLICY "Users manage own quiz progress" ON public.quiz_progress
  FOR ALL
  TO authenticated
  USING (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)))
  WITH CHECK (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id)));

-- public.quiz_questions / Read visible quiz_questions / SELECT
DROP POLICY IF EXISTS "Read visible quiz_questions" ON public.quiz_questions;
CREATE POLICY "Read visible quiz_questions" ON public.quiz_questions
  FOR SELECT
  TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM (quizzes q
     LEFT JOIN courses c ON ((c.id = q.course_id)))
  WHERE ((q.id = quiz_questions.quiz_id) AND ((q.course_id IS NULL) OR (c.is_public = true) OR is_admin() OR (EXISTS ( SELECT 1
           FROM course_access ca
          WHERE ((ca.course_id = c.id) AND (ca.user_id = (select auth.uid()))))))))));

-- public.quizzes / Read visible quizzes / SELECT
DROP POLICY IF EXISTS "Read visible quizzes" ON public.quizzes;
CREATE POLICY "Read visible quizzes" ON public.quizzes
  FOR SELECT
  TO anon, authenticated
  USING (((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = quizzes.course_id) AND ((c.is_public = true) OR is_admin() OR (EXISTS ( SELECT 1
           FROM course_access ca
          WHERE ((ca.course_id = c.id) AND (ca.user_id = (select auth.uid())))))))))));

-- public.referrals / Referrers can read own referrals / SELECT
DROP POLICY IF EXISTS "Referrers can read own referrals" ON public.referrals;
CREATE POLICY "Referrers can read own referrals" ON public.referrals
  FOR SELECT
  TO authenticated
  USING ((referrer_user_id = (select auth.uid())));

-- public.speaking_practice_attempts / Users read own speaking practice attempts / SELECT
DROP POLICY IF EXISTS "Users read own speaking practice attempts" ON public.speaking_practice_attempts;
CREATE POLICY "Users read own speaking practice attempts" ON public.speaking_practice_attempts
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.speaking_practice_attempts / Users update own speaking practice attempts / UPDATE
DROP POLICY IF EXISTS "Users update own speaking practice attempts" ON public.speaking_practice_attempts;
CREATE POLICY "Users update own speaking practice attempts" ON public.speaking_practice_attempts
  FOR UPDATE
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.student_discount_requests / Users insert own student discount requests / INSERT
DROP POLICY IF EXISTS "Users insert own student discount requests" ON public.student_discount_requests;
CREATE POLICY "Users insert own student discount requests" ON public.student_discount_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_id = (select auth.uid())) AND (status = 'pending'::text)));

-- public.student_discount_requests / Users read own student discount requests / SELECT
DROP POLICY IF EXISTS "Users read own student discount requests" ON public.student_discount_requests;
CREATE POLICY "Users read own student discount requests" ON public.student_discount_requests
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.student_discount_requests / Users update own rejected student discount requests / UPDATE
DROP POLICY IF EXISTS "Users update own rejected student discount requests" ON public.student_discount_requests;
CREATE POLICY "Users update own rejected student discount requests" ON public.student_discount_requests
  FOR UPDATE
  TO authenticated
  USING (((user_id = (select auth.uid())) AND (status = 'rejected'::text)))
  WITH CHECK (((user_id = (select auth.uid())) AND (status = 'pending'::text)));

-- public.student_lesson_unlocks / Read student unlocks / SELECT
DROP POLICY IF EXISTS "Read student unlocks" ON public.student_lesson_unlocks;
CREATE POLICY "Read student unlocks" ON public.student_lesson_unlocks
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id) OR is_master_admin() OR (EXISTS ( SELECT 1
   FROM course_enrollments ce
  WHERE ((ce.user_id = student_lesson_unlocks.student_id) AND (ce.tutor_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM course_enrollments ce
  WHERE ((ce.kid_profile_id = student_lesson_unlocks.kid_profile_id) AND (ce.tutor_id = (select auth.uid())))))));

-- public.student_lesson_unlocks / Tutor manage student unlocks / ALL
DROP POLICY IF EXISTS "Tutor manage student unlocks" ON public.student_lesson_unlocks;
CREATE POLICY "Tutor manage student unlocks" ON public.student_lesson_unlocks
  FOR ALL
  TO authenticated
  USING ((is_master_admin() OR (EXISTS ( SELECT 1
   FROM course_enrollments ce
  WHERE ((ce.user_id = student_lesson_unlocks.student_id) AND (ce.tutor_id = (select auth.uid())))))))
  WITH CHECK ((is_master_admin() OR (EXISTS ( SELECT 1
   FROM course_enrollments ce
  WHERE ((ce.user_id = student_lesson_unlocks.student_id) AND (ce.tutor_id = (select auth.uid())))))));

-- public.student_packages / Students read own packages / SELECT
DROP POLICY IF EXISTS "Students read own packages" ON public.student_packages;
CREATE POLICY "Students read own packages" ON public.student_packages
  FOR SELECT
  TO authenticated
  USING (((user_id = (select auth.uid())) OR parent_owns_kid_profile(kid_profile_id) OR is_master_admin()));

-- public.topic_mastery / Users manage own topic mastery / ALL
DROP POLICY IF EXISTS "Users manage own topic mastery" ON public.topic_mastery;
CREATE POLICY "Users manage own topic mastery" ON public.topic_mastery
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.translate_questions / Read translate when lesson unlocked / SELECT
DROP POLICY IF EXISTS "Read translate when lesson unlocked" ON public.translate_questions;
CREATE POLICY "Read translate when lesson unlocked" ON public.translate_questions
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM lesson_segments ls
  WHERE ((ls.id = translate_questions.segment_id) AND is_lesson_content_unlocked((select auth.uid()), ls.lesson_id)))));

-- public.tutor_availability_settings / Students read tutor availability settings / SELECT
DROP POLICY IF EXISTS "Students read tutor availability settings" ON public.tutor_availability_settings;
CREATE POLICY "Students read tutor availability settings" ON public.tutor_availability_settings
  FOR SELECT
  TO authenticated
  USING (((one_to_one_booking_enabled = true) OR (tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_availability_settings / Tutors manage own availability settings / ALL
DROP POLICY IF EXISTS "Tutors manage own availability settings" ON public.tutor_availability_settings;
CREATE POLICY "Tutors manage own availability settings" ON public.tutor_availability_settings
  FOR ALL
  TO authenticated
  USING (((tutor_id = (select auth.uid())) OR is_master_admin()))
  WITH CHECK (((tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_availability_windows / Students read tutor availability windows / SELECT
DROP POLICY IF EXISTS "Students read tutor availability windows" ON public.tutor_availability_windows;
CREATE POLICY "Students read tutor availability windows" ON public.tutor_availability_windows
  FOR SELECT
  TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tutor_availability_settings s
  WHERE ((s.tutor_id = tutor_availability_windows.tutor_id) AND (s.one_to_one_booking_enabled = true)))) OR (tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_availability_windows / Tutors manage own availability windows / ALL
DROP POLICY IF EXISTS "Tutors manage own availability windows" ON public.tutor_availability_windows;
CREATE POLICY "Tutors manage own availability windows" ON public.tutor_availability_windows
  FOR ALL
  TO authenticated
  USING (((tutor_id = (select auth.uid())) OR is_master_admin()))
  WITH CHECK (((tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_calendar_event_exclusions / Tutors manage own calendar exclusions / ALL
DROP POLICY IF EXISTS "Tutors manage own calendar exclusions" ON public.tutor_calendar_event_exclusions;
CREATE POLICY "Tutors manage own calendar exclusions" ON public.tutor_calendar_event_exclusions
  FOR ALL
  TO authenticated
  USING (((tutor_id = (select auth.uid())) OR is_master_admin()))
  WITH CHECK (((tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_calendar_event_tags / Tutors delete own calendar event tags / DELETE
DROP POLICY IF EXISTS "Tutors delete own calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Tutors delete own calendar event tags" ON public.tutor_calendar_event_tags
  FOR DELETE
  TO authenticated
  USING (((tutor_id = (select auth.uid())) AND is_tutor()));

-- public.tutor_calendar_event_tags / Tutors insert own calendar event tags / INSERT
DROP POLICY IF EXISTS "Tutors insert own calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Tutors insert own calendar event tags" ON public.tutor_calendar_event_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (((tutor_id = (select auth.uid())) AND (tagged_by = (select auth.uid())) AND is_tutor()));

-- public.tutor_calendar_event_tags / Tutors select own calendar event tags / SELECT
DROP POLICY IF EXISTS "Tutors select own calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Tutors select own calendar event tags" ON public.tutor_calendar_event_tags
  FOR SELECT
  TO authenticated
  USING (((tutor_id = (select auth.uid())) AND is_tutor()));

-- public.tutor_cover_requests / Tutors manage own cover requests / ALL
DROP POLICY IF EXISTS "Tutors manage own cover requests" ON public.tutor_cover_requests;
CREATE POLICY "Tutors manage own cover requests" ON public.tutor_cover_requests
  FOR ALL
  TO authenticated
  USING ((is_master_admin() OR (requesting_tutor_id = (select auth.uid())) OR (assigned_tutor_id = (select auth.uid()))))
  WITH CHECK ((is_master_admin() OR (requesting_tutor_id = (select auth.uid())) OR (assigned_tutor_id = (select auth.uid()))));

-- public.tutor_favorites / Tutors delete own favorites / DELETE
DROP POLICY IF EXISTS "Tutors delete own favorites" ON public.tutor_favorites;
CREATE POLICY "Tutors delete own favorites" ON public.tutor_favorites
  FOR DELETE
  TO authenticated
  USING (((tutor_id = (select auth.uid())) AND is_tutor()));

-- public.tutor_favorites / Tutors insert own favorites / INSERT
DROP POLICY IF EXISTS "Tutors insert own favorites" ON public.tutor_favorites;
CREATE POLICY "Tutors insert own favorites" ON public.tutor_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (((tutor_id = (select auth.uid())) AND is_tutor()));

-- public.tutor_favorites / Tutors update own favorites / UPDATE
DROP POLICY IF EXISTS "Tutors update own favorites" ON public.tutor_favorites;
CREATE POLICY "Tutors update own favorites" ON public.tutor_favorites
  FOR UPDATE
  TO authenticated
  USING (((tutor_id = (select auth.uid())) AND is_tutor()))
  WITH CHECK (((tutor_id = (select auth.uid())) AND is_tutor()));

-- public.tutor_one_to_one_booking_credits / Students read own booking credits / SELECT
DROP POLICY IF EXISTS "Students read own booking credits" ON public.tutor_one_to_one_booking_credits;
CREATE POLICY "Students read own booking credits" ON public.tutor_one_to_one_booking_credits
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_one_to_one_bookings / Students cancel own pending bookings / UPDATE
DROP POLICY IF EXISTS "Students cancel own pending bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Students cancel own pending bookings" ON public.tutor_one_to_one_bookings
  FOR UPDATE
  TO authenticated
  USING (((student_id = (select auth.uid())) AND (status = 'pending_payment'::text)))
  WITH CHECK ((student_id = (select auth.uid())));

-- public.tutor_one_to_one_bookings / Students create own bookings / INSERT
DROP POLICY IF EXISTS "Students create own bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Students create own bookings" ON public.tutor_one_to_one_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK ((student_id = (select auth.uid())));

-- public.tutor_one_to_one_bookings / Students read own bookings / SELECT
DROP POLICY IF EXISTS "Students read own bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Students read own bookings" ON public.tutor_one_to_one_bookings
  FOR SELECT
  TO authenticated
  USING (((student_id = (select auth.uid())) OR (tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_one_to_one_bookings / Tutors update own bookings / UPDATE
DROP POLICY IF EXISTS "Tutors update own bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Tutors update own bookings" ON public.tutor_one_to_one_bookings
  FOR UPDATE
  TO authenticated
  USING (((tutor_id = (select auth.uid())) OR is_master_admin()))
  WITH CHECK (((tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_scheduled_sessions / Students read their scheduled sessions / SELECT
DROP POLICY IF EXISTS "Students read their scheduled sessions" ON public.tutor_scheduled_sessions;
CREATE POLICY "Students read their scheduled sessions" ON public.tutor_scheduled_sessions
  FOR SELECT
  TO authenticated
  USING (student_can_view_session(id, (select auth.uid())));

-- public.tutor_scheduled_sessions / Tutors read own scheduled sessions / SELECT
DROP POLICY IF EXISTS "Tutors read own scheduled sessions" ON public.tutor_scheduled_sessions;
CREATE POLICY "Tutors read own scheduled sessions" ON public.tutor_scheduled_sessions
  FOR SELECT
  TO authenticated
  USING (((tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.tutor_scheduled_sessions / Tutors update own scheduled sessions / UPDATE
DROP POLICY IF EXISTS "Tutors update own scheduled sessions" ON public.tutor_scheduled_sessions;
CREATE POLICY "Tutors update own scheduled sessions" ON public.tutor_scheduled_sessions
  FOR UPDATE
  TO authenticated
  USING (((tutor_id = (select auth.uid())) OR is_master_admin()))
  WITH CHECK (((tutor_id = (select auth.uid())) OR is_master_admin()));

-- public.user_game_stats / Users manage own game stats / ALL
DROP POLICY IF EXISTS "Users manage own game stats" ON public.user_game_stats;
CREATE POLICY "Users manage own game stats" ON public.user_game_stats
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.user_streaks / Users manage own streaks / ALL
DROP POLICY IF EXISTS "Users manage own streaks" ON public.user_streaks;
CREATE POLICY "Users manage own streaks" ON public.user_streaks
  FOR ALL
  TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- public.voice_practice_attempts / Users read own voice practice attempts / SELECT
DROP POLICY IF EXISTS "Users read own voice practice attempts" ON public.voice_practice_attempts;
CREATE POLICY "Users read own voice practice attempts" ON public.voice_practice_attempts
  FOR SELECT
  TO authenticated
  USING ((user_id = (select auth.uid())));

-- public.weekly_lesson_points_awarded / Users can read own lesson point awards / SELECT
DROP POLICY IF EXISTS "Users can read own lesson point awards" ON public.weekly_lesson_points_awarded;
CREATE POLICY "Users can read own lesson point awards" ON public.weekly_lesson_points_awarded
  FOR SELECT
  TO authenticated
  USING (((select auth.uid()) = user_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
