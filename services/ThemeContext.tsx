import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
    mode: ThemeMode;         // 用户选择的模式
    theme: ResolvedTheme;    // 实际生效的主题
    setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'theme-preference';

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'system',
    theme: 'light',
    setMode: () => { },
});

/** 获取系统主题偏好 */
const getSystemTheme = (): ResolvedTheme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** 解析最终生效的主题 */
const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
    mode === 'system' ? getSystemTheme() : mode;

/** 应用主题到 DOM */
const applyTheme = (theme: ResolvedTheme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setModeState] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return (saved === 'light' || saved === 'dark') ? saved : 'system';
    });

    const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(
        (() => {
            const saved = localStorage.getItem(STORAGE_KEY);
            return (saved === 'light' || saved === 'dark') ? saved : 'system';
        })()
    ));

    const setMode = (newMode: ThemeMode) => {
        setModeState(newMode);
        localStorage.setItem(STORAGE_KEY, newMode);
        const resolved = resolveTheme(newMode);
        setTheme(resolved);
        applyTheme(resolved);
    };

    // 监听系统主题变化
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (mode === 'system') {
                const resolved = getSystemTheme();
                setTheme(resolved);
                applyTheme(resolved);
            }
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [mode]);

    // 初始应用
    useEffect(() => {
        applyTheme(theme);
    }, []);

    return (
        <ThemeContext.Provider value={{ mode, theme, setMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
