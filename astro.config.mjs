import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

const site = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://astraboost.ru";

export default defineConfig({
  site,
  output: "server",
  adapter: vercel(),
});
