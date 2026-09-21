/**
 * Eventos padrão do Meta que uma etapa pode disparar.
 *
 * Fica FORA de actions.ts de propósito: um arquivo "use server" só pode
 * exportar funções assíncronas. Exportar a lista de lá fazia ela chegar
 * indefinida no navegador e quebrar a tela ao abrir o formulário.
 *
 * Mantenha em sincronia com a checagem `pipeline_stages_meta_event_chk`
 * (migração 0023).
 */
export const EVENTOS_META = [
  "Contact",
  "Lead",
  "CompleteRegistration",
  "Schedule",
  "ViewContent",
  "InitiateCheckout",
  "AddToCart",
  "AddPaymentInfo",
  "Purchase",
  "Subscribe",
  "StartTrial",
  "SubmitApplication",
  "FindLocation",
  "Search",
  "CustomizeProduct",
  "AddToWishlist",
  "Donate",
] as const;

export type CamposDaEtapa = {
  name: string;
  meta_event_name: string | null;
  is_sale: boolean;
  default_value: number | null;
  is_first_contact: boolean;
  keyword: string | null;
};
