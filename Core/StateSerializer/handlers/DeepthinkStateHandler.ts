/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DeepthinkStateHandler - State management handler for Deepthink mode
 */

import type { ModeStateHandler } from '../ModeStateHandler';
import type { DeepthinkPipelineState } from '../../../Deepthink/DeepthinkCore';
import { activateTab } from '../../AppRouter';
import { ensureDeepthinkInitialized, getLoadedDeepthinkModule, getLoadedSolutionPoolModule } from '../../ModeLoader';

/**
 * Extended state that includes solution pool versions for evolution view.
 */
export interface DeepthinkExportState {
    pipeline: DeepthinkPipelineState | null;
    solutionPoolVersions: Array<{ content: string; title: string; timestamp: number }> | null;
    activeTabId: string;
}

let pendingState: DeepthinkExportState | null = null;

export const deepthinkStateHandler: ModeStateHandler<DeepthinkExportState> = {
    modeName: 'deepthink',

    getFullState(): DeepthinkExportState | null {
        const deepthink = getLoadedDeepthinkModule();
        if (!deepthink) return null;

        const pipeline = deepthink.getActiveDeepthinkPipeline();
        if (!pipeline) {
            return null;
        }

        const solutionPool = getLoadedSolutionPoolModule();
        return {
            pipeline,
            solutionPoolVersions: solutionPool ? solutionPool.getSolutionPoolVersionsForExport(pipeline.id) : null,
            activeTabId: pipeline.activeTabId || 'strategic-solver',
        };
    },

    restoreState(state: DeepthinkExportState | null): void {
        pendingState = state;
    },

    renderAfterImport(): void {
        void ensureDeepthinkInitialized().then((mod) => {
            const state = pendingState;
            pendingState = null;

            if (!state || !state.pipeline) {
                mod.setActiveDeepthinkPipelineForImport(null);
                return;
            }

            mod.setActiveDeepthinkPipelineForImport(state.pipeline);

            const solutionPool = getLoadedSolutionPoolModule();
            if (state.solutionPoolVersions && state.solutionPoolVersions.length > 0 && solutionPool) {
                solutionPool.restoreSolutionPoolVersions(state.pipeline.id, state.solutionPoolVersions);
            }

            mod.renderActiveDeepthinkPipeline();
            if (state.activeTabId) {
                activateTab(state.activeTabId);
            }
        });
    },
};
