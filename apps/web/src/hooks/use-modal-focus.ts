import { useLayoutEffect, useRef, type RefObject } from "react";

type Modal = { element: HTMLElement; close: () => void; busy: () => boolean; previous: HTMLElement | null };
const stack: Modal[] = [];
const inert = new Map<HTMLElement, boolean>();
const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const top = () => stack.at(-1);
function controls(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(item => item.tabIndex >= 0
    && !item.closest("[inert]") && item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden");
}
function focus(modal: Modal) { (controls(modal.element)[0] ?? modal.element).focus(); }
function isolate() {
  for (const [element, value] of inert) element.inert = value;
  inert.clear();
  let child: HTMLElement | undefined = top()?.element;
  while (child && child !== document.body) {
    const parent: HTMLElement | null = child.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling !== child && sibling instanceof HTMLElement) {
        inert.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    child = parent;
  }
}
function keydown(event: KeyboardEvent) {
  const modal = top();
  if (!modal) return;
  if (event.key === "Escape") {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!modal.busy()) modal.close();
  } else if (event.key === "Tab") {
    const items = controls(modal.element);
    const first = items[0] ?? modal.element, last = items.at(-1) ?? modal.element;
    if (!items.length || !modal.element.contains(document.activeElement)
      || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }
}
function contain(event: FocusEvent) {
  const modal = top();
  if (modal && !modal.element.contains(event.target as Node)) focus(modal);
}

export function useModalFocus(ref: RefObject<HTMLElement>, open: boolean, onClose: () => void, busy = false) {
  const current = useRef({ onClose, busy });
  current.current = { onClose, busy };
  useLayoutEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const modal: Modal = { element, close: () => current.current.onClose(), busy: () => current.current.busy,
      previous: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    if (!stack.length) {
      document.addEventListener("keydown", keydown, true);
      document.addEventListener("focusin", contain, true);
    }
    stack.push(modal); isolate(); focus(modal);
    return () => {
      const wasTop = top() === modal;
      stack.splice(stack.indexOf(modal), 1); isolate();
      if (!stack.length) {
        document.removeEventListener("keydown", keydown, true);
        document.removeEventListener("focusin", contain, true);
      }
      if (wasTop) {
        const parent = top();
        if (modal.previous?.isConnected && !modal.previous.closest("[inert]")
          && (!parent || parent.element.contains(modal.previous))) modal.previous.focus();
        else if (parent) focus(parent);
      }
    };
  }, [ref, open]);
}
