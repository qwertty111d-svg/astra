import type { APIRoute } from "astro";
import { getSiteUrl } from "../lib/server/env.js";

const routes = [
  "/",
  "/pricing",
  "/login",
  "/register",
  "/forgot-password",
  "/account",
  "/account/security",
];

export const GET: APIRoute = async () => {
  const site = getSiteUrl();
  const now = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    routes.map((route) => `<url><loc>${site}${route}</loc><lastmod>${now}</lastmod></url>`).join("") +
    `</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
