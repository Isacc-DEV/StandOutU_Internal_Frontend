'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../components/DeferredRouteLoader";

const ReportsPageClient = dynamic(() => import("./ReportsPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Reports"
      detail="Loading reporting history, calendar data, and review actions."
    />
  ),
});

export default function ReportsPage() {
  return <ReportsPageClient />;
}
