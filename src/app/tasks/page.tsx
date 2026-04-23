'use client';

import dynamic from "next/dynamic";
import DeferredRouteLoader from "../../components/DeferredRouteLoader";

const TasksPageClient = dynamic(() => import("./TasksPageClient"), {
  ssr: false,
  loading: () => (
    <DeferredRouteLoader
      title="Task Center"
      detail="Loading tasks, assignments, and review tools."
    />
  ),
});

export default function TasksPage() {
  return <TasksPageClient />;
}
