import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um pacote mínimo e autossuficiente para rodar fora da Vercel: leva só
  // o que o app usa, em vez de toda a node_modules. Importa numa VPS com pouca
  // memória, onde cada MB conta.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "pps.whatsapp.net" },
      { protocol: "https", hostname: "mmg.whatsapp.net" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
