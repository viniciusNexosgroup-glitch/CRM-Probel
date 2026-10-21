-- =============================================================================
-- 0033 — Cada pessoa só lista, altera e apaga os arquivos que ela enviou.
--
-- As regras do armazenamento (fotos, áudios, vídeos de clientes, biblioteca de
-- mídias e fotos de perfil) valiam para o balde INTEIRO:
--
--   * LISTAR estava liberado para `public` -- inclusive quem nem fez login.
--     Com a chave pública, que fica dentro do próprio site, qualquer pessoa
--     listava 465 arquivos de mídia das duas lojas; como o balde é público,
--     também os baixava. A Ticiany listava 244 arquivos da Vivence.
--   * APAGAR e ALTERAR estavam liberados para qualquer usuário logado, em
--     qualquer arquivo, de qualquer loja.
--
-- Nada disso aparecia nas telas do CRM -- só chamando a API diretamente --,
-- mas a API é pública.
--
-- O que NÃO muda: os links públicos dos arquivos. O balde continua público, e o
-- endereço público serve o arquivo sem passar por estas regras. É por ele que
-- o CRM mostra as mídias e que o WhatsApp busca o arquivo para enviar.
--
-- Os arquivos que chegam pelo WhatsApp são gravados pelo servidor com a chave
-- administrativa, que ignora estas regras -- a limpeza diária e o backup
-- seguem funcionando. A biblioteca de mídias, onde um admin pode apagar arquivo
-- de outro, passa a apagar pelo servidor depois de o banco confirmar a
-- permissão (ver settings/media-library/actions.ts).
-- =============================================================================

do $$
declare
  b    text;
  dono text := '(owner = (select auth.uid()) or owner_id = (select auth.uid())::text)';
begin
  for b in select unnest(array['contact-media', 'media-library', 'avatars']) loop
    execute format('drop policy if exists %I on storage.objects', 'storage_' || b || '_select_public');
    execute format('drop policy if exists %I on storage.objects', 'storage_' || b || '_select_own');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and %s)',
      'storage_' || b || '_select_own', b, dono);

    execute format('drop policy if exists %I on storage.objects', 'storage_' || b || '_update_auth');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and %s) with check (bucket_id = %L and %s)',
      'storage_' || b || '_update_auth', b, dono, b, dono);

    execute format('drop policy if exists %I on storage.objects', 'storage_' || b || '_delete_auth');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and %s)',
      'storage_' || b || '_delete_auth', b, dono);
  end loop;
end $$;
