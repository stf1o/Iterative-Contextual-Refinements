/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parsing module - Centralized data processing and parsing utilities
 */

// JSON parsing utilities
export { parseJsonSafe, cleanJsonOutput } from './JsonParser';

// Output cleaning utilities
export {
    cleanHtmlOutput,
    cleanTextOutput,
    cleanOutputByType,
    isHtmlContent
} from './OutputCleaner';

// Suggestion parsing utilities (for Deepthink strategies)
export {
    parseJsonSuggestions,
    generateFallbackFeaturesFromString,
    generateFallbackCritiqueFromString,
    generateFallbackStrategies
} from './SuggestionParser';
