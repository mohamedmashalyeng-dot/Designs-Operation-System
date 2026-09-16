-- ─────────────────────────────────────────────────────────────────────────
-- 0007_storage.sql
-- Storage buckets and access policies. Every object path is namespaced
-- `{organisation_id}/...` and every policy checks that prefix against
-- organisation_members via is_member_of_org(), so one organisation can
-- never read or write another's files. All buckets are private — nothing
-- is served publicly; the app issues signed URLs for display.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand-assets', 'brand-assets', false, 26214400,
    array['image/png','image/jpeg','image/svg+xml','image/webp','application/pdf']),
  ('campaign-assets', 'campaign-assets', false, 26214400,
    array['image/png','image/jpeg','image/webp']),
  -- image/svg+xml included alongside real raster formats because the mock
  -- image provider (used whenever OPENAI_API_KEY is unset) renders its
  -- clearly-labeled placeholders as SVG — see src/lib/ai/providers/mock.
  ('generated-images', 'generated-images', false, 26214400,
    array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('design-previews', 'design-previews', false, 26214400,
    array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('reference-images', 'reference-images', false, 26214400,
    array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- ── user-uploadable buckets ─────────────────────────────────────────────
-- brand-assets, campaign-assets, reference-images: members upload directly
-- from the browser (logo uploads, reference images, exported adaptations).
do $$
declare
  bucket text;
begin
  foreach bucket in array array['brand-assets', 'campaign-assets', 'reference-images']
  loop
    execute format(
      $p$create policy "%1$s_select" on storage.objects for select
        using (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
    execute format(
      $p$create policy "%1$s_insert" on storage.objects for insert
        with check (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
    execute format(
      $p$create policy "%1$s_delete" on storage.objects for delete
        using (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
  end loop;
end $$;

-- ── server-generated buckets ────────────────────────────────────────────
-- generated-images, design-previews: written only by server code on the
-- service-role client (the image-generation pipeline), which bypasses RLS
-- entirely — members get read-only access via these policies.
do $$
declare
  bucket text;
begin
  foreach bucket in array array['generated-images', 'design-previews']
  loop
    execute format(
      $p$create policy "%1$s_select" on storage.objects for select
        using (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
  end loop;
end $$;
