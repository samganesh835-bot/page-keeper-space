-- Create user profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  created_at timestamp with time zone default now(),
  primary key (id)
);

alter table public.profiles enable row level security;

-- Create enum for user roles
create type public.app_role as enum ('admin', 'user');

-- Create user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Create function to check user role
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Create books table
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  author text,
  file_path text not null,
  file_size bigint not null,
  file_type text,
  cover_url text,
  uploaded_at timestamp with time zone default now()
);

alter table public.books enable row level security;

-- RLS Policies for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- RLS Policies for user_roles
create policy "Users can view their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can manage all roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for books
create policy "Users can view their own books"
  on public.books for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can upload their own books"
  on public.books for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own books"
  on public.books for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own books"
  on public.books for delete
  to authenticated
  using (auth.uid() = user_id);

-- Create storage bucket for books
insert into storage.buckets (id, name, public, file_size_limit)
values ('books', 'books', false, 209715200);

-- Storage policies for books bucket
create policy "Users can view their own book files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload their own book files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own book files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  
  -- Assign default 'user' role
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  
  return new;
end;
$$;

-- Trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to calculate user's total storage used
create or replace function public.get_user_storage_used(user_uuid uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(file_size), 0)
  from public.books
  where user_id = user_uuid
$$;