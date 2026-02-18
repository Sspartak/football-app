


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_is_room_admin"("r_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from rooms 
    where id = r_id and admin_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."check_is_room_admin"("r_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_room_candidate"("r_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from room_members 
    where room_id = r_id and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."check_is_room_candidate"("r_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_room_member"("r_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from room_members 
    where room_id = r_id and user_id = auth.uid() and approved = true
  );
$$;


ALTER FUNCTION "public"."check_is_room_member"("r_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_match_vote"("p_match_id" "uuid", "p_user_id" "uuid", "p_nickname" "text", "p_status" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_max_players INT;
  v_current_count INT;
  v_final_status TEXT;
  v_was_in_go BOOLEAN;
  v_next_id UUID;
BEGIN
  -- 1. БЛОКИРОВКА ВСЕЙ ТАБЛИЦЫ (никто не может даже начать запись, пока мы не закончим)
  LOCK TABLE match_slots IN ACCESS EXCLUSIVE MODE;

  -- 2. Получаем лимит (если матча нет, ставим 0)
  SELECT COALESCE(max_players, 0) INTO v_max_players FROM matches WHERE id = p_match_id;

  -- 3. Проверяем текущий статус игрока
  SELECT (status = 'go') INTO v_was_in_go FROM match_slots 
  WHERE match_id = p_match_id AND user_id = p_user_id;

  -- 4. Считаем, сколько человек СЕЙЧАС имеют статус 'go' (без учета нас)
  SELECT count(*) INTO v_current_count FROM match_slots 
  WHERE match_id = p_match_id AND status = 'go' AND user_id != p_user_id;

  -- 5. ОПРЕДЕЛЯЕМ СТАТУС
  IF p_status = 'go' THEN
    -- Если мест нет (строгое сравнение), то только в резерв
    IF v_current_count >= v_max_players THEN
      v_final_status := 'reserve';
    ELSE
      v_final_status := 'go';
    END IF;
  ELSE
    v_final_status := p_status;
  END IF;

  -- 6. ОБНОВЛЯЕМ ИЛИ ВСТАВЛЯЕМ
  INSERT INTO match_slots (match_id, user_id, nickname, status, created_at)
  VALUES (p_match_id, p_user_id, p_nickname, v_final_status, now())
  ON CONFLICT (match_id, user_id) 
  DO UPDATE SET status = v_final_status, created_at = now();

  -- 7. АВТОПЕРЕНОС (если мы освободили место)
  IF v_was_in_go AND v_final_status != 'go' THEN
    SELECT id INTO v_next_id FROM match_slots
    WHERE match_id = p_match_id AND status = 'reserve' AND user_id != p_user_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_next_id IS NOT NULL THEN
      UPDATE match_slots SET status = 'go', created_at = now() WHERE id = v_next_id;
    END IF;
  END IF;

  -- Возвращаем 'limit_reached' только если реально не пустили в 'go'
  IF p_status = 'go' AND v_final_status = 'reserve' THEN
    RETURN 'limit_reached';
  END IF;
  
  RETURN 'ok';
END;
$$;


ALTER FUNCTION "public"."handle_match_vote"("p_match_id" "uuid", "p_user_id" "uuid", "p_nickname" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_reserve_move"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    current_go_count integer;
    max_slots integer;
    first_reserve_id uuid;
begin
    -- Получаем лимит игроков для этого матча
    select max_players into max_slots from public.matches where id = old.match_id;
    
    -- Считаем, сколько человек сейчас имеют статус 'go'
    select count(*) into current_go_count from public.match_slots 
    where match_id = old.match_id and status = 'go';

    -- Если место освободилось (было >= max, а стало < max)
    if (old.status = 'go' and current_go_count < max_slots) then
        -- Ищем первого в резерве
        select id into first_reserve_id 
        from public.match_slots 
        where match_id = old.match_id and status = 'reserve'
        order by created_at asc limit 1;

        -- Переводим его в основной состав
        if first_reserve_id is not null then
            update public.match_slots set status = 'go' where id = first_reserve_id;
        end if;
    end if;
    return old;
end;
$$;


ALTER FUNCTION "public"."handle_reserve_move"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_update_messages_nickname"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.messages
  set nickname = new.nickname
  where user_id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_update_messages_nickname"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_update_nickname"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.room_members
  set nickname = new.nickname
  where user_id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_update_nickname"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_update_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Обновляем данные в таблице участников
  update public.room_members
  set 
    nickname = new.nickname
    -- Здесь мы могли бы добавить колонки first_name/last_name прямо в room_members, 
    -- но так как в коде мы делаем JOIN или поиск по таблице users, 
    -- триггер на саму таблицу users уже гарантирует актуальность данных при fetchData()
  where user_id = new.id;
  
  -- Если ты решишь хранить ФИО прямо в сообщениях (сейчас там только ник), 
  -- можно добавить апдейт и туда. Пока обновляем ник в сообщениях:
  update public.messages
  set nickname = new.nickname
  where user_id = new.id;
  
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_update_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of"("r_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return exists (
    select 1 from public.room_members
    where room_id = r_id and user_id = auth.uid()
  );
end;
$$;


ALTER FUNCTION "public"."is_member_of"("r_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_role_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO room_role_history (room_id, user_id, old_role, new_role, changed_by, reason)
        VALUES (NEW.room_id, NEW.user_id, OLD.role, NEW.role, NULL, 'role_changed');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_role_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."room_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "approved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nickname" "text",
    "role" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "valid_role" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'player'::"text", 'pending'::"text"])))
);

ALTER TABLE ONLY "public"."room_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" DEFAULT ''::"text",
    "last_name" "text",
    "nickname" "text",
    "email" "text",
    "created_at" timestamp without time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."group_details" AS
 SELECT "rm"."room_id",
    "rm"."user_id",
    "rm"."nickname",
    "rm"."approved",
    "u"."first_name",
    "u"."last_name",
    "r"."admin_id"
   FROM (("public"."room_members" "rm"
     JOIN "public"."users" "u" ON (("rm"."user_id" = "u"."id")))
     JOIN "public"."rooms" "r" ON (("rm"."room_id" = "r"."id")));


ALTER VIEW "public"."group_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid",
    "user_id" "uuid",
    "nickname" "text" NOT NULL,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "team_id" "uuid",
    "added_by_user_id" "uuid",
    "added_by_nickname" "text",
    CONSTRAINT "match_slots_status_check" CHECK (("status" = ANY (ARRAY['go'::"text", 'not_go'::"text", 'reserve'::"text"])))
);

ALTER TABLE ONLY "public"."match_slots" REPLICA IDENTITY FULL;


ALTER TABLE "public"."match_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid",
    "name" "text" NOT NULL,
    "display_order" integer NOT NULL,
    "color_json" "jsonb"
);


ALTER TABLE "public"."match_teams" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."match_teams_display_order_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."match_teams_display_order_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."match_teams_display_order_seq" OWNED BY "public"."match_teams"."display_order";



CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "address" "text" NOT NULL,
    "match_time" timestamp with time zone,
    "max_players" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "match_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "status" "text" DEFAULT 'voting'::"text",
    "cost" numeric,
    "cost_payer" "text"
);

ALTER TABLE ONLY "public"."matches" REPLICA IDENTITY FULL;


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "nickname" "text",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."room_activity_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."room_members_with_details" AS
 SELECT "rm"."id",
    "rm"."room_id",
    "rm"."user_id",
    "u"."first_name",
    "u"."last_name",
    "u"."nickname" AS "user_nickname",
    "rm"."nickname" AS "room_nickname",
    "rm"."approved",
    "rm"."role",
    "rm"."created_at",
    "r"."name" AS "room_name",
    "r"."admin_id" AS "room_owner_id"
   FROM (("public"."room_members" "rm"
     JOIN "public"."users" "u" ON (("rm"."user_id" = "u"."id")))
     JOIN "public"."rooms" "r" ON (("rm"."room_id" = "r"."id")));


ALTER VIEW "public"."room_members_with_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_role_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "old_role" "text",
    "new_role" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "reason" "text"
);


ALTER TABLE "public"."room_role_history" OWNER TO "postgres";


ALTER TABLE ONLY "public"."match_teams" ALTER COLUMN "display_order" SET DEFAULT "nextval"('"public"."match_teams_display_order_seq"'::"regclass");



ALTER TABLE ONLY "public"."match_slots"
    ADD CONSTRAINT "match_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_teams"
    ADD CONSTRAINT "match_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_activity_log"
    ADD CONSTRAINT "room_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_role_history"
    ADD CONSTRAINT "room_role_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_slots"
    ADD CONSTRAINT "unique_match_user" UNIQUE ("match_id", "user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_nickname_key" UNIQUE ("nickname");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_match_slots_added_by" ON "public"."match_slots" USING "btree" ("match_id", "added_by_user_id");



CREATE INDEX "idx_room_role_history_room_user" ON "public"."room_role_history" USING "btree" ("room_id", "user_id");



CREATE OR REPLACE TRIGGER "on_auth_user_profile_updated" AFTER UPDATE OF "nickname", "first_name", "last_name" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_update_user_profile"();



CREATE OR REPLACE TRIGGER "on_slot_deleted_or_changed" AFTER DELETE OR UPDATE OF "status" ON "public"."match_slots" FOR EACH ROW EXECUTE FUNCTION "public"."handle_reserve_move"();



CREATE OR REPLACE TRIGGER "trigger_log_role_change" AFTER UPDATE OF "role" ON "public"."room_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_role_change"();

ALTER TABLE "public"."room_members" DISABLE TRIGGER "trigger_log_role_change";



ALTER TABLE ONLY "public"."match_slots"
    ADD CONSTRAINT "match_slots_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_slots"
    ADD CONSTRAINT "match_slots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."match_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_slots"
    ADD CONSTRAINT "match_slots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."match_teams"
    ADD CONSTRAINT "match_teams_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."room_activity_log"
    ADD CONSTRAINT "room_activity_log_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_activity_log"
    ADD CONSTRAINT "room_activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_role_history"
    ADD CONSTRAINT "room_role_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."room_role_history"
    ADD CONSTRAINT "room_role_history_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_role_history"
    ADD CONSTRAINT "room_role_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin manage all slots" ON "public"."match_slots" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."matches" "m"
     JOIN "public"."rooms" "r" ON (("r"."id" = "m"."room_id")))
  WHERE (("m"."id" = "match_slots"."match_id") AND ("r"."admin_id" = "auth"."uid"()))))) WITH CHECK (true);



CREATE POLICY "Admin manage matches" ON "public"."matches" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "rooms"."admin_id"
   FROM "public"."rooms"
  WHERE ("rooms"."id" = "matches"."room_id")))) WITH CHECK (("auth"."uid"() IN ( SELECT "rooms"."admin_id"
   FROM "public"."rooms"
  WHERE ("rooms"."id" = "matches"."room_id"))));



CREATE POLICY "Admins and owners can delete matches" ON "public"."matches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "matches"."room_id") AND ("room_members"."user_id" = "auth"."uid"()) AND ("room_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins and owners can insert matches" ON "public"."matches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "matches"."room_id") AND ("room_members"."user_id" = "auth"."uid"()) AND ("room_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins and owners can update matches" ON "public"."matches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "matches"."room_id") AND ("room_members"."user_id" = "auth"."uid"()) AND ("room_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Allow insert for all users" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read for nicknames" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Delete own user" ON "public"."users" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Insert own user" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Matches viewable" ON "public"."matches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Matches: admin_all" ON "public"."matches" USING ((EXISTS ( SELECT 1
   FROM "public"."rooms"
  WHERE (("rooms"."id" = "matches"."room_id") AND ("rooms"."admin_id" = "auth"."uid"())))));



CREATE POLICY "Matches: select" ON "public"."matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "matches"."room_id") AND ("room_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members: admin delete" ON "public"."room_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."rooms"
  WHERE (("rooms"."id" = "room_members"."room_id") AND ("rooms"."admin_id" = "auth"."uid"())))));



CREATE POLICY "Members: admin insert" ON "public"."room_members" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid"
   FROM "public"."rooms"
  WHERE ("rooms"."id" = "room_members"."room_id")) = "auth"."uid"()));



CREATE POLICY "Members: admin update" ON "public"."room_members" FOR UPDATE USING ("public"."check_is_room_admin"("room_id")) WITH CHECK ("public"."check_is_room_admin"("room_id"));



CREATE POLICY "Members: insert" ON "public"."room_members" FOR INSERT WITH CHECK (((("user_id" = "auth"."uid"()) AND ("approved" = false)) OR (EXISTS ( SELECT 1
   FROM "public"."rooms"
  WHERE (("rooms"."id" = "room_members"."room_id") AND ("rooms"."admin_id" = "auth"."uid"()))))));



CREATE POLICY "Members: select" ON "public"."room_members" FOR SELECT USING (("public"."check_is_room_admin"("room_id") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Members: select_v3" ON "public"."room_members" FOR SELECT USING ("public"."check_is_room_candidate"("room_id"));



CREATE POLICY "Members: self delete" ON "public"."room_members" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Members: self insert" ON "public"."room_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("approved" = false)));



CREATE POLICY "Messages: insert_strict" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "messages"."room_id") AND ("room_members"."user_id" = "auth"."uid"()) AND ("room_members"."approved" = true)))));



CREATE POLICY "Messages: public_read" ON "public"."messages" FOR SELECT USING (true);



CREATE POLICY "Rooms: admin delete" ON "public"."rooms" FOR DELETE USING (("auth"."uid"() = "admin_id"));



CREATE POLICY "Rooms: admin insert" ON "public"."rooms" FOR INSERT WITH CHECK (("auth"."uid"() = "admin_id"));



CREATE POLICY "Rooms: admin select" ON "public"."rooms" FOR SELECT USING (("auth"."uid"() = "admin_id"));



CREATE POLICY "Rooms: member select" ON "public"."rooms" FOR SELECT USING ("public"."check_is_room_candidate"("id"));



CREATE POLICY "Rooms: update admin" ON "public"."rooms" FOR UPDATE USING (("auth"."uid"() = "admin_id"));



CREATE POLICY "Rooms: update name" ON "public"."rooms" FOR UPDATE USING (("auth"."uid"() = "admin_id")) WITH CHECK (("auth"."uid"() = "admin_id"));



CREATE POLICY "Select members by admin" ON "public"."room_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rooms"
  WHERE (("rooms"."id" = "room_members"."room_id") AND ("rooms"."admin_id" = "auth"."uid"())))));



CREATE POLICY "Select own user" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Slots viewable" ON "public"."match_slots" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Slots: admin_all" ON "public"."match_slots" USING ((EXISTS ( SELECT 1
   FROM ("public"."matches" "m"
     JOIN "public"."rooms" "r" ON (("r"."id" = "m"."room_id")))
  WHERE (("m"."id" = "match_slots"."match_id") AND ("r"."admin_id" = "auth"."uid"())))));



CREATE POLICY "Slots: insert_own" ON "public"."match_slots" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Slots: select" ON "public"."match_slots" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."matches" "m"
     JOIN "public"."room_members" "rm" ON (("rm"."room_id" = "m"."room_id")))
  WHERE (("m"."id" = "match_slots"."match_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Slots: update_own" ON "public"."match_slots" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Update own user" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own slots" ON "public"."match_slots" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users: update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "allow_admin_delete_any_slot" ON "public"."match_slots" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."user_id" = "auth"."uid"()) AND (("room_members"."role" = 'admin'::"text") OR ("room_members"."role" = 'owner'::"text")) AND ("room_members"."room_id" IN ( SELECT "matches"."room_id"
           FROM "public"."matches"
          WHERE ("matches"."id" = "match_slots"."match_id")))))));



CREATE POLICY "allow_player_delete_own_additions" ON "public"."match_slots" FOR DELETE USING (("added_by_user_id" = "auth"."uid"()));



ALTER TABLE "public"."match_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_role_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Админ может обновлять team_id" ON "public"."match_slots" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "rooms"."admin_id"
   FROM "public"."rooms"
  WHERE ("rooms"."id" = ( SELECT "matches"."room_id"
           FROM "public"."matches"
          WHERE ("matches"."id" = "match_slots"."match_id"))))));



CREATE POLICY "Админ может управлять командами" ON "public"."match_teams" USING (("auth"."uid"() IN ( SELECT "rooms"."admin_id"
   FROM "public"."rooms"
  WHERE ("rooms"."id" = ( SELECT "matches"."room_id"
           FROM "public"."matches"
          WHERE ("matches"."id" = "match_teams"."match_id"))))));



CREATE POLICY "Участники могут видеть команды" ON "public"."match_teams" FOR SELECT USING (("auth"."uid"() IN ( SELECT "room_members"."user_id"
   FROM "public"."room_members"
  WHERE ("room_members"."room_id" = ( SELECT "matches"."room_id"
           FROM "public"."matches"
          WHERE ("matches"."id" = "match_teams"."match_id"))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_is_room_admin"("r_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_room_admin"("r_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_room_admin"("r_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_room_candidate"("r_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_room_candidate"("r_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_room_candidate"("r_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_room_member"("r_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_room_member"("r_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_room_member"("r_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_match_vote"("p_match_id" "uuid", "p_user_id" "uuid", "p_nickname" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_match_vote"("p_match_id" "uuid", "p_user_id" "uuid", "p_nickname" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_match_vote"("p_match_id" "uuid", "p_user_id" "uuid", "p_nickname" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_reserve_move"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_reserve_move"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_reserve_move"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_update_messages_nickname"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_update_messages_nickname"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_update_messages_nickname"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_update_nickname"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_update_nickname"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_update_nickname"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_update_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_update_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_update_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("r_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("r_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("r_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_role_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_role_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_role_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."room_members" TO "anon";
GRANT ALL ON TABLE "public"."room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."room_members" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."group_details" TO "anon";
GRANT ALL ON TABLE "public"."group_details" TO "authenticated";
GRANT ALL ON TABLE "public"."group_details" TO "service_role";



GRANT ALL ON TABLE "public"."match_slots" TO "anon";
GRANT ALL ON TABLE "public"."match_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."match_slots" TO "service_role";



GRANT ALL ON TABLE "public"."match_teams" TO "anon";
GRANT ALL ON TABLE "public"."match_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."match_teams" TO "service_role";



GRANT ALL ON SEQUENCE "public"."match_teams_display_order_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."match_teams_display_order_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."match_teams_display_order_seq" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."room_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."room_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."room_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."room_members_with_details" TO "anon";
GRANT ALL ON TABLE "public"."room_members_with_details" TO "authenticated";
GRANT ALL ON TABLE "public"."room_members_with_details" TO "service_role";



GRANT ALL ON TABLE "public"."room_role_history" TO "anon";
GRANT ALL ON TABLE "public"."room_role_history" TO "authenticated";
GRANT ALL ON TABLE "public"."room_role_history" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";


