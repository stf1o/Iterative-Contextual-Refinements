import { IterationData, EvolutionMode } from '../Core/Types';
import { globalState } from '../Core/State';

export function getEvolutionModeDescription(mode: EvolutionMode): string {
    switch (mode) {
        case 'off':
            return 'Standard refinement. Each iteration builds directly on the previous one.';
        case 'novelty':
            return 'Explores different approaches. If an iteration is too similar to previous ones, it retries with higher temperature.';
        case 'quality':
            return "Ensures improvement. If an iteration doesn't improve the score, it retries with higher temperature.";
    }
}

export function setEvolutionMode(mode: EvolutionMode) {
    globalState.currentEvolutionMode = mode;
    window.dispatchEvent(new CustomEvent('refine:evolution-mode-changed', { detail: { mode } }));
}

export function updateEvolutionModeDescription(mode: EvolutionMode) {
    const el = document.getElementById('evolution-mode-description');
    if (el) el.textContent = getEvolutionModeDescription(mode);
}

export function getEmptyStateMessage(status: IterationData['status'] | string, contentType: string): string {
    switch (status) {
        case 'pending': return `${contentType} generation is pending.`;
        case 'processing':
        case 'retrying': return `Generating ${contentType}...`;
        case 'cancelled': return `${contentType} generation was cancelled by the user.`;
        case 'error': return `An error occurred while generating ${contentType}.`;
        default: return `No valid ${contentType} was generated.`;
    }
}
