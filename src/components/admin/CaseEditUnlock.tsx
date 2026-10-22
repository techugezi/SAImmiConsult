"use client";

import * as React from "react";

type Props = {
  caseId: string;
  isActivated: boolean;
  children: (ctx: { isLocked: boolean; lock: () => void; unlock: () => void }) => React.ReactNode;
};

export default function CaseEditUnlock({ caseId, isActivated, children }: Props) {
  const storageKey = `admin_case_unlock:${caseId}`;

  const [isLocked, setIsLocked] = React.useState(true);

  React.useEffect(() => {
    if (!isActivated) {
      setIsLocked(false);
      return;
    }

    const v = sessionStorage.getItem(storageKey);
    setIsLocked(v !== "1"); // unlocked only when "1"
  }, [isActivated, storageKey]);

  const unlock = React.useCallback(() => {
    sessionStorage.setItem(storageKey, "1");
    setIsLocked(false);
  }, [storageKey]);

  const lock = React.useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setIsLocked(true);
  }, [storageKey]);

  return <>{children({ isLocked, lock, unlock })}</>;
}
