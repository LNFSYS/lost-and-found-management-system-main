import { CalendarDays, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { AccessibleDialog } from "./accessible-dialog";

const AppointmentWorkspace = lazy(() => import("../pages/appointments-page").then(module => ({ default: module.AppointmentWorkspace })));

export function ClaimAppointmentDialog({ claimId, canPropose, onDismiss }: { claimId: string; canPropose: boolean; onDismiss: () => void }) {
  const [appointmentId, setAppointmentId] = useState<string>();
  const [busy, setBusy] = useState(false);
  function dismiss() { if (!busy) onDismiss(); }
  return createPortal(<div className="custody-modal-overlay" onMouseDown={event => {
    if (event.target === event.currentTarget) dismiss();
  }}>
    <AccessibleDialog className="custody-modal claim-appointment-dialog" aria-labelledby="claim-appointment-title" busy={busy} onDismiss={dismiss}>
      <header className="claim-appointment-dialog__header">
        <h2 id="claim-appointment-title"><CalendarDays size={20}/> Lịch hẹn trả đồ</h2>
        <button type="button" title="Đóng lịch hẹn" aria-label="Đóng lịch hẹn" disabled={busy} onClick={dismiss}><X size={20}/></button>
      </header>
      <Suspense fallback={<p role="status">Đang tải lịch hẹn...</p>}>
        <AppointmentWorkspace key={claimId} claimId={claimId} appointmentId={appointmentId} embedded canPropose={canPropose} onSelect={setAppointmentId} onBusyChange={setBusy}/>
      </Suspense>
    </AccessibleDialog>
  </div>, document.body);
}
