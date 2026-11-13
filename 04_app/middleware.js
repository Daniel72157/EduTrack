import { NextResponse } from "next/server";
import { COOKIE, HOME, verifySession } from "@/lib/session";

// Protege las páginas por rol. Las API repiten la verificación (y además consultan la base
// para respetar cuentas desactivadas), así que esto es solo la primera barrera y la redirección.
const PANEL_ROL = { "/estudiante": "student", "/profesor": "teacher", "/admin": "admin" };

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const sesion = await verifySession(req.cookies.get(COOKIE)?.value);

  if (pathname === "/login") {
    return sesion ? NextResponse.redirect(new URL(HOME[sesion.role], req.url)) : NextResponse.next();
  }
  if (!sesion) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const panel = Object.keys(PANEL_ROL).find((p) => pathname === p || pathname.startsWith(p + "/"));
  if (pathname === "/" || (panel && PANEL_ROL[panel] !== sesion.role)) {
    return NextResponse.redirect(new URL(HOME[sesion.role], req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/estudiante/:path*", "/profesor/:path*", "/admin/:path*"] };
