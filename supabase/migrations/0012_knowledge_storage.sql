-- ─────────────────────────────────────────────────────────────────────────
-- 0012_knowledge_storage.sql
-- Storage bucket for uploaded knowledge documents (PDF/DOCX/text) — kept
-- separate from `brand-assets` since it's a different concern (source
-- material for retrieval, not brand imagery) and needs document mime
-- types brand-assets doesn't allow.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('knowledge-documents', 'knowledge-documents', false, 26214400,
    array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;

create policy "knowledge-documents_select" on storage.objects for select
  using (bucket_id = 'knowledge-documents' and is_member_of_org((storage.foldername(name))[1]::uuid));
create policy "knowledge-documents_insert" on storage.objects for insert
  with check (bucket_id = 'knowledge-documents' and is_member_of_org((storage.foldername(name))[1]::uuid));
create policy "knowledge-documents_delete" on storage.objects for delete
  using (bucket_id = 'knowledge-documents' and is_member_of_org((storage.foldername(name))[1]::uuid));
