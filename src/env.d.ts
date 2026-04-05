/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import("./lib/server/auth.js").UserRecord | null;
    session: import("./lib/server/auth.js").SessionRecord | null;
  }
}