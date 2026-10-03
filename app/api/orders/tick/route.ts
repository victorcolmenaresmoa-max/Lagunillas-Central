import { privateJson } from "@/lib/order-server";
import { getServiceClient } from "@/lib/supabase-server";
import { fail, tick } from "@/lib/order-server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return fail("No autorizado.", 401);
  try {
    await tick(getServiceClient());
    return privateJson({ ok: true });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
