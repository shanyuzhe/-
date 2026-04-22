/**
 * Server 侧 token 读取。
 *
 * 故意不在 top-level import "next/headers",改为运行时 await import。
 * 否则 Next.js 的 Client Component 静态分析会把 auth-server 拖进 client bundle
 * 并报错(next/headers 不能在 client 运行)。
 */

export const TOKEN_COOKIE_NAME = "cco_token"

export async function getServerToken(): Promise<string | null> {
  const { cookies } = await import("next/headers")
  const store = await cookies()
  return store.get(TOKEN_COOKIE_NAME)?.value ?? null
}
