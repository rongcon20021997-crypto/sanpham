import React, { createContext, useContext, useEffect, useState } from "react";

interface SyncSettings {
  enableR2: boolean;
  enableDrive: boolean;
  setEnableR2: (val: boolean) => void;
  setEnableDrive: (val: boolean) => void;
  toggleR2: () => void;
  toggleDrive: () => void;
}

const STORAGE_KEY_R2 = "app_sync_enable_r2";
const STORAGE_KEY_DRIVE = "app_sync_enable_drive";

const SyncContext = createContext<SyncSettings>({
  enableR2: true,
  enableDrive: true,
  setEnableR2: () => {},
  setEnableDrive: () => {},
  toggleR2: () => {},
  toggleDrive: () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [enableR2, setEnableR2State] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_R2);
    return saved !== null ? saved === "true" : true;
  });

  const [enableDrive, setEnableDriveState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DRIVE);
    return saved !== null ? saved === "true" : true;
  });

  const setEnableR2 = (val: boolean) => {
    setEnableR2State(val);
    localStorage.setItem(STORAGE_KEY_R2, String(val));
  };

  const setEnableDrive = (val: boolean) => {
    setEnableDriveState(val);
    localStorage.setItem(STORAGE_KEY_DRIVE, String(val));
  };

  const toggleR2 = () => setEnableR2(!enableR2);
  const toggleDrive = () => setEnableDrive(!enableDrive);

  return (
    <SyncContext.Provider
      value={{
        enableR2,
        enableDrive,
        setEnableR2,
        setEnableDrive,
        toggleR2,
        toggleDrive,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}

// Function trợ giúp dành cho các module ngoài React (như helpers.ts) để đọc trạng thái tức thời
export function getSyncSettingsState(): { enableR2: boolean; enableDrive: boolean } {
  const r2 = localStorage.getItem(STORAGE_KEY_R2);
  const drive = localStorage.getItem(STORAGE_KEY_DRIVE);
  return {
    enableR2: r2 !== null ? r2 === "true" : true,
    enableDrive: drive !== null ? drive === "true" : true,
  };
}
