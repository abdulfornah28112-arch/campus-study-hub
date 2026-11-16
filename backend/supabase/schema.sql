-- Run once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    name text not null unique check (length(btrim(name)) between 1 and 120),
    description text,
    created_at timestamptz not null default now()
);

insert into public.departments (name) values
    ('Computer Science'),
    ('Law'),
    ('Public Health'),
    ('Agriculture'),
    ('Mass Communication'),
    ('Accounting'),
    ('Public Administration'),
    ('Business Administration'),
    ('Nursing'),
    ('Development Studies')
on conflict (name) do nothing;

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references public.departments(id) on delete restrict,
    course_name text not null check (length(btrim(course_name)) between 1 and 160),
    course_code text not null check (length(btrim(course_code)) between 1 and 40),
    academic_level text,
    semester text,
    created_at timestamptz not null default now(),
    unique (department_id, course_code)
);

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null check (length(btrim(full_name)) between 1 and 120),
    email text not null unique,
    student_id text unique,
    department_id uuid references public.departments(id) on delete set null,
    academic_level text,
    role text not null default 'student' check (role in ('student', 'admin')),
    is_suspended boolean not null default false,
    profile_picture text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.materials (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(btrim(title)) between 1 and 200),
    description text,
    file_name text not null,
    file_path text not null unique,
    file_type text not null,
    file_size bigint not null check (file_size > 0),
    department_id uuid not null references public.departments(id) on delete restrict,
    course_id uuid references public.courses(id) on delete set null,
    course_label text,
    academic_level text,
    academic_year text,
    semester text,
    material_type text not null,
    exam_type text,
    uploaded_by uuid not null references public.profiles(id) on delete restrict,
    approval_status text not null default 'pending'
        check (approval_status in ('pending', 'approved', 'rejected')),
    rejection_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    material_id uuid not null references public.materials(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (user_id, material_id)
);

create table if not exists public.material_approvals (
    id uuid primary key default gen_random_uuid(),
    material_id uuid references public.materials(id) on delete set null,
    material_ref uuid not null,
    material_title text,
    admin_id uuid not null references public.profiles(id) on delete restrict,
    action text not null check (action in ('approved', 'rejected', 'deleted')),
    comments text,
    created_at timestamptz not null default now()
);

create index if not exists profiles_department_id_idx on public.profiles(department_id);
create index if not exists courses_department_id_idx on public.courses(department_id);
create index if not exists materials_status_created_idx on public.materials(approval_status, created_at desc);
create index if not exists materials_department_course_idx on public.materials(department_id, course_id);
create index if not exists materials_uploaded_by_idx on public.materials(uploaded_by, created_at desc);
create index if not exists materials_search_idx on public.materials using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(course_label, ''))
);
create index if not exists bookmarks_user_created_idx on public.bookmarks(user_id, created_at desc);
create index if not exists approvals_material_created_idx on public.material_approvals(material_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at before update on public.materials
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_department text;
    selected_department uuid;
    display_name text;
begin
    requested_department := nullif(btrim(new.raw_user_meta_data ->> 'department'), '');
    display_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
    if requested_department is not null then
        select id into selected_department
        from public.departments
        where lower(name) = lower(requested_department)
        limit 1;
    end if;

    insert into public.profiles (id, full_name, email, student_id, department_id, academic_level, role)
    values (
        new.id,
        coalesce(display_name, split_part(new.email, '@', 1)),
        lower(new.email),
        nullif(btrim(new.raw_user_meta_data ->> 'student_id'), ''),
        selected_department,
        nullif(btrim(new.raw_user_meta_data ->> 'academic_level'), ''),
        'student'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, email, student_id, department_id, academic_level, role)
select
    users.id,
    coalesce(
        nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
        split_part(users.email, '@', 1)
    ),
    lower(users.email),
    nullif(btrim(users.raw_user_meta_data ->> 'student_id'), ''),
    departments.id,
    nullif(btrim(users.raw_user_meta_data ->> 'academic_level'), ''),
    'student'
from auth.users as users
left join lateral (
    select id
    from public.departments
    where lower(name) = lower(nullif(btrim(users.raw_user_meta_data ->> 'department'), ''))
    limit 1
) as departments on true
where users.email is not null
on conflict (id) do nothing;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid()
$$;

create or replace function public.profile_role(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = target_user_id
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.provision_initial_admin(admin_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    target_user_id uuid;
begin
    if exists (select 1 from public.profiles where role = 'admin') then
        raise exception 'An administrator is already provisioned.';
    end if;
    select id into target_user_id
    from auth.users
    where lower(email) = lower(admin_email)
    limit 1;
    if target_user_id is null then
        raise exception 'Create and confirm the administrator account before provisioning it.';
    end if;
    update public.profiles
    set role = 'admin'
    where id = target_user_id;
    if not found then
        raise exception 'The administrator profile has not been created.';
    end if;
end;
$$;
revoke all on function public.provision_initial_admin(text) from public, anon, authenticated;

alter table public.departments enable row level security;
alter table public.courses enable row level security;
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.bookmarks enable row level security;
alter table public.material_approvals enable row level security;

drop policy if exists "departments readable by everyone" on public.departments;
create policy "departments readable by everyone" on public.departments
for select to anon, authenticated using (true);
drop policy if exists "admins manage departments" on public.departments;
create policy "admins manage departments" on public.departments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "courses readable by everyone" on public.courses;
create policy "courses readable by everyone" on public.courses
for select to anon, authenticated using (true);
drop policy if exists "admins manage courses" on public.courses;
create policy "admins manage courses" on public.courses
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users read own profile and admins read all" on public.profiles;
create policy "users read own profile and admins read all" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "users update own non-role profile" on public.profiles;
create policy "users update own non-role profile" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (
    (
        id = auth.uid()
        and role = public.current_app_role()
        and is_suspended = (select p.is_suspended from public.profiles p where p.id = auth.uid())
        and email = (auth.jwt() ->> 'email')
    )
    or (public.is_admin() and role = public.profile_role(id))
);

drop policy if exists "approved materials and own submissions readable" on public.materials;
create policy "approved materials and own submissions readable" on public.materials
for select to anon, authenticated
using (approval_status = 'approved' or uploaded_by = auth.uid() or public.is_admin());
drop policy if exists "students upload own pending materials" on public.materials;
create policy "students upload own pending materials" on public.materials
for insert to authenticated
with check (uploaded_by = auth.uid() and approval_status = 'pending' and public.current_app_role() = 'student');
drop policy if exists "owners edit own pending materials" on public.materials;
create policy "owners edit own pending materials" on public.materials
for update to authenticated
using ((uploaded_by = auth.uid() and approval_status = 'pending') or public.is_admin())
with check ((uploaded_by = auth.uid() and approval_status = 'pending') or public.is_admin());
drop policy if exists "owners delete own pending materials or admins delete any" on public.materials;
drop policy if exists "admins delete any materials" on public.materials;
create policy "admins delete any materials" on public.materials
for delete to authenticated using (public.is_admin());

drop policy if exists "users manage own bookmarks" on public.bookmarks;
create policy "users manage own bookmarks" on public.bookmarks
for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "users bookmark approved materials" on public.bookmarks;
create policy "users bookmark approved materials" on public.bookmarks
for insert to authenticated
with check (
    user_id = auth.uid()
    and exists (select 1 from public.materials m where m.id = material_id and m.approval_status = 'approved')
);
drop policy if exists "users remove own bookmarks" on public.bookmarks;
create policy "users remove own bookmarks" on public.bookmarks
for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins read approval history" on public.material_approvals;
create policy "admins read approval history" on public.material_approvals
for select to authenticated using (public.is_admin());
drop policy if exists "admins write approval history" on public.material_approvals;
create policy "admins write approval history" on public.material_approvals
for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('study-materials', 'study-materials', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "users upload into own folder" on storage.objects;
create policy "users upload into own folder" on storage.objects
for insert to authenticated
with check (
    bucket_id = 'study-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "owners and admins read private materials" on storage.objects;
create policy "owners and admins read private materials" on storage.objects
for select to authenticated
using (
    bucket_id = 'study-materials'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_admin()
        or exists (
            select 1 from public.materials m
            where m.file_path = name and m.approval_status = 'approved'
        )
    )
);
drop policy if exists "owners delete own files or admins delete any" on storage.objects;
drop policy if exists "admins delete material files" on storage.objects;
create policy "admins delete material files" on storage.objects
for delete to authenticated
using (
    bucket_id = 'study-materials'
    and public.is_admin()
);
