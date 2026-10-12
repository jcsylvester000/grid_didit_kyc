import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, ACCESS_GRANTED, readSigned } from "@/lib/server/signing";

// Internal app gate (Next.js 16 proxy, runs before any page renders).
// Without a valid access cookie, every page request is rewritten to /unlock (URL stays the same),
// so no listing or verification data is rendered or sent to the browser.
export function proxy(req: NextRequest) {
  if (readSigned(req.cookies.get(ACCESS_COOKIE)?.value) === ACCESS_GRANTED) return NextResponse.next();
  // Server actions carry their own access check (requireAccess); the unlock action must get through.
  if (req.method === "POST" && req.headers.has("next-action")) return NextResponse.next();
  if (req.nextUrl.pathname === "/unlock") return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.rewrite(url);
}

export const config = {
  // Open: Didit webhook, health check, Next.js assets, brand files and the app icon.
  matcher: ["/((?!api/didit/webhook|api/health|_next/static|_next/image|brand/|icon.png|favicon.ico).*)"],
};
