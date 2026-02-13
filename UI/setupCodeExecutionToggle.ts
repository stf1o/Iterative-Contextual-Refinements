/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalState } from '../Core/State';
import { getProviderForCurrentModel } from '../Routing';

/**
 * Set up event listener for the Gemini code execution toggle
 */
export function setupCodeExecutionToggle() {
    const toggle = document.getElementById('gemini-code-execution-toggle') as HTMLInputElement;
    if (!toggle) return;

    // Initialize toggle from global state
    toggle.checked = globalState.geminiCodeExecutionEnabled;

    // Listen for changes
    toggle.addEventListener('change', () => {
        globalState.geminiCodeExecutionEnabled = toggle.checked;
        console.log('[Code Execution] Toggle changed:', toggle.checked);
    });
}

/**
 * Update the visibility of contextual mode controls based on current mode and provider
 * @param currentMode - The current application mode
 */
export function updateCodeExecutionToggleVisibility(currentMode: string) {
    const container = document.getElementById('contextual-mode-controls');
    if (!container) {
        console.log('[Code Execution] Container not found: #contextual-mode-controls');
        return;
    }

    const isContextualMode = currentMode === 'contextual';
    const provider = getProviderForCurrentModel();
    const isGeminiProvider = provider === 'gemini';

    // Show only when in contextual mode AND using Gemini provider
    const shouldShow = isContextualMode && isGeminiProvider;
    container.style.display = shouldShow ? 'block' : 'none';

    console.log('[Code Execution] Visibility updated:', {
        currentMode,
        provider,
        isGeminiProvider,
        shouldShow
    });
}

/**
 * Initialize code execution toggle state from stored value
 */
export function initializeCodeExecutionToggle() {
    const toggle = document.getElementById('gemini-code-execution-toggle') as HTMLInputElement;
    if (!toggle) return;

    toggle.checked = globalState.geminiCodeExecutionEnabled;
}
