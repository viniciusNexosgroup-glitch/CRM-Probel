-- =============================================================================
-- CRM Probel — Buckets de Storage e suas policies
--
-- Buckets:
--   contact-media   → mídias trocadas em conversas (imagens, vídeos, áudios, docs)
--   media-library   → biblioteca de mídias prontas para envio rápido
--   avatars         → fotos de perfil de usuários e contatos (cache)
-- =============================================================================

-- Cria buckets (idempotente)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('contact-media', 'contact-media', true,  52428800, null),   -- 50MB
  ('media-library', 'media-library', true,  104857600, null),  -- 100MB
  ('avatars',       'avatars',       true,  5242880,  array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies de storage: autenticados podem ler/escrever; leitura pública só para visualização de mídias
do $$
declare
  b text;
begin
  for b in select unnest(array['contact-media','media-library','avatars']) loop
    execute format($p$
      drop policy if exists "storage_%1$s_select_public" on storage.objects;
      create policy "storage_%1$s_select_public" on storage.objects
        for select to public
        using (bucket_id = %1$L);
    $p$, b);

    execute format($p$
      drop policy if exists "storage_%1$s_insert_auth" on storage.objects;
      create policy "storage_%1$s_insert_auth" on storage.objects
        for insert to authenticated
        with check (bucket_id = %1$L);
    $p$, b);

    execute format($p$
      drop policy if exists "storage_%1$s_update_auth" on storage.objects;
      create policy "storage_%1$s_update_auth" on storage.objects
        for update to authenticated
        using (bucket_id = %1$L) with check (bucket_id = %1$L);
    $p$, b);

    execute format($p$
      drop policy if exists "storage_%1$s_delete_auth" on storage.objects;
      create policy "storage_%1$s_delete_auth" on storage.objects
        for delete to authenticated
        using (bucket_id = %1$L);
    $p$, b);
  end loop;
end $$;
