import { KpiStripSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/page/Skeletons";

export default function WhatsappCampaignsLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeaderSkeleton />
      <KpiStripSkeleton cells={4} />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
