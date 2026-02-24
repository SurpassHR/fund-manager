import React, { createContext, useContext, useEffect, useState } from 'react';

interface SettingsContextValue {
    autoRefresh: boolean;
    setAutoRefresh: (val: boolean) => void;
}

const STORAGE_KEY = 'app-settings-preference';

const defaultSettings = {
    autoRefresh: false,
};

const SettingsContext = createContext<SettingsContextValue>({
    autoRefresh: defaultSettings.autoRefresh,
    setAutoRefresh: () => { },
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [autoRefresh, setAutoRefreshState] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.autoRefresh ?? defaultSettings.autoRefresh;
            }
        } catch (e) {
            console.error('Failed to parse settings', e);
        }
        return defaultSettings.autoRefresh;
    });

    const setAutoRefresh = (val: boolean) => {
        setAutoRefreshState(val);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ autoRefresh: val }));
    };

    return (
        <SettingsContext.Provider value={{ autoRefresh, setAutoRefresh }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
