import React, { useEffect, useRef } from 'react';
import { App } from '../Core/App';

export const AppInitializer: React.FC = () => {
    const initialized = useRef(false);

    useEffect(() => {
        if (!initialized.current) {
            // Initialize the App logic once the component has mounted
            App.init();
            initialized.current = true;
        }
    }, []);

    return null;
};
