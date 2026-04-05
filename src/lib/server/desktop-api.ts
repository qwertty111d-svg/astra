const desktopCorsHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Desktop-Token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function desktopJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: desktopCorsHeaders,
  });
}

export function desktopOptions() {
  return new Response(null, {
    status: 204,
    headers: desktopCorsHeaders,
  });
}
