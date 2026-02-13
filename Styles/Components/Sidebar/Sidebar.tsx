import React, { useState, useEffect } from 'react';
import SidebarHeader from './SidebarHeader';
import AppModeSelector from './AppModeSelector';
import ModelParameters from './ModelParameters';
import SidebarFooter from './SidebarFooter';
import { FileUpload } from './FileUpload';

/**
 * Main Sidebar component
 * Orchestrates all sidebar sub-components
 */
export const Sidebar: React.FC = () => {
    // Track current mode for conditional rendering
    const [currentMode, setCurrentMode] = useState<string>('deepthink');

    useEffect(() => {
        // Listen for mode changes from the radio buttons
        const handleModeChange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.name === 'app-mode') {
                setCurrentMode(target.value);
            }
        };

        const modeSelector = document.getElementById('app-mode-selector');
        if (modeSelector) {
            modeSelector.addEventListener('change', handleModeChange);
        }

        return () => {
            if (modeSelector) {
                modeSelector.removeEventListener('change', handleModeChange);
            }
        };
    }, []);

    // Show file upload only in Deepthink modes
    const showFileUpload = currentMode === 'deepthink' || currentMode === 'adaptive-deepthink';

    return (
        <aside id="controls-sidebar" className="inspector-panel custom-scrollbar" aria-labelledby="controls-sidebar-heading">
            <SidebarHeader />

            <div className="sidebar-content">
                <div className="input-group">
                    <label htmlFor="initial-idea" id="initial-idea-label" className="input-label">
                        Core Challenge:
                    </label>
                    <textarea
                        id="initial-idea"
                        className="input-base"
                        placeholder='E.g., "Design a sustainable urban transportation system", "Analyze the impact of remote work on company culture"...'
                        rows={5}
                    />
                    {showFileUpload && <FileUpload />}
                </div>

                <AppModeSelector />

                <ModelParameters />

                <details className="sidebar-section" open>
                    <summary className="sidebar-section-header">Configuration</summary>
                    <div className="sidebar-section-content">
                        <div className="config-buttons-container" style={{ display: 'flex', gap: '1rem' }}>
                            <button id="export-config-button" className="button" type="button">
                                <span className="material-symbols-outlined">upload</span>
                                <span className="button-text">Export</span>
                            </button>
                            <input type="file" id="import-config-input" className="sr-only" accept=".json,.gz,.msgpack,.msgpack.gz" />
                            <label htmlFor="import-config-input" id="import-config-label" className="button" role="button" tabIndex={0}>
                                <span className="material-symbols-outlined">download</span>
                                <span className="button-text">Import</span>
                            </label>
                        </div>
                    </div>
                </details>
            </div>

            <SidebarFooter />
        </aside>
    );
};

export default Sidebar;

