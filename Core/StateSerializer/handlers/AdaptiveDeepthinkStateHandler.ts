/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AdaptiveDeepthinkStateHandler - State management handler for Adaptive Deepthink mode
 */

import type { ModeStateHandler } from '../ModeStateHandler';
import {
    getAdaptiveDeepthinkState,
    setAdaptiveDeepthinkStateForImport,
    renderAdaptiveDeepthinkMode,
} from '../../../AdaptiveDeepthink/AdaptiveDeepthinkMode';

// The state type is the UIState wrapper
type AdaptiveDeepthinkUIState = ReturnType<typeof getAdaptiveDeepthinkState>;

export const adaptiveDeepthinkStateHandler: ModeStateHandler<AdaptiveDeepthinkUIState> = {
    modeName: 'adaptive-deepthink',

    getFullState(): AdaptiveDeepthinkUIState {
        return getAdaptiveDeepthinkState();
    },

    restoreState(state: AdaptiveDeepthinkUIState): void {
        setAdaptiveDeepthinkStateForImport(state);
    },

    renderAfterImport(): void {
        renderAdaptiveDeepthinkMode();
    },
};
