/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiffCommand } from './AgenticTypes';

function previewText(value: string): string {
    return value.length > 100 ? `${value.slice(0, 100)}...` : value;
}

export function formatDiffCommand(command: DiffCommand): string {
    return `${command.type}(${command.params.map(param => JSON.stringify(param)).join(', ')})`;
}

export function applyDiffCommand(content: string, command: DiffCommand): {
    success: boolean;
    result: string;
    error?: string;
} {
    try {
        switch (command.type) {
            case 'search_and_replace': {
                if (command.params.length !== 2) {
                    return { success: false, result: content, error: 'search_and_replace requires exactly 2 parameters' };
                }

                const [find, replace] = command.params;
                if (!content.includes(find)) {
                    return {
                        success: false,
                        result: content,
                        error: `String not found: "${previewText(find)}"`
                    };
                }

                return { success: true, result: content.replace(find, replace) };
            }

            case 'delete': {
                if (command.params.length !== 1) {
                    return { success: false, result: content, error: 'delete requires exactly 1 parameter' };
                }

                const [toDelete] = command.params;
                if (!content.includes(toDelete)) {
                    return {
                        success: false,
                        result: content,
                        error: `String not found: "${previewText(toDelete)}"`
                    };
                }

                return { success: true, result: content.replace(toDelete, '') };
            }

            case 'insert_before': {
                if (command.params.length !== 2) {
                    return { success: false, result: content, error: 'insert_before requires exactly 2 parameters' };
                }

                const [marker, text] = command.params;
                const matchIndex = content.indexOf(marker);
                if (matchIndex === -1) {
                    return {
                        success: false,
                        result: content,
                        error: `Marker not found: "${previewText(marker)}"`
                    };
                }

                return {
                    success: true,
                    result: content.slice(0, matchIndex) + text + content.slice(matchIndex)
                };
            }

            case 'insert_after': {
                if (command.params.length !== 2) {
                    return { success: false, result: content, error: 'insert_after requires exactly 2 parameters' };
                }

                const [marker, text] = command.params;
                const matchIndex = content.indexOf(marker);
                if (matchIndex === -1) {
                    return {
                        success: false,
                        result: content,
                        error: `Marker not found: "${previewText(marker)}"`
                    };
                }

                return {
                    success: true,
                    result: content.slice(0, matchIndex + marker.length) + text + content.slice(matchIndex + marker.length)
                };
            }

            default:
                return {
                    success: false,
                    result: content,
                    error: `Unknown command type: ${(command as { type: string }).type}`
                };
        }
    } catch (error) {
        return {
            success: false,
            result: content,
            error: error instanceof Error ? error.message : 'Unknown edit error'
        };
    }
}
