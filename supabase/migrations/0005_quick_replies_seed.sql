-- =============================================================================
-- Respostas rápidas iniciais (exemplos editáveis pela Ticiany)
-- =============================================================================

insert into public.quick_replies (shortcut, title, content, category) values
  (
    '/oi',
    'Saudação inicial',
    'Olá {primeiro_nome}, tudo bem? Sou a Ticiany da Colchões Probel Uberlândia 😊 Como posso te ajudar?',
    'Saudação'
  ),
  (
    '/casal',
    'Preço casal',
    'Nossos colchões de casal começam a partir de R$ 1.299,00. Quer que eu te mande as opções com mais detalhes, {primeiro_nome}?',
    'Preços'
  ),
  (
    '/endereco',
    'Endereço da loja',
    'Estamos na Rua [endereço], Uberlândia/MG. Funcionamos de seg a sex 9h-18h e sáb 9h-13h. Pode vir nos visitar! 🛏️',
    'Logística'
  )
on conflict (shortcut) do nothing;
