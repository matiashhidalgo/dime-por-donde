import type { NextConfig } from "next";

// Static export: the whole game is client-side, no server needed.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
