-- Fix 1: GRANT table permissions to authenticated role
grant select, insert, update, delete on public.notifications to authenticated;

-- Fix 2: INSERT policy (scoped so only server-side inserts are needed, but add for consistency)
create policy "service can insert notifications"
  on notifications for insert
  with check (true);

-- Fix 3: DELETE policy so users can delete their own notifications
create policy "users can delete own notifications"
  on notifications for delete
  using (auth.uid() = user_id);

-- Fix 4: Drop and recreate the avatars INSERT storage policy (tighter + no deprecated auth.role())
drop policy if exists "authenticated users can upload avatars" on storage.objects;
create policy "authenticated users can upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Fix 5: Add file size limit and MIME type restrictions to avatars bucket
update storage.buckets
set
  file_size_limit  = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';
