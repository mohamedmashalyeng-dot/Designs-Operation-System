-- ─────────────────────────────────────────────────────────────────────────
-- 0013_knowledge_search_rpc.sql
-- PostgREST can't ORDER BY a computed distance expression directly, so
-- vector similarity search needs a callable function (product spec §17/
-- §18/§25). security invoker (not definer) so the caller's own RLS still
-- applies — this never bypasses organisation isolation, the match_org
-- parameter is a convenience filter on top of it, not instead of it.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_org uuid,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.document_id,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where knowledge_chunks.organisation_id = match_org
    and knowledge_chunks.embedding is not null
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_knowledge_chunks(vector, uuid, int) to authenticated;
