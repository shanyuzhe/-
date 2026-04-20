/**
 * 通用反向代理:浏览器 → Next.js → FastAPI 后端
 *
 * 背景:Windows 系统代理(Clash 等)会 hook 浏览器的 127.0.0.1 请求,
 *       导致 POST 类请求被吞。改走 Next.js 代理层就没这问题,
 *       因为浏览器只访问自己的 localhost:3000。
 *
 * 使用:
 *   前端 Client Component fetch('/api/proxy/plan/import', ...)
 *   → 此 route handler 接收
 *   → fetch('http://127.0.0.1:8000/plan/import', ...)
 *   → 把响应原样返回
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE =
  process.env.BACKEND_BASE ?? "http://127.0.0.1:8000"

// 需要透传的 headers(剔除 Node/Next 自动管理的)
const DROPPED_REQ_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "transfer-encoding",
])

async function forward(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await ctx.params
  const qs = req.nextUrl.search // 带 "?" 前缀或空串
  const url = `${BACKEND_BASE}/${path.join("/")}${qs}`

  // 透传 headers(过滤几个 Node 自己管的)
  const headers = new Headers()
  req.headers.forEach((v, k) => {
    if (!DROPPED_REQ_HEADERS.has(k.toLowerCase())) {
      headers.set(k, v)
    }
  })

  // body 只在非 GET/HEAD 时带
  const method = req.method.toUpperCase()
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text()

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body,
      // 后端可能慢(extraction 90s+),给充足 timeout
      signal: AbortSignal.timeout(300_000),
      cache: "no-store",
    })

    const respBody = await upstream.text()
    const outHeaders = new Headers()
    outHeaders.set(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json"
    )
    return new NextResponse(respBody, {
      status: upstream.status,
      headers: outHeaders,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "proxy_error", detail: msg, target: url },
      { status: 502 }
    )
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, ctx)
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, ctx)
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, ctx)
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, ctx)
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, ctx)
}
