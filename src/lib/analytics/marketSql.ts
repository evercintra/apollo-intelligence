import { sql, type SQL } from "drizzle-orm";

export function enrichedDomainsSql(): SQL {
  return sql`
    WITH enriched_domains AS (
      SELECT DISTINCT ON (normalized_domain)
        normalized_domain,
        domain,
        country_code,
        c1,
        c2,
        platform,
        annual_sales,
        installed_apps_array
      FROM (
        SELECT
          domain,
          regexp_replace(lower(domain), '^www\\.', '') AS normalized_domain,
          country_code,
          c1,
          c2,
          platform,
          annual_sales,
          installed_apps_array
        FROM clean_domains
      ) source
      ORDER BY normalized_domain, (domain = normalized_domain) DESC, domain
    )
  `;
}

export function marketScopeSql(organizationId: string): SQL {
  return sql`
    FROM targeted_domains td
    LEFT JOIN enriched_domains cd ON cd.normalized_domain = td.domain
    WHERE td.organization_id = ${organizationId}
  `;
}
