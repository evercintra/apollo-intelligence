import "server-only";

import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentOrganizationId } from "@/lib/tenancy/scope";
import { ratio, type AnalyticsRange, type MarketAnalytics, type Metric } from "./contract";
import { enrichedDomainsSql, marketScopeSql } from "./marketSql";
import { createLimiter, inPreviousRange, inRange, num } from "./server";

const STATUS_LABEL: Record<string, string> = {
  qualified: "Qualificado",
  apollo_has_data: "Com dados no Apollo",
  apollo_no_data: "Sem dados no Apollo",
  not_live: "Não está ativo",
  no_ads: "Sem anúncios",
  pending: "Pendente",
};

const REVENUE_ORDER = ["Até $1M", "$1M–$5M", "$5M–$10M", "$10M–$50M", "$50M–$100M", "$100M+", "Não informado"];

export async function getMarketAnalytics(range: AnalyticsRange): Promise<MarketAnalytics> {
  const org = currentOrganizationId();
  const enrichment = enrichedDomainsSql();
  const scope = marketScopeSql(org);

  const limit = createLimiter(3);
  const [kpiRows, countryRows, segmentRows, subsegmentRows, platformRows, revenueRows, statusRows, appRows, universeRows] = await Promise.all([
    limit(() =>
      db.execute<Record<string, number>>(sql`
        ${enrichment}
        SELECT
          count(*)::int AS analyzed_total,
          count(*) FILTER (WHERE ${inRange(sql`td.checked_at`, range)})::int AS analyzed_cur,
          count(*) FILTER (WHERE ${inPreviousRange(sql`td.checked_at`, range)})::int AS analyzed_prev,
          count(*) FILTER (WHERE td.status = 'qualified')::int AS qualified_total,
          count(*) FILTER (WHERE td.status = 'qualified' AND ${inRange(sql`td.checked_at`, range)})::int AS qualified_cur,
          count(*) FILTER (WHERE td.status = 'qualified' AND ${inPreviousRange(sql`td.checked_at`, range)})::int AS qualified_prev,
          count(DISTINCT cd.country_code)::int AS countries,
          count(DISTINCT cd.c1)::int AS segments,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY cd.annual_sales::numeric) AS median_revenue
        ${scope}`)),
    limit(() => breakdown(enrichment, sql`cd.country_code`, scope, 8)),
    limit(() => breakdown(enrichment, sql`cd.c1`, scope, 8)),
    limit(() => breakdown(enrichment, sql`cd.c2`, scope, 8)),
    limit(() => breakdown(enrichment, sql`cd.platform`, scope, 8)),
    limit(() =>
      db.execute<{ label: string; value: number }>(sql`
        ${enrichment}
        SELECT CASE
          WHEN cd.annual_sales IS NULL THEN 'Não informado'
          WHEN cd.annual_sales < 1000000 THEN 'Até $1M'
          WHEN cd.annual_sales < 5000000 THEN '$1M–$5M'
          WHEN cd.annual_sales < 10000000 THEN '$5M–$10M'
          WHEN cd.annual_sales < 50000000 THEN '$10M–$50M'
          WHEN cd.annual_sales < 100000000 THEN '$50M–$100M'
          ELSE '$100M+'
        END AS label, count(*)::int AS value
        ${scope}
        GROUP BY 1`)),
    limit(() => breakdown(enrichment, sql`td.status`, scope)),
    limit(() =>
      db.execute<{ key: string | null; value: number }>(sql`
        ${enrichment}
        SELECT a.app AS key, count(*)::int AS value
        FROM targeted_domains td
        LEFT JOIN enriched_domains cd ON cd.normalized_domain = td.domain
        CROSS JOIN LATERAL unnest(coalesce(cd.installed_apps_array, '{}'::text[])) AS a(app)
        WHERE td.organization_id = ${org} AND a.app IS NOT NULL AND btrim(a.app) <> ''
        GROUP BY 1
        ORDER BY value DESC
        LIMIT 8`)),
    limit(() => db.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM clean_domains`)),
  ]);

  const metric = (value: number, previous: number): Metric => ({ value, previous });
  const k = kpiRows[0] ?? {};
  const analyzedCur = num(k.analyzed_cur);
  const analyzedPrev = num(k.analyzed_prev);
  const qualifiedCur = num(k.qualified_cur);
  const qualifiedPrev = num(k.qualified_prev);

  return {
    view: "market",
    range,
    kpis: {
      analyzedDomains: { total: num(k.analyzed_total), inRange: metric(analyzedCur, analyzedPrev) },
      qualifiedDomains: { total: num(k.qualified_total), inRange: metric(qualifiedCur, qualifiedPrev) },
      qualificationRate: {
        value: ratio(qualifiedCur, analyzedCur),
        previous: ratio(qualifiedPrev, analyzedPrev),
      },
      countries: num(k.countries),
      segments: num(k.segments),
      medianRevenue: k.median_revenue === null || k.median_revenue === undefined ? null : num(k.median_revenue),
    },
    universe: { total: num(universeRows[0]?.total) },
    byCountry: countryRows.map((row) => ({ key: row.key ?? "unknown", label: row.key ?? "Não informado", value: num(row.value) })),
    bySegment: segmentRows.map((row) => ({ key: row.key ?? "unknown", label: row.key ?? "Não informado", value: num(row.value) })),
    bySubsegment: subsegmentRows.map((row) => ({ key: row.key ?? "unknown", label: row.key ?? "Não informado", value: num(row.value) })),
    byPlatform: platformRows.map((row) => ({ key: row.key ?? "unknown", label: row.key ?? "Não informado", value: num(row.value) })),
    byRevenue: [...revenueRows]
      .map((row) => ({ key: row.label, label: row.label, value: num(row.value) }))
      .sort((a, b) => REVENUE_ORDER.indexOf(a.key) - REVENUE_ORDER.indexOf(b.key)),
    byStatus: statusRows.map((row) => ({ key: row.key ?? "unknown", label: STATUS_LABEL[row.key ?? ""] ?? "Outro", value: num(row.value) })),
    topApps: appRows.map((row) => ({ key: row.key ?? "unknown", label: row.key ?? "Não informado", value: num(row.value) })),
  };
}

async function breakdown(enrichment: SQL, column: SQL, scope: SQL, limit?: number): Promise<Array<{ key: string | null; value: number }>> {
  return db.execute<{ key: string | null; value: number }>(sql`
    ${enrichment}
    SELECT ${column} AS key, count(*)::int AS value
    ${scope}
    GROUP BY 1
    ORDER BY value DESC
    ${limit === undefined ? sql.empty() : sql`LIMIT ${limit}`}`);
}
