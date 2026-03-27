/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AgenticStateHandler - State management handler for Agentic mode
 */

import type { ModeStateHandler } from '../ModeStateHandler';
import type { AgenticState } from '../../../Agentic/AgenticCore';
import { ensureAgenticInitialized, getLoadedAgenticModule } from '../../ModeLoader';

let pendingState: AgenticState | null = null;

export const agenticStateHandler: ModeStateHandler<AgenticState> = {
    modeName: 'agentic',

    getFullState(): AgenticState | null {
        const mod = getLoadedAgenticModule();
        return mod ? mod.getActiveAgenticState() : null;
    },

    restoreState(state: AgenticState | null): void {
        pendingState = state;
    },

    renderAfterImport(): void {
        void ensureAgenticInitialized().then((mod) => {
            if (pendingState) {
                mod.setActiveAgenticStateForImport(pendingState);
                pendingState = null;
            }
            mod.renderAgenticMode();
        });
    },
};
