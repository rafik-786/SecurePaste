import { useMemo, useRef, type ReactNode } from 'react';
import { LEAVE_PROMPT, LeaveGuardContext, type LeaveGuard } from './leaveGuard';

export function LeaveGuardProvider({ children }: { readonly children: ReactNode }) {
  const holds = useRef(0);

  const guard = useMemo<LeaveGuard>(
    () => ({
      hold: () => {
        holds.current += 1;
        let released = false;
        return () => {
          if (!released) {
            released = true;
            holds.current -= 1;
          }
        };
      },
      confirmLeave: () => holds.current === 0 || window.confirm(LEAVE_PROMPT),
    }),
    [],
  );

  return <LeaveGuardContext value={guard}>{children}</LeaveGuardContext>;
}
