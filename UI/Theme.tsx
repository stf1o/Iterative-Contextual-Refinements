import React from 'react';
import { isLightMode, getSavedTheme, ThemeMode } from './Theme';
import { Icon } from './Icons';

export const ThemeToggleButton: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
    const isLight = isLightMode();
    return (
        <button 
            id="theme-toggle-button" 
            className="theme-toggle-button"
            onClick={onToggle}
            title="Toggle theme"
        >
            <Icon name={isLight ? 'dark_mode' : 'light_mode'} />
        </button>
    );
};

export const useThemeState = (): { savedTheme: ThemeMode; isLightMode: boolean } => {
    return {
        savedTheme: getSavedTheme(),
        isLightMode: isLightMode()
    };
};
