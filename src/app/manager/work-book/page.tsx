'use client';

import { Suspense } from "react";
import ManagerShell from "../../../components/ManagerShell";
import DeferredRouteLoader from "../../../components/DeferredRouteLoader";
import WorkbookContent from "../../../components/workbook/WorkbookContent";

export default function ManagerWorkBookPage() {
  return (
    <ManagerShell>
      <Suspense
        fallback={
          <DeferredRouteLoader
            title="Work book"
            detail="Loading workbook entries, filters, and review tools."
          />
        }
      >
        <WorkbookContent />
      </Suspense>
    </ManagerShell>
  );
}
