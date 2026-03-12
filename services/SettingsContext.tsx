import React, { createContext, useContext, useState } from 'react';

export type AiProvider = 'openai' | 'gemini';

interface SettingsContextValue {
    autoRefresh: boolean;
    setAutoRefresh: (val: boolean) => void;
    aiProvider: AiProvider;
    setAiProvider: (val: AiProvider) => void;
    openaiApiKey: string;
    setOpenaiApiKey: (val: string) => void;
    openaiModel: string;
    setOpenaiModel: (val: string) => void;
    geminiApiKey: string;
    setGeminiApiKey: (val: string) => void;
    geminiModel: string;
    setGeminiModel: (val: string) => void;
}

const STORAGE_KEY = 'app-settings-preference';

const defaultSettings = {
    autoRefresh: false,
    aiProvider: 'openai' as AiProvider,
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
};

const SettingsContext = createContext<SettingsContextValue>({
    autoRefresh: defaultSettings.autoRefresh,
    setAutoRefresh: () => { },
    aiProvider: defaultSettings.aiProvider,
    setAiProvider: () => { },
    openaiApiKey: defaultSettings.openaiApiKey,
    setOpenaiApiKey: () => { },
    openaiModel: defaultSettings.openaiModel,
    setOpenaiModel: () => { },
    geminiApiKey: defaultSettings.geminiApiKey,
    setGeminiApiKey: () => { },
    geminiModel: defaultSettings.geminiModel,
    setGeminiModel: () => { },
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<typeof defaultSettings>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...defaultSettings,
                    ...parsed,
                };
            }
        } catch (e) {
            console.error('Failed to parse settings', e);
        }
        return defaultSettings;
    });

    const updateSettings = (patch: Partial<typeof defaultSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const setAutoRefresh = (val: boolean) => updateSettings({ autoRefresh: val });
    const setAiProvider = (val: AiProvider) => updateSettings({ aiProvider: val });
    const setOpenaiApiKey = (val: string) => updateSettings({ openaiApiKey: val });
    const setOpenaiModel = (val: string) => updateSettings({ openaiModel: val });
    const setGeminiApiKey = (val: string) => updateSettings({ geminiApiKey: val });
    const setGeminiModel = (val: string) => updateSettings({ geminiModel: val });

    return (
        <SettingsContext.Provider
            value={{
                autoRefresh: settings.autoRefresh,
                setAutoRefresh,
                aiProvider: settings.aiProvider,
                setAiProvider,
                openaiApiKey: settings.openaiApiKey,
                setOpenaiApiKey,
                openaiModel: settings.openaiModel,
                setOpenaiModel,
                geminiApiKey: settings.geminiApiKey,
                setGeminiApiKey,
                geminiModel: settings.geminiModel,
                setGeminiModel,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
