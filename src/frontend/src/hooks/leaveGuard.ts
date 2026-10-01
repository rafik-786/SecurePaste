import { createContext, useContext, useEffect } from 'react';

export const LEAVE_PROMPT = 'This paste is destroyed and cannot be shown again. Leave this page?';

export interface LeaveGuard {
  readonly hold: () => () => void;
  readonly confirmLeave: () => boolean;
}

export const LeaveGuardContext = createContext<LeaveGuard | null>(null);

function useLeaveGuardContext(): LeaveGuard {
  const guard = useContext(LeaveGuardContext);
  if (!guard) {
    throw new Error('Leave guard hooks need a LeaveGuardProvider above them.');
  }
  return guard;
}

export function useConfirmLeave(): () => boolean {
  return useLeaveGuardContext().confirmLeave;
}

export function useLeaveGuard(active: boolean): void {
  const { hold } = useLeaveGuardContext();

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const release = hold();
    const askFirst = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', askFirst);
    return () => {
      release();
      window.removeEventListener('beforeunload', askFirst);
    };
  }, [active, hold]);
}
