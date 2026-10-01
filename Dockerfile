# Imagem do CRM para rodar na VPS, ao lado do banco.
#
# Motivo: hospedado na Vercel, cada consulta cruzava a internet até a VPS
# (~140ms, dos quais ~90ms só abrindo conexão). Rodando aqui, a mesma consulta
# leva 4-6ms — medido. Com 6-7 consultas por tela, é a maior diferença possível.

# ---------- dependências ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- compilação ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A VPS tem 1 núcleo e pouca memória sobrando: limita o heap para a compilação
# não competir com o WhatsApp e o banco que já rodam na máquina.
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV NEXT_TELEMETRY_DISABLED=1
# Variáveis que o Next precisa em tempo de compilação (as públicas viram
# constantes no código do navegador).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# ---------- execução ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Teto de memória do processo: evita que um pico do app comprometa o banco e o
# WhatsApp, que dividem a mesma máquina.
ENV NODE_OPTIONS=--max-old-space-size=384

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# O projeto não tem pasta public/ — se vier a ter, basta recriá-la que entra.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
