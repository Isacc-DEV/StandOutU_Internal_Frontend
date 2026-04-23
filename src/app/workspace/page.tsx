'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../components/DeferredRouteLoader";

const WorkspacePageClient = dynamic(() => import("./WorkspacePageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Workspace"
      detail="Loading the browser workspace, profiles, and autofill tools."
    />
  ),
});

export default function WorkspacePage() {
  return <WorkspacePageClient />;
}
