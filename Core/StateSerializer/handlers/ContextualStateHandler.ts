/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ContextualStateHandler - State management handler for Contextual mode
 */

import type { ModeStateHandler } from '../ModeStateHandler';
import {
    getContextualState,
    setContextualStateForImport,
    renderContextualMode,
} from '../../../Contextual/Contextual';
import type { ContextualState } from '../../../Contextual/ContextualCore';

export const contextualStateHandler: ModeStateHandler<ContextualState> = {
    modeName: 'contextual',

    getFullState(): ContextualState | null {
        return getContextualState();
    },

    restoreState(state: ContextualState | null): void {
        setContextualStateForImport(state);
    },

    renderAfterImport(): void {
        renderContextualMode();
    },
};
