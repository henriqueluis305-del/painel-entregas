import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que outros dispositivos na mesma rede acessem o dev server via IP
  allowedDevOrigins: ["26.186.226.255"],
  // Uploads de CSV/XLSX da Shopee podem ser grandes (10k+ linhas)
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
