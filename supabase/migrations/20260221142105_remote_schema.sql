drop policy "Админ может управлять командами" on "public"."match_teams";

drop policy "Участники могут видеть команды" on "public"."match_teams";

alter table "public"."match_slots" add column "desire" text;

alter table "public"."match_slots" add column "reserve_position" integer;

alter table "public"."match_teams" add column "captain_user_id" uuid;

alter table "public"."match_teams" add column "created_by_user_id" uuid;

alter table "public"."matches" add column "game_format" integer;

alter table "public"."matches" add column "match_type" text not null default 'match'::text;

alter table "public"."matches" add column "team_limit" integer;

alter table "public"."matches" add column "voting_full_limit_achieved" boolean not null default false;

CREATE INDEX idx_match_slots_match_status_reserve_position ON public.match_slots USING btree (match_id, status, reserve_position);

CREATE INDEX idx_match_teams_created_by_user_id ON public.match_teams USING btree (created_by_user_id);

CREATE UNIQUE INDEX match_slots_unique_user_per_match ON public.match_slots USING btree (match_id, user_id) WHERE (user_id IS NOT NULL);

CREATE UNIQUE INDEX match_teams_unique_match_order ON public.match_teams USING btree (match_id, display_order);

CREATE UNIQUE INDEX uq_match_slots_match_user ON public.match_slots USING btree (match_id, user_id) WHERE (user_id IS NOT NULL);

alter table "public"."match_slots" add constraint "match_slots_desire_check" CHECK (((desire IS NULL) OR (desire = ANY (ARRAY['going'::text, 'reserve'::text, 'not_going'::text])))) not valid;

alter table "public"."match_slots" validate constraint "match_slots_desire_check";

alter table "public"."match_slots" add constraint "match_slots_reserve_position_check" CHECK (((reserve_position IS NULL) OR (reserve_position > 0))) not valid;

alter table "public"."match_slots" validate constraint "match_slots_reserve_position_check";

alter table "public"."match_teams" add constraint "match_teams_created_by_user_id_fkey" FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."match_teams" validate constraint "match_teams_created_by_user_id_fkey";

alter table "public"."matches" add constraint "matches_game_format_check" CHECK (((game_format IS NULL) OR (game_format > 0))) not valid;

alter table "public"."matches" validate constraint "matches_game_format_check";

alter table "public"."matches" add constraint "matches_match_type_check" CHECK ((match_type = ANY (ARRAY['match'::text, 'teams'::text]))) not valid;

alter table "public"."matches" validate constraint "matches_match_type_check";

alter table "public"."matches" add constraint "matches_team_limit_check" CHECK (((team_limit IS NULL) OR (team_limit >= 2))) not valid;

alter table "public"."matches" validate constraint "matches_team_limit_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_reserve_move()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    current_go_count integer;
    max_slots integer;
    first_reserve_id uuid;
    full_limit_achieved boolean;
    match_mode text;
begin
    -- параметры матча
    select
        max_players,
        coalesce(voting_full_limit_achieved, false),
        match_type
    into
        max_slots,
        full_limit_achieved,
        match_mode
    from public.matches
    where id = old.match_id;

    -- для командного режима триггер не нужен
    if match_mode = 'teams' then
        return old;
    end if;

    -- если лимит никогда не достигался, автоподъема из резерва быть не должно
    if not full_limit_achieved then
        return old;
    end if;

    -- автоподъем только при освобождении ровно одного последнего лимитного места
    if old.status = 'go' then
        select count(*) into current_go_count
        from public.match_slots
        where match_id = old.match_id
          and status = 'go';

        if current_go_count = max_slots - 1 then
            select id into first_reserve_id
            from public.match_slots
            where match_id = old.match_id
              and status = 'reserve'
            order by reserve_position asc nulls last, created_at asc
            limit 1;

            if first_reserve_id is not null then
                update public.match_slots
                set status = 'go'
                where id = first_reserve_id;
            end if;
        end if;
    end if;

    return old;
end;
$function$
;


  create policy "slots_insert_owner_admin_creator"
  on "public"."match_slots"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_slots.match_id) AND (rm.user_id = auth.uid()) AND ((rm.role = ANY (ARRAY['owner'::text, 'admin'::text])) OR (match_slots.user_id = auth.uid()) OR ((match_slots.team_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM public.match_teams t
          WHERE ((t.id = match_slots.team_id) AND (t.created_by_user_id = auth.uid()))))))))));



  create policy "slots_update_owner_admin_creator"
  on "public"."match_slots"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_slots.match_id) AND (rm.user_id = auth.uid()) AND ((rm.role = ANY (ARRAY['owner'::text, 'admin'::text])) OR (match_slots.user_id = auth.uid()) OR (match_slots.added_by_user_id = auth.uid()) OR ((match_slots.team_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM public.match_teams t
          WHERE ((t.id = match_slots.team_id) AND (t.created_by_user_id = auth.uid()))))) OR ((match_slots.team_id IS NULL) AND (EXISTS ( SELECT 1
           FROM public.match_teams t
          WHERE ((t.match_id = match_slots.match_id) AND (t.created_by_user_id = auth.uid()))))))))))
with check ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_slots.match_id) AND (rm.user_id = auth.uid()) AND ((rm.role = ANY (ARRAY['owner'::text, 'admin'::text])) OR (match_slots.user_id = auth.uid()) OR (match_slots.added_by_user_id = auth.uid()) OR ((match_slots.team_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM public.match_teams t
          WHERE ((t.id = match_slots.team_id) AND (t.created_by_user_id = auth.uid()))))))))));



  create policy "Owner/Admin can manage teams"
  on "public"."match_teams"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "Room members can select match_teams"
  on "public"."match_teams"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.room_members rm
     JOIN public.matches m ON ((m.room_id = rm.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid())))));



  create policy "Room owner/admin manage match_teams"
  on "public"."match_teams"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM (public.room_members rm
     JOIN public.matches m ON ((m.room_id = rm.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM (public.room_members rm
     JOIN public.matches m ON ((m.room_id = rm.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "teams_update_owner_admin_player_safe"
  on "public"."match_teams"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid()) AND ((rm.role = ANY (ARRAY['owner'::text, 'admin'::text])) OR ((rm.role = 'player'::text) AND ((match_teams.created_by_user_id = auth.uid()) OR (match_teams.created_by_user_id IS NULL))))))))
with check ((EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.room_members rm ON ((rm.room_id = m.room_id)))
  WHERE ((m.id = match_teams.match_id) AND (rm.user_id = auth.uid()) AND ((rm.role = ANY (ARRAY['owner'::text, 'admin'::text])) OR ((rm.role = 'player'::text) AND ((match_teams.created_by_user_id = auth.uid()) OR (match_teams.created_by_user_id IS NULL))))))));



