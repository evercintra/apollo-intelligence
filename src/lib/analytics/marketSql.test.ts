import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { enrichedDomainsSql, marketScopeSql } from "./marketSql";

const dialect = new PgDialect();
const render = (query: ReturnType<typeof enrichedDomainsSql>) => dialect.sqlToQuery(query).sql;

describe("market SQL building", () => {
  test("deduplicates normalized clean domains before joining", () => {
    const sqlText = render(enrichedDomainsSql());
    expect(sqlText).toMatch(/with enriched_domains as/i);
    expect(sqlText).toMatch(/distinct on \(normalized_domain\)/i);
    expect(sqlText).toMatch(/regexp_replace\(lower\(domain\)/i);
    expect(sqlText).toMatch(/order by normalized_domain/i);
  });

  test("left joins enrichment so domains without clean_domains rows are kept", () => {
    const sqlText = render(marketScopeSql("org-1"));
    expect(sqlText).toMatch(/from targeted_domains td/i);
    expect(sqlText).toMatch(/left join enriched_domains cd/i);
    expect(sqlText).toMatch(/cd\.normalized_domain = td\.domain/i);
    expect(sqlText).toMatch(/td\.organization_id/i);
    expect(sqlText).not.toMatch(/join clean_domains/i);
  });
});
