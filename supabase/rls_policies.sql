alter table public.profiles enable row level security;
alter table public.user_checkins enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.attractions enable row level security;

drop policy if exists "attractions_select_public" on public.attractions;
drop policy if exists "attractions_select_public_authenticated" on public.attractions;

create policy "attractions_select_public" on public.attractions
for select
to anon
using (true);

create policy "attractions_select_public_authenticated" on public.attractions
for select
to authenticated
using (true);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "checkins_select_own" on public.user_checkins;
drop policy if exists "checkins_insert_own" on public.user_checkins;
drop policy if exists "checkins_update_own" on public.user_checkins;
drop policy if exists "checkins_delete_own" on public.user_checkins;

create policy "checkins_select_own" on public.user_checkins
for select
to authenticated
using (user_id = auth.uid());

create policy "checkins_insert_own" on public.user_checkins
for insert
to authenticated
with check (user_id = auth.uid());

create policy "checkins_update_own" on public.user_checkins
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "checkins_delete_own" on public.user_checkins
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "posts_select_public_or_own" on public.posts;
drop policy if exists "posts_select_public" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;

create policy "posts_select_public" on public.posts
for select
to anon
using (is_private = false);

create policy "posts_select_public_or_own" on public.posts
for select
to authenticated
using (is_private = false or user_id = auth.uid());

create policy "posts_insert_own" on public.posts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "posts_update_own" on public.posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "posts_delete_own" on public.posts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "comments_select_on_visible_posts" on public.comments;
drop policy if exists "comments_select_on_public_posts" on public.comments;
drop policy if exists "comments_insert_own" on public.comments;
drop policy if exists "comments_update_own" on public.comments;
drop policy if exists "comments_delete_own" on public.comments;

create policy "comments_select_on_visible_posts" on public.comments
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and (p.is_private = false or p.user_id = auth.uid())
  )
);

create policy "comments_select_on_public_posts" on public.comments
for select
to anon
using (
  exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.is_private = false
  )
);

create policy "comments_insert_own" on public.comments
for insert
to authenticated
with check (user_id = auth.uid());

create policy "comments_update_own" on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "comments_delete_own" on public.comments
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "likes_select_on_visible_posts" on public.likes;
drop policy if exists "likes_select_on_public_posts" on public.likes;
drop policy if exists "likes_insert_own" on public.likes;
drop policy if exists "likes_delete_own" on public.likes;

create policy "likes_select_on_visible_posts" on public.likes
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = likes.post_id
      and (p.is_private = false or p.user_id = auth.uid())
  )
);

create policy "likes_select_on_public_posts" on public.likes
for select
to anon
using (
  exists (
    select 1
    from public.posts p
    where p.id = likes.post_id
      and p.is_private = false
  )
);

create policy "likes_insert_own" on public.likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "likes_delete_own" on public.likes
for delete
to authenticated
using (user_id = auth.uid());
