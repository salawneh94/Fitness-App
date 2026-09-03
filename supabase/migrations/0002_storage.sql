-- Progress photos live in a private Storage bucket under {user_id}/{photo_id}.jpg —
-- progress_photos.storage_path (added in 0001) points at the object once it's uploaded.
-- RLS on storage.objects mirrors every other table: a user can only touch objects
-- whose first path segment is their own auth.uid().

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress-photos: owner select"
on storage.objects for select
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress-photos: owner insert"
on storage.objects for insert
with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress-photos: owner update"
on storage.objects for update
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress-photos: owner delete"
on storage.objects for delete
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
