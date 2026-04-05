export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, message: 'ping works' }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
}