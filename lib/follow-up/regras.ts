/**
 * Regras do follow-up automático: textos, horário, ritmo e o nome do cliente.
 *
 * Puro (sem banco): vale no servidor, que envia, e na tela, que mostra a prévia
 * e edita a configuração. Persistido em public.settings, chave 'follow_up', por
 * loja.
 */
import { isWithinBusinessHours } from "@/lib/business-hours";

export type EtapaFollowUp = {
  /** Horas depois da mensagem anterior (a 1ª conta a partir de quando ligou). */
  horas: number;
  /** Versões do texto. Cada envio sorteia uma -- mensagens iguais em série são
   *  o que mais denuncia disparo automático. */
  mensagens: string[];
};

/** Horário de envio de um dia da semana (0=domingo … 6=sábado), hora local. */
export type HorarioDia = { dia: number; inicio: string; fim: string };

export type FollowUpConfig = {
  /** Trava geral da loja: nada sai enquanto estiver pausado. */
  pausado: boolean;
  etapas: EtapaFollowUp[];
  /** Quando pode sair mensagem. Dia que não está na lista não envia. Cada dia
   *  tem o próprio horário: o sábado da loja, por exemplo, fecha mais cedo. */
  horarios: HorarioDia[];
  timezone: string;
  /** Máximo de mensagens de follow-up por dia, por loja. */
  limiteDiario: number;
  /** Espera entre uma mensagem e a próxima da mesma loja, sorteada nesta faixa. */
  intervaloMinMin: number;
  intervaloMaxMin: number;
};

export const DEFAULT_FOLLOW_UP: FollowUpConfig = {
  pausado: false,
  etapas: [
    {
      horas: 24,
      mensagens: [
        "Oi {cliente}, tudo bem? 😊 Ficou alguma dúvida sobre o que conversamos? Estou por aqui para te ajudar.",
        "Olá {cliente}! Passando para saber se você conseguiu pensar com calma. Posso te ajudar em mais alguma coisa?",
        "Oi {cliente}! Só para lembrar que continuo à disposição. Se quiser, te mando mais fotos ou detalhes 😉",
      ],
    },
    {
      horas: 48,
      mensagens: [
        "Oi {cliente}, tudo certo? Ainda está procurando? Posso conferir a disponibilidade e as condições de pagamento para você.",
        "Olá {cliente}! Não queria que você perdesse as condições que conversamos. Quer que eu te passe uma proposta atualizada?",
        "Oi {cliente}! Separei um tempinho para te dar atenção. Tem alguma dúvida que eu possa resolver agora?",
      ],
    },
    {
      horas: 168,
      mensagens: [
        "Oi {cliente}, tudo bem? Faz alguns dias que conversamos. Se ainda tiver interesse, é só me responder aqui que eu te ajudo 🙌",
        "Olá {cliente}! Vou deixar nosso canal aberto: quando quiser retomar, é só responder esta mensagem 😊",
        "Oi {cliente}! Ainda posso te ajudar com a sua compra? Se preferir, passe na loja para conhecer de perto.",
      ],
    },
  ],
  // Horário comercial das lojas: seg a sex das 9h às 18h, sáb das 9h às 12h.
  horarios: [
    { dia: 1, inicio: "09:00", fim: "18:00" },
    { dia: 2, inicio: "09:00", fim: "18:00" },
    { dia: 3, inicio: "09:00", fim: "18:00" },
    { dia: 4, inicio: "09:00", fim: "18:00" },
    { dia: 5, inicio: "09:00", fim: "18:00" },
    { dia: 6, inicio: "09:00", fim: "12:00" },
  ],
  timezone: "America/Sao_Paulo",
  limiteDiario: 40,
  intervaloMinMin: 2,
  intervaloMaxMin: 5,
};

function numero(v: unknown, padrao: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
}

function hora(v: unknown, padrao: string): string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : padrao;
}

/** Lê o que está gravado, completando com o padrão o que faltar ou vier torto. */
export function normalizarFollowUp(bruto: unknown): FollowUpConfig {
  const c = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<Record<keyof FollowUpConfig, unknown>>;
  const etapasBrutas = Array.isArray(c.etapas) ? c.etapas : [];
  const etapas = DEFAULT_FOLLOW_UP.etapas.map((padrao, i) => {
    const e = (etapasBrutas[i] ?? {}) as Partial<EtapaFollowUp>;
    const mensagens = Array.isArray(e.mensagens)
      ? e.mensagens.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      : [];
    return {
      horas: numero(e.horas, padrao.horas, 1, 24 * 30),
      mensagens: mensagens.length > 0 ? mensagens : padrao.mensagens,
    };
  });
  const horarios = normalizarHorarios(c.horarios);
  const intervaloMinMin = numero(c.intervaloMinMin, DEFAULT_FOLLOW_UP.intervaloMinMin, 1, 120);
  return {
    pausado: c.pausado === true,
    etapas,
    horarios: horarios.length > 0 ? horarios : DEFAULT_FOLLOW_UP.horarios,
    timezone: typeof c.timezone === "string" && c.timezone ? c.timezone : DEFAULT_FOLLOW_UP.timezone,
    limiteDiario: numero(c.limiteDiario, DEFAULT_FOLLOW_UP.limiteDiario, 1, 500),
    intervaloMinMin,
    intervaloMaxMin: Math.max(
      intervaloMinMin,
      numero(c.intervaloMaxMin, DEFAULT_FOLLOW_UP.intervaloMaxMin, 1, 240)
    ),
  };
}

/** Um horário por dia, ordenado, só com dias válidos e início antes do fim. */
function normalizarHorarios(bruto: unknown): HorarioDia[] {
  if (!Array.isArray(bruto)) return [];
  const porDia = new Map<number, HorarioDia>();
  for (const h of bruto as Partial<HorarioDia>[]) {
    const dia = Number(h?.dia);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) continue;
    const inicio = hora(h.inicio, "");
    const fim = hora(h.fim, "");
    if (!inicio || !fim || inicio >= fim) continue;
    porDia.set(dia, { dia, inicio, fim });
  }
  return [...porDia.values()].sort((a, b) => a.dia - b.dia);
}

/** Dia da semana (0=domingo) agora, no fuso da loja. */
function diaDaSemana(timezone: string, agora: Date): number {
  const curto = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(agora);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(curto);
}

export function dentroDaJanela(cfg: FollowUpConfig, agora: Date = new Date()): boolean {
  const hoje = cfg.horarios.find((h) => h.dia === diaDaSemana(cfg.timezone, agora));
  if (!hoje) return false;
  return isWithinBusinessHours(
    { enabled: true, start: hoje.inicio, end: hoje.fim, days: [hoje.dia], timezone: cfg.timezone },
    agora
  );
}

/** Meia-noite de hoje no fuso da loja -- de onde se conta o teto diário. */
export function inicioDoDia(timezone: string, agora: Date = new Date()): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(agora)
      .map((x) => [x.type, x.value])
  );
  const localComoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  const deslocamento = localComoUtc - Math.floor(agora.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - deslocamento);
}

export function sortear<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}

export function sortearEntre(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Quando a próxima etapa vence: as horas da etapa, contadas de `desde`, mais
 * até 20 minutos sorteados -- para os envios não caírem sempre no mesmo minuto
 * em que o vendedor ligou.
 */
export function proximoVencimento(desde: Date, horas: number): Date {
  return new Date(desde.getTime() + horas * 3_600_000 + Math.random() * 20 * 60_000);
}

/**
 * Primeiro nome apresentável do cliente, ou null.
 *
 * O nome salvo vem do perfil do WhatsApp, que costuma ter emoji, apelido,
 * número, título ou caixa alta ("🌸 MARI 🌸", "Dr. Carlos"). Fica a primeira
 * palavra feita de letras que não seja título, com a inicial maiúscula.
 */
const TITULOS = new Set(["dr", "dra", "sr", "sra", "srta", "prof", "profa"]);

export function primeiroNome(...candidatos: (string | null | undefined)[]): string | null {
  for (const bruto of candidatos) {
    if (!bruto) continue;
    const palavra = bruto
      .normalize("NFC")
      .replace(/[^\p{L}\s'-]/gu, " ")
      .trim()
      .split(/\s+/)
      .find((p) => p.replace(/[^\p{L}]/gu, "").length >= 2 && !TITULOS.has(p.toLowerCase()));
    if (!palavra) continue;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
  }
  return null;
}

/**
 * Monta o texto final.
 *
 * `{cliente}` vira o primeiro nome em negrito (*Maria*, que o WhatsApp mostra
 * destacado); `{primeiro_nome}` e `{nome}`, o nome sem destaque. Sem nome, o
 * espaço é retirado sem deixar a frase torta: "Oi {cliente}, tudo bem?" vira
 * "Oi, tudo bem?".
 */
export function montarMensagem(modelo: string, nome: string | null): string {
  let texto = modelo
    .replace(/\{cliente\}/gi, nome ? `*${nome}*` : "")
    .replace(/\{primeiro_nome\}|\{nome\}/gi, nome ?? "");
  if (!nome) {
    texto = texto
      .replace(/[ \t]+([,!?.])/g, "$1")
      .replace(/^[\s,!.]+/, "")
      .replace(/[ \t]{2,}/g, " ");
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  return texto.trim();
}

/** Quanto tempo o WhatsApp mostra "digitando…" antes de enviar. */
export function tempoDigitandoMs(texto: string): number {
  return Math.min(7000, Math.max(2500, 1500 + texto.length * 35)) + Math.random() * 1500;
}

/** "24h", "48h", "7 dias". */
export function descreverHoras(horas: number): string {
  return horas >= 72 && horas % 24 === 0 ? `${horas / 24} dias` : `${horas}h`;
}

const NOMES_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "09:00" → "9h"; "09:30" → "9h30". */
function horaCurta(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

/**
 * "seg a sex, das 9h às 18h; sáb, das 9h às 12h". Junta os dias seguidos que
 * têm o mesmo horário.
 */
export function descreverJanela(horarios: HorarioDia[]): string {
  const grupos: { de: number; ate: number; inicio: string; fim: string }[] = [];
  for (const h of [...horarios].sort((a, b) => a.dia - b.dia)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.ate === h.dia - 1 && ultimo.inicio === h.inicio && ultimo.fim === h.fim) {
      ultimo.ate = h.dia;
    } else {
      grupos.push({ de: h.dia, ate: h.dia, inicio: h.inicio, fim: h.fim });
    }
  }
  return grupos
    .map((g) => {
      const dias =
        g.de === g.ate
          ? NOMES_DIAS[g.de]
          : g.ate === g.de + 1
            ? `${NOMES_DIAS[g.de]} e ${NOMES_DIAS[g.ate]}`
            : `${NOMES_DIAS[g.de]} a ${NOMES_DIAS[g.ate]}`;
      return `${dias}, das ${horaCurta(g.inicio)} às ${horaCurta(g.fim)}`;
    })
    .join("; ");
}
