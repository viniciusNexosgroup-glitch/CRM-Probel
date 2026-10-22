-- =============================================================================
-- 0035 — Arquivos de conversa até 100 MB.
--
-- O balde `contact-media` aceitava até 50 MB, e a tela barrava vídeo acima de
-- 16 MB. Um atendente não conseguia mandar um vídeo de 42 MB gravado no
-- celular. Agora:
--
--   * foto, vídeo e áudio até 16 MB seguem como mídia (o teto do WhatsApp);
--   * acima disso, até 100 MB, vão como documento -- é como o próprio WhatsApp
--     faz: o vídeo de 46 MB que um cliente mandou à Probel chegou como
--     documento. O CRM continua mostrando o player.
--
-- O mesmo teto vale para o que chega pelo WhatsApp e é guardado aqui.
--
-- ATENÇÃO, self-hosted: o serviço de Storage tem um teto próprio, global
-- (`FILE_SIZE_LIMIT` no docker-compose), que precisa ser >= este. Ele foi
-- elevado para 104857600 junto com esta migração.
--
-- Espaço: a limpeza diária apaga a mídia das conversas depois de 5 dias, e o
-- disco da VPS tinha 30 GB livres na mudança.
-- =============================================================================

update storage.buckets
   set file_size_limit = 104857600 -- 100 MB
 where id = 'contact-media';
