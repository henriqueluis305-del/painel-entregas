import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone p/ imagem Docker enxuta (deploy AWS/EC2); inócuo na Vercel.
  output: "standalone",
  // Esconde o indicador de dev do Next (o botãozinho "N")
  devIndicators: false,
  // Permite que outros dispositivos na mesma rede acessem o dev server via IP
  allowedDevOrigins: ["26.186.226.255", "177.154.6.56", "26.66.241.166", "192.168.1.144"],
  // Uploads de CSV/XLSX da Shopee podem ser grandes (10k+ linhas)
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
