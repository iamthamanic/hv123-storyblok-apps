import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@storyblok/app-extension-auth", "openid-client"],
};

export default nextConfig;
