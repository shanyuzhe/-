import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Next.js 16 默认只允许 localhost 作为 dev 源。手机/LAN 访问时,
  // Client Component 的 fetch 到 /api/proxy/* 会被当跨域拦截。
  // 允许局域网 IP 和常见本地地址。
  allowedDevOrigins: [
    "192.168.31.14",
    "localhost",
    "127.0.0.1",
    "*.local",
  ],
}

export default nextConfig
