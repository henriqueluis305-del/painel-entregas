import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone p/ imagem Docker enxuta (deploy AWS/EC2); inócuo na Vercel.
  output: "standalone",
  // Esconde o indicador de dev do Next (o botãozinho "N")
  devIndicators: false,
  // IPs da LAN + domínios de túnel (cloudflared/ngrok/devtunnels/localtunnel)
  // pra outra pessoa acessar o dev server sem estar na mesma rede.
  // `**` = wildcard recursivo (casa 1+ rótulos); necessário pro devtunnels, que
  // tem 2 níveis: <nome>-<porta>.<regiao>.devtunnels.ms.
  allowedDevOrigins: [
    "26.186.226.255", "177.154.6.56", "26.66.241.166", "192.168.1.144",
    "**.trycloudflare.com", "**.ngrok-free.app", "**.devtunnels.ms", "**.loca.lt",
  ],
  // Uploads de CSV/XLSX da Shopee podem ser grandes (10k+ linhas)
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
      // Server Actions validam a origem; sem liberar o host do túnel dá
      // "x-forwarded-host does not match origin" ao subir arquivo pela URL pública.
      allowedOrigins: ["**.trycloudflare.com", "**.ngrok-free.app", "**.devtunnels.ms", "**.loca.lt"],
    },
  },
};

export default nextConfig;
