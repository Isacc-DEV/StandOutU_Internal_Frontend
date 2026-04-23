'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../../components/DeferredRouteLoader";

const ResumeTemplatesPageClient = dynamic(() => import("./ResumeTemplatesPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Resume Templates"
      detail="Loading template management and editor tools."
    />
  ),
});

export default function ManagerResumeTemplatesPage() {
  return <ResumeTemplatesPageClient />;
}
