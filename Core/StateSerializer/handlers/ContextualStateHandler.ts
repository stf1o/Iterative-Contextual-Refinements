/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ContextualStateHandler - State management handler for Contextual mode
 */

import type { ModeStateHandler } from '../ModeStateHandler';
import type { ContextualState } from '../../../Contextual/ContextualCore';
import { ensureContextualInitialized, getLoadedContextualModule } from '../../ModeLoader';

let pendingState: ContextualState | null = null;

export const contextualStateHandler: ModeStateHandler<ContextualState> = {
    modeName: 'contextual',

    getFullState(): ContextualState | null {
        const mod = getLoadedContextualModule();
        return mod ? mod.getContextualState() : null;
    },

    restoreState(state: ContextualState | null): void {
        pendingState = state;
    },

    renderAfterImport(): void {
        void ensureContextualInitialized().then((mod) => {
            if (pendingState) {
                mod.setContextualStateForImport(pendingState);
                pendingState = null;
            }
            mod.renderContextualMode();
        });
    },
};
