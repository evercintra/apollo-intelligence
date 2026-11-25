import { Suspense } from "react";
import Filters from "@/components/Filters";
import DomainsTable from "@/components/DomainsTable";
import TableSkeleton from "@/components/TableSkeleton";
import TableLoadingOverlay from "@/components/TableLoadingOverlay";
import { NavigationProvider } from "@/components/NavigationProvider";
import { requirePageOrgContext } from "@/lib/auth/context";
import { getDomains } from "@/lib/queries";
import { DEFAULT_COUNTRY_CODE } from "@/lib/prospectingLabels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Record<string, string | string[] | undefined>;

function getQueryParams(params: Params) {
  return {
    page: params.page as string,
    pageSize: params.pageSize as string,
    countryCode: (params.countryCode as string) ?? DEFAULT_COUNTRY_CODE,
    c1: params.c1 as string,
    c2: params.c2 as string,
    c3: params.c3 as string,
    platform: params.platform as string,
    app: params.app as string,
    minRevenue: params.minRevenue as string,
    maxRevenue: params.maxRevenue as string,
    sortBy: params.sortBy as string,
    sortDir: params.sortDir as string,
  };
}

async function TableSection({ params }: { params: Params }) {
  const result = await getDomains(getQueryParams(params));
  return (
    <DomainsTable
      data={result.data}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      totalPages={result.totalPages}
    />
  );
}

export default async function DomainsPage({ searchParams }: { searchParams: SearchParams }) {
  // The domains dataset is global (no organization scope), but the visitor
  // must be a member of an organization.
  await requirePageOrgContext();
  const params = await searchParams;

  return (
    <NavigationProvider>
      <div className="flex h-full flex-col overflow-hidden bg-bg-weak-50 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="max-h-[45vh] w-full shrink-0 overflow-y-auto border-b border-stroke-soft-200 bg-bg-white-0 md:max-h-none md:w-64 md:border-b-0 md:border-r">
            <div className="border-b border-stroke-soft-200 px-4 py-4">
              <h1 className="text-sm font-bold text-text-strong-950">Domínios brasileiros</h1>
              <p className="mt-0.5 text-xs text-text-strong-950/60">
                Explore empresas brasileiras por segmento, tecnologia, plataforma e estimativa de faturamento.
              </p>
            </div>
            <Suspense>
              <Filters />
            </Suspense>
          </aside>

          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-weak-50">
            <TableLoadingOverlay />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
              <Suspense fallback={<TableSkeleton />}>
                <TableSection params={params} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </NavigationProvider>
  );
}
