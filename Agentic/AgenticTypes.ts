/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiffCommand {
    type: 'search_and_replace' | 'delete' | 'insert_before' | 'insert_after';
    params: string[];
}

export type ToolCall =
    | { type: 'read_current_content'; params?: number[] }
    | { type: 'verify_current_content' }
    | { type: 'searchacademia'; query: string }
    | { type: 'searchacademia_and'; terms: string[] }
    | { type: 'multi_edit'; operations: DiffCommand[] }
    | { type: 'Exit' };

export type ResponseSegment =
    | { kind: 'text'; text: string }
    | { kind: 'tool'; tool: ToolCall };

export type SystemBlock =
    | { kind: 'error'; message: string }
    | { kind: 'tool_result'; tool: string; result: string; toolCall?: ToolCall };

export interface AgenticMessage {
    id: string;
    role: 'agent' | 'system' | 'user';
    content: string;
    timestamp: number;
    status?: 'success' | 'error' | 'processing';
    segments?: ResponseSegment[];
    blocks?: SystemBlock[];
}

export interface ContentHistoryEntry {
    content: string;
    title: string;
    timestamp: number;
}

export interface AgenticState {
    id: string;
    originalContent: string;
    currentContent: string;
    messages: AgenticMessage[];
    isProcessing: boolean;
    isComplete: boolean;
    error?: string;
    contentHistory: ContentHistoryEntry[];
}
