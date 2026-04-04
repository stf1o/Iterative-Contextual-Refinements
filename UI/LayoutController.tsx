import React from 'react';
import { Icon } from './Icons';
import { 
    getSidebarCollapsed, 
    getExpandButton, 
    getCollapseButton,
    expandSidebar,
    collapseSidebar,
    getSavedTheme,
    isLightMode 
} from './LayoutController';

export const SidebarExpandButton: React.FC = () => {
    const isCollapsed = getSidebarCollapsed();
    return (
        <button 
            id="sidebar-expand-button" 
            className="sidebar-expand-button"
            style={{ display: isCollapsed ? 'flex' : 'none' }}
            onClick={expandSidebar}
        >
            <Icon name="chevron_right" />
        </button>
    );
};

export const SidebarCollapseButton: React.FC = () => {
    return (
        <button 
            id="sidebar-collapse-button" 
            className="sidebar-collapse-button"
        >
            <Icon name="chevron_left" />
        </button>
    );
};

export const ThemeToggleButton: React.FC = () => {
    const isLight = isLightMode();
    return (
        <button id="theme-toggle-button" className="theme-toggle-button" title="Toggle theme">
            <Icon name={isLight ? 'dark_mode' : 'light_mode'} />
        </button>
    );
};

export const FullscreenToggleButton: React.FC<{ previewContainerId: string }> = ({ previewContainerId }) => {
    return (
        <button 
            id={`fullscreen-btn-${previewContainerId.replace('preview-container-', '')}`}
            className="fullscreen-toggle-button"
            title="Toggle Fullscreen Preview"
        >
            <Icon name="fullscreen" className="icon-fullscreen" />
            <Icon name="fullscreen_exit" className="icon-exit-fullscreen" style={{ display: 'none' }} />
        </button>
    );
};

export const useSidebarState = () => {
    return {
        isCollapsed: getSidebarCollapsed(),
        hasExpandButton: !!getExpandButton(),
        hasCollapseButton: !!getCollapseButton()
    };
};

export const useThemeState = () => {
    return {
        savedTheme: getSavedTheme(),
        isLightMode: isLightMode()
    };
};
