import type { APIRoute } from "astro";
import { getUsers, saveUsers } from "../../../lib/server/auth.js";

export const prerender = false;

export const GET: APIRoute = async ({ request, redirect }) => {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return redirect("/account/security?email=missing");
  }

  const users = await getUsers();
  const userIndex = users.findIndex(
    (item) =>
      item.pendingEmailVerificationToken === token &&
      item.pendingEmail &&
      item.pendingEmailVerificationExpiresAt &&
      new Date(item.pendingEmailVerificationExpiresAt).getTime() > Date.now()
  );

  if (userIndex === -1) {
    return redirect("/account/security?email=invalid");
  }

  const user = users[userIndex];

  users[userIndex] = {
    ...user,
    email: user.pendingEmail!,
    emailVerified: true,
    pendingEmail: null,
    pendingEmailVerificationToken: null,
    pendingEmailVerificationExpiresAt: null,
  };

  await saveUsers(users);

  return redirect("/account/security?email=verified");
};