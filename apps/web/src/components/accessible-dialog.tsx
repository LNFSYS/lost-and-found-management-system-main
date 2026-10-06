import { useRef, type HTMLAttributes } from "react";
import { useModalFocus } from "../hooks/use-modal-focus";

export function AccessibleDialog({ onDismiss, busy = false, ...props }: HTMLAttributes<HTMLDivElement> & {
  onDismiss: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, true, onDismiss, busy);
  return <div {...props} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" />;
}
