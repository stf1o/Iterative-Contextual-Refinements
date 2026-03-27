/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolDefinition } from '@langchain/core/language_models/base';
import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { Annotation, END, START, StateGraph, messagesStateReducer } from '@langchain/langgraph/web';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    createToolCallingAgentModel,
    invokeGeminiToolAgentTurn,
    resolveProviderForModel
} from '../Core/LangGraphToolRuntime';
import {
    createAdaptiveDeepthinkState,
    executeAdaptiveDeepthinkTool,
    type AdaptiveDeepthinkState,
    type AdaptiveDeepthinkToolCall,
    type AdaptiveDeepthinkToolExecutionContext,
    type AdaptiveDeepthinkToolPrompts
} from './AdaptiveDeepthinkCore';

const positiveCountSchema = z.number().int().positive().max(12);
const optionalContextSchema = z.string().trim().min(1).max(4000).optional();
const nonEmptyIdsSchema = z.array(z.string().trim().min(1)).min(1).max(24);

const generateStrategiesSchema = z.object({
    numStrategies: positiveCountSchema.describe('Number of high-level strategies to generate.'),
    specialContext: optionalContextSchema.describe('Optional guidance that redirects or constrains the generated strategies.')
});

const generateHypothesesSchema = z.object({
    numHypotheses: positiveCountSchema.describe('Number of hypotheses to generate.'),
    specialContext: optionalContextSchema.describe('Optional guidance that focuses the hypothesis search.')
});

const testHypothesesSchema = z.object({
    hypothesisIds: nonEmptyIdsSchema.describe('Hypothesis IDs to test.'),
    specialContext: optionalContextSchema.describe('Optional testing guidance or requested edge cases.')
});

const executeStrategiesSchema = z.object({
    executions: z.array(z.object({
        strategyId: z.string().trim().min(1).describe('Strategy ID to execute.'),
        hypothesisIds: z.array(z.string().trim().min(1)).max(24).describe('Hypothesis IDs whose test results should be included for this execution.')
    })).min(1).max(16).describe('Strategy executions to run in parallel.'),
    specialContext: optionalContextSchema.describe('Optional instructions to guide the execution pass.')
});

const solutionCritiqueSchema = z.object({
    executionIds: nonEmptyIdsSchema.describe('Execution or corrected-solution IDs to critique.'),
    specialContext: optionalContextSchema.describe('Optional critique focus areas or requested rigor.')
});

const correctedSolutionsSchema = z.object({
    executionIds: nonEmptyIdsSchema.describe('Execution or corrected-solution IDs to improve.')
});

const selectBestSolutionSchema = z.object({
    solutionIds: nonEmptyIdsSchema.describe('Candidate solution IDs to compare and judge.')
});

const exitSchema = z.object({
    note: z.string().trim().max(200).optional().describe('Optional short note before exiting.')
});

const countParameters = (field: string, description: string) => ({
    type: 'object',
    properties: {
        [field]: {
            type: 'integer',
            description
        },
        specialContext: {
            type: 'string',
            description: 'Optional additional guidance for the agent.'
        }
    },
    required: [field],
    additionalProperties: false
} as const);

const generateStrategiesParameters = countParameters('numStrategies', 'Number of high-level strategies to generate.');
const generateHypothesesParameters = countParameters('numHypotheses', 'Number of hypotheses to generate.');

const testHypothesesParameters = {
    type: 'object',
    properties: {
        hypothesisIds: {
            type: 'array',
            description: 'Hypothesis IDs to test.',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 24
        },
        specialContext: {
            type: 'string',
            description: 'Optional additional testing guidance.'
        }
    },
    required: ['hypothesisIds'],
    additionalProperties: false
} as const;

const executeStrategiesParameters = {
    type: 'object',
    properties: {
        executions: {
            type: 'array',
            description: 'Strategy executions to run in parallel.',
            minItems: 1,
            maxItems: 16,
            items: {
                type: 'object',
                properties: {
                    strategyId: {
                        type: 'string',
                        description: 'Strategy ID to execute.'
                    },
                    hypothesisIds: {
                        type: 'array',
                        description: 'Hypothesis IDs whose test results should be provided.',
                        items: { type: 'string' },
                        maxItems: 24
                    }
                },
                required: ['strategyId', 'hypothesisIds'],
                additionalProperties: false
            }
        },
        specialContext: {
            type: 'string',
            description: 'Optional execution guidance.'
        }
    },
    required: ['executions'],
    additionalProperties: false
} as const;

const solutionCritiqueParameters = {
    type: 'object',
    properties: {
        executionIds: {
            type: 'array',
            description: 'Execution or corrected-solution IDs to critique.',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 24
        },
        specialContext: {
            type: 'string',
            description: 'Optional critique focus guidance.'
        }
    },
    required: ['executionIds'],
    additionalProperties: false
} as const;

const correctedSolutionsParameters = {
    type: 'object',
    properties: {
        executionIds: {
            type: 'array',
            description: 'Execution or corrected-solution IDs to improve.',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 24
        }
    },
    required: ['executionIds'],
    additionalProperties: false
} as const;

const selectBestSolutionParameters = {
    type: 'object',
    properties: {
        solutionIds: {
            type: 'array',
            description: 'Candidate solution IDs to compare and judge.',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 24
        }
    },
    required: ['solutionIds'],
    additionalProperties: false
} as const;

const exitParameters = {
    type: 'object',
    properties: {
        note: {
            type: 'string',
            description: 'Optional short note before exiting.'
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

const adaptiveDeepthinkToolDefinitions: ToolDefinition[] = [
    defineTool(
        'GenerateStrategies',
        'Generate high-level strategic interpretations of the challenge.',
        generateStrategiesParameters
    ),
    defineTool(
        'GenerateHypotheses',
        'Generate testable hypotheses that can inform later strategy execution.',
        generateHypothesesParameters
    ),
    defineTool(
        'TestHypotheses',
        'Test one or more hypotheses and return the evidence gathered for each.',
        testHypothesesParameters
    ),
    defineTool(
        'ExecuteStrategies',
        'Execute one or more strategies, optionally with selected hypothesis-testing results.',
        executeStrategiesParameters
    ),
    defineTool(
        'SolutionCritique',
        'Critique one or more executions or corrected solutions.',
        solutionCritiqueParameters
    ),
    defineTool(
        'CorrectedSolutions',
        'Produce improved solutions for previously critiqued executions or corrections.',
        correctedSolutionsParameters
    ),
    defineTool(
        'SelectBestSolution',
        'Compare candidate solutions and select the strongest final answer.',
        selectBestSolutionParameters
    ),
    defineTool(
        'Exit',
        'Finish the orchestration after a final solution has already been selected.',
        exitParameters
    )
];

export const AdaptiveDeepthinkGraphAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => []
    }),
    coreState: Annotation<AdaptiveDeepthinkState>({
        reducer: (_, value) => value,
        default: () => createAdaptiveDeepthinkState('')
    }),
    shouldExit: Annotation<boolean>({
        reducer: (_, value) => value,
        default: () => false
    })
});

export type AdaptiveDeepthinkGraphState = typeof AdaptiveDeepthinkGraphAnnotation.State;

export interface AdaptiveDeepthinkToolResultArtifact {
    tool: string;
    toolCall?: AdaptiveDeepthinkToolCall;
}

interface AdaptiveDeepthinkGraphOptions {
    modelName: string;
    temperature: number;
    topP?: number;
    systemPrompt: string;
    deepthinkPrompts: AdaptiveDeepthinkToolPrompts;
    createExecutionContext: (toolCall: AdaptiveDeepthinkToolCall) => AdaptiveDeepthinkToolExecutionContext;
    images?: Array<{ base64: string; mimeType: string }>;
}

interface ToolExecutionResult {
    content: string;
    status?: 'success' | 'error';
    artifact: AdaptiveDeepthinkToolResultArtifact;
    statePatch?: Partial<Omit<AdaptiveDeepthinkGraphState, 'messages'>>;
}

function createToolArtifact(tool: string, toolCall?: AdaptiveDeepthinkToolCall): AdaptiveDeepthinkToolResultArtifact {
    return toolCall ? { tool, toolCall } : { tool };
}

function createToolResult(
    content: string,
    artifact: AdaptiveDeepthinkToolResultArtifact,
    status: 'success' | 'error' = 'success',
    statePatch?: Partial<Omit<AdaptiveDeepthinkGraphState, 'messages'>>
): ToolExecutionResult {
    return {
        content,
        status,
        artifact,
        ...(statePatch ? { statePatch } : {})
    };
}

export function normalizeAdaptiveDeepthinkToolCall(name: string, args: unknown): AdaptiveDeepthinkToolCall | null {
    switch (name) {
        case 'GenerateStrategies': {
            const parsed = generateStrategiesSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'GenerateStrategies', ...parsed.data } : null;
        }

        case 'GenerateHypotheses': {
            const parsed = generateHypothesesSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'GenerateHypotheses', ...parsed.data } : null;
        }

        case 'TestHypotheses': {
            const parsed = testHypothesesSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'TestHypotheses', ...parsed.data } : null;
        }

        case 'ExecuteStrategies': {
            const parsed = executeStrategiesSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'ExecuteStrategies', ...parsed.data } : null;
        }

        case 'SolutionCritique': {
            const parsed = solutionCritiqueSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'SolutionCritique', ...parsed.data } : null;
        }

        case 'CorrectedSolutions': {
            const parsed = correctedSolutionsSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'CorrectedSolutions', ...parsed.data } : null;
        }

        case 'SelectBestSolution': {
            const parsed = selectBestSolutionSchema.safeParse(args ?? {});
            return parsed.success ? { type: 'SelectBestSolution', ...parsed.data } : null;
        }

        case 'Exit': {
            return exitSchema.safeParse(args ?? {}).success ? { type: 'Exit' } : null;
        }

        default:
            return null;
    }
}

function buildAdaptiveDeepthinkSystemPrompt(state: AdaptiveDeepthinkGraphState, systemPrompt: string): string {
    const inventory = [
        `${state.coreState.strategies.size} strategies`,
        `${state.coreState.hypotheses.size} hypotheses`,
        `${state.coreState.hypothesisTestings.size} hypothesis tests`,
        `${state.coreState.executions.size} executions`,
        `${state.coreState.critiques.size} critiques`,
        `${state.coreState.correctedSolutions.size} corrections`
    ].join(', ');

    return [
        systemPrompt,
        'All assistant text is shown directly in the UI. Keep it concise, professional, and free of fake tool syntax.',
        'Before every tool call, include a brief visible reasoning summary in plain text so the UI shows your current plan.',
        'That visible reasoning should summarize what you learned and why the next tool is the right move.',
        'Call tools through the provided function interface only.',
        'Use at most one tool per turn.',
        'Track IDs exactly as returned by tool results.',
        state.coreState.selectedSolution
            ? 'A final solution has already been selected. Briefly conclude and call Exit.'
            : 'No final solution has been selected yet. Continue until you can confidently call SelectBestSolution, then Exit.',
        `Current inventory: ${inventory}.`
    ].join('\n');
}

async function executeToolCall(
    state: AdaptiveDeepthinkGraphState,
    name: string,
    rawArgs: unknown,
    options: AdaptiveDeepthinkGraphOptions
): Promise<ToolExecutionResult> {
    if (name === 'Exit') {
        exitSchema.parse(rawArgs ?? {});

        if (!state.coreState.selectedSolution?.trim()) {
            return createToolResult(
                'Exit rejected: select a final solution before finishing.',
                createToolArtifact('Exit', { type: 'Exit' }),
                'error'
            );
        }

        return createToolResult(
            'Adaptive Deepthink orchestration completed.',
            createToolArtifact('Exit', { type: 'Exit' }),
            'success',
            {
                shouldExit: true,
                coreState: state.coreState
            }
        );
    }

    const toolCall = normalizeAdaptiveDeepthinkToolCall(name, rawArgs);
    if (!toolCall || toolCall.type === 'Exit') {
        return createToolResult(
            `[TOOL_ERROR: Invalid arguments for ${name}]`,
            createToolArtifact(name),
            'error'
        );
    }

    const content = await executeAdaptiveDeepthinkTool(
        toolCall,
        state.coreState,
        options.createExecutionContext(toolCall),
        options.deepthinkPrompts,
        options.images ?? []
    );

    return createToolResult(
        content,
        createToolArtifact(name, toolCall),
        content.includes('[ERROR:') ? 'error' : 'success',
        {
            coreState: state.coreState
        }
    );
}

function getLastAiMessage(state: AdaptiveDeepthinkGraphState): AIMessage | null {
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage instanceof AIMessage ? lastMessage : null;
}

async function executeToolsNode(
    state: AdaptiveDeepthinkGraphState,
    options: AdaptiveDeepthinkGraphOptions
): Promise<Partial<AdaptiveDeepthinkGraphState>> {
    const lastMessage = getLastAiMessage(state);
    if (!lastMessage?.tool_calls?.length) {
        return {};
    }

    let workingState: AdaptiveDeepthinkGraphState = {
        ...state
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
                    normalizeAdaptiveDeepthinkToolCall(toolInvocation.name, toolInvocation.args) ?? undefined
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
        coreState: workingState.coreState,
        shouldExit: workingState.shouldExit
    };
}

function shouldRunTools(state: AdaptiveDeepthinkGraphState) {
    const lastMessage = getLastAiMessage(state);
    return lastMessage?.tool_calls?.length ? 'tools' : END;
}

function afterTools(state: AdaptiveDeepthinkGraphState) {
    return state.shouldExit ? END : 'agent';
}

export function createAdaptiveDeepthinkGraph(options: AdaptiveDeepthinkGraphOptions) {
    const { providerName, providerConfig } = resolveProviderForModel(options.modelName);
    if (!providerConfig?.isConfigured || !providerConfig.apiKey) {
        throw new Error(`No configured provider found for model: ${options.modelName}`);
    }

    const model = providerName === 'gemini'
        ? null
        : createToolCallingAgentModel(providerName, providerConfig, options).bindTools(adaptiveDeepthinkToolDefinitions);

    const agentNode = async (state: AdaptiveDeepthinkGraphState) => {
        const systemPrompt = buildAdaptiveDeepthinkSystemPrompt(state, options.systemPrompt);
        const response = providerName === 'gemini'
            ? await invokeGeminiToolAgentTurn(
                providerConfig,
                state.messages,
                systemPrompt,
                adaptiveDeepthinkToolDefinitions,
                options
            )
            : await model!.invoke([
                new SystemMessage(systemPrompt),
                ...state.messages
            ]);

        return { messages: [response] };
    };

    return new StateGraph(AdaptiveDeepthinkGraphAnnotation)
        .addNode('agent', agentNode)
        .addNode('tools', (state: AdaptiveDeepthinkGraphState) => executeToolsNode(state, options))
        .addEdge(START, 'agent')
        .addConditionalEdges('agent', shouldRunTools)
        .addConditionalEdges('tools', afterTools)
        .compile();
}
