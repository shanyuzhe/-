/**
 * Client 侧 token 操作(只在浏览器运行,不能被 Server Component 导入)
 *
 * Token 用 cookie 存(不是 localStorage),这样 Server Component 也能读到。
 * 选 SameSite=Lax,避免第三方站点偷 token(对 CSRF 有基础保护)。
 */

export const TOKEN_COOKIE_NAME = "cco_token"
const COOKIE_NAME = TOKEN_COOKIE_NAME
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 天,和后端 JWT 过期对齐

export function setClientToken(token: string): void {
  if (typeof document === "undefined") return
  const secure = location.protocol === "https:" ? "; Secure" : ""
  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(token)}; ` +
    `path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function getClientToken(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`)
  )
  return m ? decodeURIComponent(m[1]) : null
}

export function clearClientToken(): void {
  if (typeof document === "undefined") return
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}

