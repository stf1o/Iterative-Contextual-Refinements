import React from 'react';
import { isSidebarCollapsed, getExpandButton, getCollapseButton } from './Sidebar';
import { Icon } from './Icons';

export const SidebarExpandButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const isCollapsed = isSidebarCollapsed();
    return (
        <button 
            id="sidebar-expand-button" 
            className="sidebar-expand-button"
            style={{ display: isCollapsed ? 'flex' : 'none' }}
            onClick={onClick}
        >
            <Icon name="chevron_right" />
        </button>
    );
};

export const SidebarCollapseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button 
            id="sidebar-collapse-button" 
            className="sidebar-collapse-button"
            onClick={onClick}
        >
            <Icon name="chevron_left" />
        </button>
    );
};

export const useSidebarState = () => {
    return {
        isCollapsed: isSidebarCollapsed(),
        hasExpandButton: !!getExpandButton(),
        hasCollapseButton: !!getCollapseButton()
    };
};
