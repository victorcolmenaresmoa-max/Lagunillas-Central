import CoverageClient from "@/components/CoverageClient";
import { getPublicClient } from "@/lib/supabase";
import { DEFAULT_CONFIG } from "@/lib/geo";
export const dynamic = "force-dynamic";
export default async function Coverage() {
  const sb = getPublicClient();
  const result = sb
    ? await sb
        .from("app_settings")
        .select("order_config")
        .eq("id", 1)
        .maybeSingle()
    : null;
  return (
    <CoverageClient config={result?.data?.order_config || DEFAULT_CONFIG} />
  );
}
