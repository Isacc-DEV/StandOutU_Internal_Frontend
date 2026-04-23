'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../../components/DeferredRouteLoader";

const ApplicationsPageClient = dynamic(() => import("./ApplicationsPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Application Management"
      detail="Loading application records, filters, and management controls."
    />
  ),
});

export default function ManagerApplicationsPage() {
  return <ApplicationsPageClient />;
}
