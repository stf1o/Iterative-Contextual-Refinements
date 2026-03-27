/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AdaptiveDeepthinkStateHandler - State management handler for Adaptive Deepthink mode
 */

import type { ModeStateHandler } from '../ModeStateHandler';
import type { AdaptiveDeepthinkStoreState } from '../../../AdaptiveDeepthink/AdaptiveDeepthink';
import { ensureAdaptiveDeepthinkInitialized, getLoadedAdaptiveDeepthinkModule } from '../../ModeLoader';

let pendingState: AdaptiveDeepthinkStoreState | null = null;

export const adaptiveDeepthinkStateHandler: ModeStateHandler<AdaptiveDeepthinkStoreState | null> = {
    modeName: 'adaptive-deepthink',

    getFullState(): AdaptiveDeepthinkStoreState | null {
        const mod = getLoadedAdaptiveDeepthinkModule();
        return mod ? mod.getAdaptiveDeepthinkState() : null;
    },

    restoreState(state: AdaptiveDeepthinkStoreState | null): void {
        pendingState = state;
    },

    renderAfterImport(): void {
        void ensureAdaptiveDeepthinkInitialized().then((mod) => {
            if (pendingState) {
                mod.setAdaptiveDeepthinkStateForImport(pendingState);
                pendingState = null;
            }
            mod.renderAdaptiveDeepthinkMode();
        });
    },
};
