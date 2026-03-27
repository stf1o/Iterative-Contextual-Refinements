/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolDefinition } from '@langchain/core/language_models/base';
import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { Annotation, END, START, StateGraph, messagesStateReducer } from '@langchain/langgraph/web';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { callAI } from '../Routing/AIService';
import type { StructuredMessage as AIServiceStructuredMessage } from '../Routing/AIService';
import {
    createToolCallingAgentModel,
    invokeGeminiToolAgentTurn,
    messageContentToText,
    resolveProviderForModel
} from '../Core/LangGraphToolRuntime';
import { searchArxiv, formatPaperForDisplay } from './ArxivAPI';
import { applyDiffCommand, formatDiffCommand } from './AgenticEdits';
import { VERIFIER_SYSTEM_PROMPT } from './AgenticModePrompt';
import type { ContentHistoryEntry, DiffCommand, ToolCall as AgenticToolCall } from './AgenticTypes';

export { messageContentToText };

const readCurrentContentSchema = z.object({
    startLine: z.number().int().positive().optional().describe('Optional 1-indexed start line.'),
    endLine: z.number().int().positive().optional().describe('Optional 1-indexed end line. Must be greater than or equal to startLine.')
}).refine(
    ({ startLine, endLine }) =>
        (startLine == null && endLine == null) ||
        (startLine != null && endLine != null && endLine >= startLine),
    {
        message: 'Provide both startLine and endLine, and ensure endLine is greater than or equal to startLine.'
    }
);

const multiEditOperationSchema = z.object({
    action: z.enum(['search_and_replace', 'delete', 'insert_before', 'insert_after']).describe(
        'Edit action. search_and_replace replaces target with content. delete removes target. insert_before inserts content before target. insert_after inserts content after target.'
    ),
    target: z.string().min(1).describe(
        'Exact existing text to match. For search_and_replace and delete, this is the text to find. For insert_before and insert_after, this is the marker text.'
    ),
    content: z.string().optional().describe(
        'Replacement or inserted text. Required for search_and_replace, insert_before, and insert_after. Omit for delete.'
    )
});

const multiEditSchema = z.object({
    operations: z.array(multiEditOperationSchema).min(1).max(20).describe('Sequential edits to apply in order.')
});

const searchAcademiaSchema = z.object({
    query: z.string().trim().min(1)
});

const searchAcademiaAndSchema = z.object({
    terms: z.array(z.string().trim().min(1)).min(1).max(8)
});

const toolNoteSchema = z.object({
    note: z.string().trim().max(200).optional().describe('Optional short note about why the tool is being called.')
});

const readCurrentContentParameters = {
    type: 'object',
    properties: {
        startLine: {
            type: 'integer',
            description: 'Optional 1-indexed start line.'
        },
        endLine: {
            type: 'integer',
            description: 'Optional 1-indexed end line. Must be greater than or equal to startLine.'
        }
    },
    additionalProperties: false
} as const;

const multiEditParameters = {
    type: 'object',
    properties: {
        operations: {
            type: 'array',
            description: 'Sequential edits to apply in order.',
            items: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['search_and_replace', 'delete', 'insert_before', 'insert_after'],
                        description: 'Edit action to apply.'
                    },
                    target: {
                        type: 'string',
                        description: 'Exact existing text to match.'
                    },
                    content: {
                        type: 'string',
                        description: 'Replacement or inserted text. Omit for delete.'
                    }
                },
                required: ['action', 'target'],
                additionalProperties: false
            },
            minItems: 1,
            maxItems: 20
        }
    },
    required: ['operations'],
    additionalProperties: false
} as const;

const searchAcademiaParameters = {
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'arXiv search query.'
        }
    },
    required: ['query'],
    additionalProperties: false
} as const;

const searchAcademiaAndParameters = {
    type: 'object',
    properties: {
        terms: {
            type: 'array',
            description: 'Terms that must all be present in the matched papers.',
            items: {
                type: 'string'
            },
            minItems: 1,
            maxItems: 8
        }
    },
    required: ['terms'],
    additionalProperties: false
} as const;

const toolNoteParameters = {
    type: 'object',
    properties: {
        note: {
            type: 'string',
            description: 'Optional short note about why the tool is being called.'
        }
    },
    additionalProperties: false
} as const;

function defineTool(name: string, description: string, parameters: ToolDefinition['function']['parameters']): ToolDefinition {
    return {
        type: 'function',
        function: {
            name,
            description,
            parameters
        }
    };
}

const agenticToolDefinitions: ToolDefinition[] = [
    defineTool(
        'read_current_content',
        'Read the current draft. Omit line numbers to read the full draft, or provide startLine and endLine for a 1-indexed line range.',
        readCurrentContentParameters
    ),
    defineTool(
        'multi_edit',
        'Apply multiple textual edits to the current draft. Operations execute sequentially, so later operations see earlier changes.',
        multiEditParameters
    ),
    defineTool(
        'searchacademia',
        'Search arXiv with a single query string.',
        searchAcademiaParameters
    ),
    defineTool(
        'searchacademia_and',
        'Search arXiv for papers that contain all provided terms.',
        searchAcademiaAndParameters
    ),
    defineTool(
        'verify_current_content',
        'Run an independent verification pass against the current draft. If you edit after verification, verify again before Exit.',
        toolNoteParameters
    ),
    defineTool(
        'Exit',
        'Finish the refinement process. Only call this when the current draft has already been verified and no further edits are needed.',
        toolNoteParameters
    )
];

export const AgenticGraphAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => []
    }),
    currentContent: Annotation<string>({
        reducer: (_, value) => value,
        default: () => ''
    }),
    contentHistory: Annotation<ContentHistoryEntry[]>({
        reducer: (_, value) => value,
        default: () => []
    }),
    verifierReports: Annotation<string[]>({
        reducer: (_, value) => value,
        default: () => []
    }),
    verificationCount: Annotation<number>({
        reducer: (_, value) => value,
        default: () => 0
    }),
    lastVerifiedContent: Annotation<string | null>({
        reducer: (_, value) => value,
        default: () => null
    }),
    shouldExit: Annotation<boolean>({
        reducer: (_, value) => value,
        default: () => false
    })
});

export type AgenticGraphState = typeof AgenticGraphAnnotation.State;
export interface ToolResultArtifact {
    tool: string;
    toolCall?: AgenticToolCall;
}

interface AgenticGraphOptions {
    modelName: string;
    temperature: number;
    topP?: number;
    systemPrompt: string;
    verifierPrompt?: string;
}

interface ToolExecutionResult {
    content: string;
    status?: 'success' | 'error';
    artifact: ToolResultArtifact;
    statePatch?: Partial<Omit<AgenticGraphState, 'messages'>>;
}

type SearchToolName = 'searchacademia' | 'searchacademia_and';

function createToolArtifact(tool: string, toolCall?: AgenticToolCall): ToolResultArtifact {
    return toolCall ? { tool, toolCall } : { tool };
}

function createToolResult(
    content: string,
    artifact: ToolResultArtifact,
    status: 'success' | 'error' = 'success',
    statePatch?: Partial<Omit<AgenticGraphState, 'messages'>>
): ToolExecutionResult {
    return {
        content,
        status,
        artifact,
        ...(statePatch ? { statePatch } : {})
    };
}


function hasValidToolNote(payload: unknown): boolean {
    return toolNoteSchema.safeParse(payload ?? {}).success;
}

function parseToolNote(payload: unknown) {
    toolNoteSchema.parse(payload ?? {});
}

function toDiffCommand(operation: z.infer<typeof multiEditOperationSchema>): DiffCommand {
    switch (operation.action) {
        case 'search_and_replace':
            if (operation.content == null) {
                throw new Error('multi_edit action "search_and_replace" requires "content".');
            }
            return {
                type: 'search_and_replace',
                params: [operation.target, operation.content]
            };
        case 'delete':
            return {
                type: 'delete',
                params: [operation.target]
            };
        case 'insert_before':
            if (operation.content == null) {
                throw new Error('multi_edit action "insert_before" requires "content".');
            }
            return {
                type: 'insert_before',
                params: [operation.target, operation.content]
            };
        case 'insert_after':
            if (operation.content == null) {
                throw new Error('multi_edit action "insert_after" requires "content".');
            }
            return {
                type: 'insert_after',
                params: [operation.target, operation.content]
            };
    }
}

function parseMultiEditOperations(
    operations: z.infer<typeof multiEditSchema>['operations']
): { success: true; operations: DiffCommand[] } | { success: false; error: string } {
    try {
        return {
            success: true,
            operations: operations.map(toDiffCommand)
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Invalid multi_edit operation.'
        };
    }
}

export function normalizeToolCall(name: string, args: unknown): AgenticToolCall | null {
    const payload = args ?? {};

    switch (name) {
        case 'read_current_content': {
            const parsed = readCurrentContentSchema.safeParse(payload);
            if (!parsed.success) {
                return { type: 'read_current_content' };
            }

            const { startLine, endLine } = parsed.data;
            if (startLine != null && endLine != null) {
                return { type: 'read_current_content', params: [startLine, endLine] };
            }

            return { type: 'read_current_content' };
        }

        case 'verify_current_content': {
            if (!hasValidToolNote(payload)) {
                return null;
            }

            return { type: 'verify_current_content' };
        }

        case 'searchacademia': {
            const parsed = searchAcademiaSchema.safeParse(payload);
            if (!parsed.success) {
                return null;
            }

            return { type: 'searchacademia', query: parsed.data.query };
        }

        case 'searchacademia_and': {
            const parsed = searchAcademiaAndSchema.safeParse(payload);
            if (!parsed.success) {
                return null;
            }

            return { type: 'searchacademia_and', terms: parsed.data.terms };
        }

        case 'multi_edit': {
            const parsed = multiEditSchema.safeParse(payload);
            if (!parsed.success) {
                return null;
            }

            const operations = parseMultiEditOperations(parsed.data.operations);
            if (!operations.success) {
                return null;
            }

            return {
                type: 'multi_edit',
                operations: operations.operations
            };
        }

        case 'Exit': {
            if (!hasValidToolNote(payload)) {
                return null;
            }

            return { type: 'Exit' };
        }

        default:
            return null;
    }
}

function buildAgentSystemPrompt(state: AgenticGraphState, systemPrompt: string): string {
    const verificationStatus = state.lastVerifiedContent === state.currentContent
        ? 'The current draft is verified. Call Exit only if no further edits are needed.'
        : 'The current draft is not yet verified for its latest state. Use verify_current_content before Exit.';

    return [
        systemPrompt,
        'All assistant text is shown directly in the UI. Keep it concise, professional, and free of tool syntax.',
        'Before every tool call, include a brief visible reasoning summary in plain text so the UI shows your current plan.',
        'That visible reasoning should state what you are about to do and why it is the right next move.',
        'Use at most one tool per turn unless you are batching edits inside multi_edit.',
        'The latest working draft is not automatically re-sent after edits. Use read_current_content when you need fresh context.',
        verificationStatus
    ].join('\n');
}

function createVerifierMessages(state: AgenticGraphState): AIServiceStructuredMessage[] {
    const history = state.verifierReports.length > 0
        ? `<conversation_history>\n${state.verifierReports.map((report, index) => `[Verification Turn ${index + 1}]\n${report}`).join('\n\n')}\n</conversation_history>\n\n`
        : '';

    return [{
        role: 'user',
        content: `${history}<current_content>\n${state.currentContent}\n</current_content>`
    }];
}

async function executeReadCurrentContent(
    state: AgenticGraphState,
    args: z.infer<typeof readCurrentContentSchema>
): Promise<ToolExecutionResult> {
    const { startLine, endLine } = args;
    const toolCall: AgenticToolCall = startLine != null && endLine != null
        ? { type: 'read_current_content', params: [startLine, endLine] }
        : { type: 'read_current_content' };

    if (startLine == null || endLine == null) {
        return {
            content: state.currentContent,
            status: 'success',
            artifact: {
                tool: 'read_current_content',
                toolCall
            }
        };
    }

    const lines = state.currentContent.split('\n');
    return {
        content: lines.slice(startLine - 1, endLine).join('\n'),
        status: 'success',
        artifact: {
            tool: 'read_current_content',
            toolCall
        }
    };
}

async function executeMultiEdit(
    state: AgenticGraphState,
    operations: DiffCommand[]
): Promise<ToolExecutionResult> {
    let currentContent = state.currentContent;
    let okCount = 0;
    let failCount = 0;
    const logs: string[] = [];

    for (const operation of operations) {
        const result = applyDiffCommand(currentContent, operation);
        currentContent = result.result;

        if (result.success) {
            okCount++;
            logs.push(`OK ${formatDiffCommand(operation)}`);
            continue;
        }

        failCount++;
        logs.push(`FAIL ${operation.type}: ${result.error ?? 'Unknown edit failure'}`);
    }

    const contentChanged = currentContent !== state.currentContent;
    const contentHistory = contentChanged
        ? [
            ...state.contentHistory,
            {
                content: currentContent,
                title: `After ${okCount} successful edit${okCount === 1 ? '' : 's'}`,
                timestamp: Date.now()
            }
        ]
        : state.contentHistory;

    const summary = `Multi-edit finished: ${okCount} OK, ${failCount} FAIL`;

    return {
        content: [summary, ...logs].join('\n'),
        status: 'success',
        artifact: createToolArtifact('multi_edit', {
            type: 'multi_edit',
            operations
        }),
        statePatch: {
            currentContent,
            contentHistory,
            lastVerifiedContent: contentChanged ? null : state.lastVerifiedContent
        }
    };
}

async function executeSearchAcademia(
    args: z.infer<typeof searchAcademiaSchema>
): Promise<ToolExecutionResult> {
    return executeAcademicSearch(
        'searchacademia',
        {
            searchType: 'simple',
            query: args.query
        },
        {
            type: 'searchacademia',
            query: args.query
        },
        `No papers found for query: "${args.query}"`,
        count => `Found ${count} papers for query: "${args.query}"`
    );
}

async function executeSearchAcademiaAnd(
    args: z.infer<typeof searchAcademiaAndSchema>
): Promise<ToolExecutionResult> {
    return executeAcademicSearch(
        'searchacademia_and',
        {
            searchType: 'and_terms',
            terms: args.terms
        },
        {
            type: 'searchacademia_and',
            terms: args.terms
        },
        `No papers found matching all terms: ${args.terms.join(', ')}`,
        count => `Found ${count} papers matching all terms: ${args.terms.join(', ')}`
    );
}

function formatPaperSearchResults(heading: string, papers: Awaited<ReturnType<typeof searchArxiv>>): string {
    const output = [`${heading}\n`];
    papers.forEach((paper, index) => {
        output.push(`[Paper ${index + 1}]`);
        output.push(formatPaperForDisplay(paper));
        output.push('='.repeat(80));
    });

    return output.join('\n');
}

async function executeAcademicSearch(
    tool: SearchToolName,
    request: Parameters<typeof searchArxiv>[0],
    toolCall: Extract<AgenticToolCall, { type: SearchToolName }>,
    emptyMessage: string,
    successHeading: (count: number) => string
): Promise<ToolExecutionResult> {
    const papers = await searchArxiv({
        ...request,
        maxResults: 10
    });

    if (papers.length === 0) {
        return createToolResult(emptyMessage, createToolArtifact(tool, toolCall));
    }

    return createToolResult(
        formatPaperSearchResults(successHeading(papers.length), papers),
        createToolArtifact(tool, toolCall)
    );
}

async function executeVerifyCurrentContent(
    state: AgenticGraphState,
    modelName: string,
    verifierPrompt?: string
): Promise<ToolExecutionResult> {
    const verifierResponse = await callAI(
        createVerifierMessages(state),
        0.2,
        modelName,
        verifierPrompt || VERIFIER_SYSTEM_PROMPT,
        false,
        0.95
    );
    const report = typeof verifierResponse.text === 'string'
        ? verifierResponse.text.trim()
        : messageContentToText(verifierResponse.candidates?.[0]?.content?.parts ?? []);

    if (!report.trim()) {
        return createToolResult(
            '[VERIFIER_ERROR: Verifier returned an empty response]',
            createToolArtifact('verify_current_content', { type: 'verify_current_content' }),
            'error'
        );
    }

    return createToolResult(
        report,
        createToolArtifact('verify_current_content', { type: 'verify_current_content' }),
        'success',
        {
            verifierReports: [...state.verifierReports, report],
            verificationCount: state.verificationCount + 1,
            lastVerifiedContent: state.currentContent
        }
    );
}

async function executeExit(state: AgenticGraphState): Promise<ToolExecutionResult> {
    if (state.lastVerifiedContent !== state.currentContent) {
        return createToolResult(
            'Exit rejected: verify the latest draft before finishing.',
            createToolArtifact('Exit', { type: 'Exit' }),
            'error'
        );
    }

    return createToolResult(
        'Agent has completed the refinement process.',
        createToolArtifact('Exit', { type: 'Exit' }),
        'success',
        {
            shouldExit: true
        }
    );
}

async function executeToolCall(
    state: AgenticGraphState,
    name: string,
    rawArgs: unknown,
    options: AgenticGraphOptions
): Promise<ToolExecutionResult> {
    switch (name) {
        case 'read_current_content': {
            const args = readCurrentContentSchema.parse(rawArgs ?? {});
            return executeReadCurrentContent(state, args);
        }

        case 'multi_edit': {
            const args = multiEditSchema.parse(rawArgs ?? {});
            const parsedOperations = parseMultiEditOperations(args.operations);
            if (!parsedOperations.success) {
                throw new Error(parsedOperations.error);
            }

            return executeMultiEdit(state, parsedOperations.operations);
        }

        case 'searchacademia': {
            const args = searchAcademiaSchema.parse(rawArgs ?? {});
            return executeSearchAcademia(args);
        }

        case 'searchacademia_and': {
            const args = searchAcademiaAndSchema.parse(rawArgs ?? {});
            return executeSearchAcademiaAnd(args);
        }

        case 'verify_current_content': {
            parseToolNote(rawArgs);
            return executeVerifyCurrentContent(state, options.modelName, options.verifierPrompt);
        }

        case 'Exit': {
            parseToolNote(rawArgs);
            return executeExit(state);
        }

        default:
            return createToolResult(
                `[TOOL_ERROR: Unknown tool type: ${name}]`,
                createToolArtifact(name),
                'error'
            );
    }
}

function getLastAiMessage(state: AgenticGraphState): AIMessage | null {
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage instanceof AIMessage ? lastMessage : null;
}

async function executeToolsNode(
    state: AgenticGraphState,
    options: AgenticGraphOptions
): Promise<Partial<AgenticGraphState>> {
    const lastMessage = getLastAiMessage(state);
    if (!lastMessage?.tool_calls?.length) {
        return {};
    }

    let workingState: AgenticGraphState = {
        ...state,
        contentHistory: [...state.contentHistory],
        verifierReports: [...state.verifierReports]
    };
    const toolMessages: ToolMessage[] = [];

    for (const toolInvocation of lastMessage.tool_calls) {
        let result: ToolExecutionResult;

        try {
            result = await executeToolCall(
                workingState,
                toolInvocation.name,
                toolInvocation.args,
                options
            );
        } catch (error) {
            result = createToolResult(
                `[TOOL_ERROR: ${error instanceof Error ? error.message : 'Unknown tool error'}]`,
                createToolArtifact(
                    toolInvocation.name,
                    normalizeToolCall(toolInvocation.name, toolInvocation.args) ?? undefined
                ),
                'error'
            );
        }

        workingState = {
            ...workingState,
            ...result.statePatch
        };

        toolMessages.push(new ToolMessage({
            name: toolInvocation.name,
            content: result.content,
            tool_call_id: toolInvocation.id ?? nanoid(8),
            status: result.status,
            artifact: result.artifact
        }));
    }

    return {
        messages: toolMessages,
        currentContent: workingState.currentContent,
        contentHistory: workingState.contentHistory,
        verifierReports: workingState.verifierReports,
        verificationCount: workingState.verificationCount,
        lastVerifiedContent: workingState.lastVerifiedContent,
        shouldExit: workingState.shouldExit
    };
}

function shouldRunTools(state: AgenticGraphState) {
    const lastMessage = getLastAiMessage(state);
    return lastMessage?.tool_calls?.length ? 'tools' : END;
}

function afterTools(state: AgenticGraphState) {
    return state.shouldExit ? END : 'agent';
}

export function createAgenticGraph(options: AgenticGraphOptions) {
    const { providerName, providerConfig } = resolveProviderForModel(options.modelName);
    if (!providerConfig?.isConfigured || !providerConfig.apiKey) {
        throw new Error(`No configured provider found for model: ${options.modelName}`);
    }
    const model = providerName === 'gemini'
        ? null
        : createToolCallingAgentModel(providerName, providerConfig, options).bindTools(agenticToolDefinitions);

    const agentNode = async (state: AgenticGraphState) => {
        const response = providerName === 'gemini'
            ? await invokeGeminiToolAgentTurn(
                providerConfig,
                state.messages,
                buildAgentSystemPrompt(state, options.systemPrompt),
                agenticToolDefinitions,
                options
            )
            : await model!.invoke([
                new SystemMessage(buildAgentSystemPrompt(state, options.systemPrompt)),
                ...state.messages
            ]);
        return { messages: [response] };
    };

    return new StateGraph(AgenticGraphAnnotation)
        .addNode('agent', agentNode)
        .addNode('tools', (state: AgenticGraphState) => executeToolsNode(state, options))
        .addEdge(START, 'agent')
        .addConditionalEdges('agent', shouldRunTools)
        .addConditionalEdges('tools', afterTools)
        .compile();
}
