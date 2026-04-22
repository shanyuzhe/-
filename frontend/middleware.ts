import { NextRequest, NextResponse } from "next/server"

const TOKEN_COOKIE = "cco_token"

// 登录后才能访问的路径(前缀匹配)
const PROTECTED_PREFIXES = ["/", "/plan", "/progress", "/onboarding"]

// 已登录状态下,访问 /login /register 应反向 redirect 回首页
const AUTH_PAGES = ["/login", "/register"]

// 公开路径(未登录也能访问,不会被 redirect)
const PUBLIC_PREFIXES = ["/faq", "/guide"]

function isProtected(pathname: string): boolean {
  // API proxy、静态资源、next 内部路由跳过
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return false
  }
  if (AUTH_PAGES.includes(pathname)) return false
  // 公开页放行
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return false
  }
  // 其他都要登录
  return PROTECTED_PREFIXES.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  )
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasToken = Boolean(req.cookies.get(TOKEN_COOKIE)?.value)

  // 已登录访问登录/注册 → 回首页
  if (hasToken && AUTH_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // 未登录访问保护路径 → 去登录(带 next 参数)
  if (!hasToken && isProtected(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // 排除 api/proxy(由后端自己处理 auth)+ 静态资源
  matcher: [
    "/((?!api/proxy|_next/static|_next/image|favicon.ico).*)",
  ],
}
