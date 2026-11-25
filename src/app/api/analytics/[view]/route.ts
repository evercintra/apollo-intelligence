import type { NextRequest } from "next/server";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";
import { ANALYTICS_VIEWS, type AnalyticsRange, type AnalyticsResponse, type AnalyticsView } from "@/lib/analytics/contract";
import { getActionsAnalytics } from "@/lib/analytics/actions.server";
import { getEmailAnalytics } from "@/lib/analytics/email.server";
import { getLinkedinAnalytics } from "@/lib/analytics/linkedin.server";
import { getMarketAnalytics } from "@/lib/analytics/market.server";
import { getOverviewAnalytics } from "@/lib/analytics/overview.server";
import { getPipelineAnalytics } from "@/lib/analytics/pipeline.server";
import { getProspectingAnalytics } from "@/lib/analytics/prospecting.server";
import { AnalyticsRangeError, parseAnalyticsRange } from "@/lib/analytics/server";
import { getWhatsappAnalytics } from "@/lib/analytics/whatsapp.server";

export const dynamic = "force-dynamic";

const LOADERS: Record<AnalyticsView, (range: AnalyticsRange) => Promise<AnalyticsResponse>> = {
  overview: getOverviewAnalytics,
  market: getMarketAnalytics,
  prospecting: getProspectingAnalytics,
  pipeline: getPipelineAnalytics,
  actions: getActionsAnalytics,
  email: getEmailAnalytics,
  linkedin: getLinkedinAnalytics,
  whatsapp: getWhatsappAnalytics,
};

/**
 * GET /api/analytics/{overview|market|prospecting|pipeline|actions|email|linkedin|whatsapp}?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Area/City
 * Behind the site auth like every other /api route (src/proxy.ts).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ view: string }> }) {
  const { view } = await context.params;
  if (!(ANALYTICS_VIEWS as readonly string[]).includes(view)) {
    return Response.json({ error: `Visualização de análise desconhecida: ${view}` }, { status: 404 });
  }
  try {
    const range = parseAnalyticsRange(request.nextUrl.searchParams);
    return await withOrgContext(request, async () => Response.json(await LOADERS[view as AnalyticsView](range)));
  } catch (error) {
    const denied = authContextErrorResponse(error);
    if (denied) return denied;
    if (error instanceof AnalyticsRangeError) return Response.json({ error: error.message }, { status: 400 });
    console.error(`[analytics:${view}]`, error);
    return Response.json({ error: "Não foi possível carregar as análises" }, { status: 500 });
  }
}
