import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/* (ESP32 telemetry ingestion, Ola maps routing/geocode, buzzer command, NextAuth handlers)
     * - /_next/static (static chunks)
     * - /_next/image (image optimization)
     * - /favicon.ico and static assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
