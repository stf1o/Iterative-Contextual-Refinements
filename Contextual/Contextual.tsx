/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ContextualState,
    MainGeneratorHistoryManager,
    IterativeAgentHistoryManager,
    MemoryAgentHistoryManager,
    StrategicPoolAgentHistoryManager,
    createInitialContextualState,
    newMessageId,
    ContextualMessage,
    IterationData
} from './ContextualCore';
import { CustomizablePromptsContextual } from './ContextualPrompts';
import { renderContextualUI, updateContextualUI } from './ContextualUI';
import { callAI, getSelectedModel, getSelectedTemperature, getSelectedTopP, getProviderForCurrentModel } from '../Routing';
import { updateControlsState } from '../UI/Controls';
import { globalState } from '../Core/State';

// Global state
let activeContextualState: ContextualState | null = null;
let contextualUIRoot: any = null;
// isContextualRunning is now in globalState
let abortController: AbortController | null = null;
let mainGeneratorManager: MainGeneratorHistoryManager | null = null;
let iterativeAgentManager: IterativeAgentHistoryManager | null = null;
let memoryAgentManager: MemoryAgentHistoryManager | null = null;
let strategicPoolAgentManager: StrategicPoolAgentHistoryManager | null = null;
let contextualCustomPrompts: CustomizablePromptsContextual | null = null;
let onContentUpdated: ((content: string) => void) | null = null;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 20000;
const BACKOFF_FACTOR = 2;

// Base thinking configuration with dummy tool to enable thought signatures
// This tool is never actually called - it just enables Gemini to generate thought signatures
const BASE_THINKING_TOOLS = [{
    functionDeclarations: [{
        name: "internal_reasoning_continuation",
        description: "Internal marker for reasoning continuation across conversation turns",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }]
}];

/**
 * Get thinking configuration with optional code execution
 * Code execution is only enabled when:
 * 1. The provider is Gemini
 * 2. The user has enabled the code execution toggle
 */
function getThinkingConfig() {
    const isGemini = getProviderForCurrentModel() === 'gemini';
    const codeExecutionEnabled = globalState.geminiCodeExecutionEnabled && isGemini;

    return {
        thinkingBudget: -1,  // Dynamic thinking - model adjusts based on complexity
        tools: BASE_THINKING_TOOLS,
        codeExecution: codeExecutionEnabled
    };
}

export function setContextualContentUpdateCallback(cb: ((content: string) => void) | null) {
    onContentUpdated = cb;
}

export function renderContextualMode() {
    const container = document.getElementById('pipelines-content-container');
    const tabsContainer = document.getElementById('tabs-nav-container');
    const mainHeaderContent = document.querySelector('.main-header-content') as HTMLElement;

    if (!container || !tabsContainer) return;

    // Clear both containers
    tabsContainer.innerHTML = '';
    container.innerHTML = '';

    // Hide entire header section for Contextual mode (no tabs/header needed)
    if (mainHeaderContent) {
        mainHeaderContent.style.display = 'none';
    }

    const contextualContainer = document.createElement('div');
    contextualContainer.id = 'contextual-container';
    contextualContainer.className = 'pipeline-content active';
    contextualContainer.style.height = '100%';
    container.appendChild(contextualContainer);

    if (!activeContextualState) {
        contextualContainer.innerHTML = '';
        return;
    }

    if (!contextualUIRoot) {
        contextualUIRoot = renderContextualUI(contextualContainer, activeContextualState, stopContextualProcess);
    } else {
        updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
    }
}

export async function startContextualProcess(initialUserRequest: string, customPrompts: CustomizablePromptsContextual) {
    if (!initialUserRequest || globalState.isContextualRunning) return;

    // Store custom prompts for use in helper functions
    contextualCustomPrompts = customPrompts;

    activeContextualState = createInitialContextualState(initialUserRequest);
    activeContextualState.isRunning = true;
    globalState.isContextualRunning = true;
    updateControlsState();
    abortController = new AbortController();

    mainGeneratorManager = new MainGeneratorHistoryManager(
        contextualCustomPrompts.sys_contextual_mainGenerator,
        initialUserRequest
    );

    // Set up memory agent callback for main generator
    mainGeneratorManager.setMemoryAgentCallback(callMemoryAgentForCondense);

    renderContextualMode();

    await runContextualLoop();
}

export function stopContextualProcess() {
    if (abortController) {
        abortController.abort();
    }
    globalState.isContextualRunning = false;
    if (activeContextualState) {
        activeContextualState.isRunning = false;
        activeContextualState.isProcessing = false;
    }
    updateControlsState();
    if (contextualUIRoot && activeContextualState) {
        updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
    }
}

export function getContextualState(): ContextualState | null {
    return activeContextualState;
}

export function setContextualStateForImport(state: ContextualState | null) {
    activeContextualState = state;
    if (state) {
        state.isRunning = false;
        state.isProcessing = false;
    }
    globalState.isContextualRunning = false;
    contextualUIRoot = null;
}

async function runContextualLoop() {
    if (!activeContextualState || !globalState.isContextualRunning || !mainGeneratorManager) return;

    while (globalState.isContextualRunning && activeContextualState) {
        try {
            // Check if we should stop before starting new iteration
            if (!globalState.isContextualRunning || abortController?.signal.aborted) {
                break;
            }

            activeContextualState.isProcessing = true;
            activeContextualState.iterationCount++;
            updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);

            // Step 1: Main Generator Agent generates
            const mainGenerationResult = await callMainGeneratorAgent();

            if (!mainGenerationResult || abortController?.signal.aborted || !globalState.isContextualRunning) {
                break;
            }

            const mainGeneration = mainGenerationResult.text;
            const mainGenGeminiContent = mainGenerationResult.geminiContent;

            // Store initial generation if this is the first iteration
            if (activeContextualState.iterationCount === 1) {
                activeContextualState.initialMainGeneration = mainGeneration;
                mainGeneratorManager.setInitialGeneration(mainGeneration);

                // Initialize iterative agent manager after first generation
                iterativeAgentManager = new IterativeAgentHistoryManager(
                    contextualCustomPrompts!.sys_contextual_iterativeAgent,
                    activeContextualState.initialUserRequest,
                    mainGeneration
                );

                // Set up memory agent callback for iterative agent
                iterativeAgentManager.setMemoryAgentCallback(callMemoryAgentForCondense);

                // Initialize memory agent manager
                memoryAgentManager = new MemoryAgentHistoryManager(
                    contextualCustomPrompts!.sys_contextual_memoryAgent,
                    activeContextualState.initialUserRequest,
                    mainGeneration
                );

                // Initialize strategic pool agent manager
                strategicPoolAgentManager = new StrategicPoolAgentHistoryManager(
                    contextualCustomPrompts!.sys_contextual_solutionPoolAgent,
                    activeContextualState.initialUserRequest,
                    mainGeneration
                );
            }

            // Update current best generation
            activeContextualState.currentBestGeneration = mainGeneration;

            // Add to content history
            activeContextualState.contentHistory.push({
                content: mainGeneration,
                title: `Iteration ${activeContextualState.iterationCount} - Main Generation`,
                timestamp: Date.now()
            });

            // Add main generator message
            const mainMsg: ContextualMessage = {
                id: newMessageId('main'),
                role: 'main_generator',
                content: mainGeneration,
                timestamp: Date.now(),
                iterationNumber: activeContextualState.iterationCount
            };
            activeContextualState.messages.push(mainMsg);

            // Add to history with Gemini content for thought signature preservation
            await mainGeneratorManager.addGeneration(mainGeneration, activeContextualState.iterationCount);

            if (onContentUpdated) {
                try { onContentUpdated(mainGeneration); } catch { }
            }

            updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);

            if (abortController?.signal.aborted || !globalState.isContextualRunning) break;

            // Step 2: Iterative Agent provides suggestions
            if (!iterativeAgentManager) {
                throw new Error('Iterative agent manager not initialized');
            }

            const suggestionsResult = await callIterativeAgent(mainGeneration);

            if (!suggestionsResult || abortController?.signal.aborted || !globalState.isContextualRunning) {
                break;
            }

            const suggestions = suggestionsResult.text;
            const suggestionsGeminiContent = suggestionsResult.geminiContent;

            // Store suggestions (critique)
            activeContextualState.currentBestSuggestions = suggestions;
            activeContextualState.allIterativeSuggestions.push(suggestions);

            // Add iterative agent message
            const iterMsg: ContextualMessage = {
                id: newMessageId('iter'),
                role: 'iterative_agent',
                content: suggestions,
                timestamp: Date.now(),
                iterationNumber: activeContextualState.iterationCount
            };
            activeContextualState.messages.push(iterMsg);

            updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);

            if (abortController?.signal.aborted || !globalState.isContextualRunning) break;

            // Step 3: Strategic Pool Agent generates strategies (after first iteration)
            if (!strategicPoolAgentManager) {
                throw new Error('Strategic pool agent manager not initialized');
            }

            const strategicPoolResult = await callStrategicPoolAgent(mainGeneration, suggestions);

            if (!strategicPoolResult || abortController?.signal.aborted || !globalState.isContextualRunning) {
                break;
            }

            const strategicPool = strategicPoolResult.text;
            const strategicPoolGeminiContent = strategicPoolResult.geminiContent;

            // Check for exit signal from Strategic Pool Agent
            if (strategicPool.trim() === '<<<Exit>>>') {
                // Add exit message
                const exitMsg: ContextualMessage = {
                    id: newMessageId('system'),
                    role: 'system',
                    content: 'Strategic Pool Agent has detected that the Solution Critique found no flaws 3 times consecutively. Process completed successfully.',
                    timestamp: Date.now(),
                    iterationNumber: activeContextualState.iterationCount,
                    status: 'success',
                    blocks: [{ kind: 'info', message: 'Process completed: Solution Critique found no flaws 3 times consecutively.' }]
                };
                activeContextualState.messages.push(exitMsg);
                activeContextualState.isProcessing = false;
                updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
                stopContextualProcess();
                break;
            }

            // Store strategic pool
            activeContextualState.currentStrategicPool = strategicPool;
            activeContextualState.allStrategicPools.push(strategicPool);

            // Add strategic pool agent message
            const stratMsg: ContextualMessage = {
                id: newMessageId('strat'),
                role: 'strategic_pool_agent',
                content: strategicPool,
                timestamp: Date.now(),
                iterationNumber: activeContextualState.iterationCount
            };
            activeContextualState.messages.push(stratMsg);

            // Add to strategic pool history with Gemini content for thought signature preservation
            await strategicPoolAgentManager.addStrategicPool(strategicPool);

            // Now format the combined critique + strategic pool for main generator
            const combinedCritique = [
                suggestions,
                '',
                '---',
                '',
                '## Strategic Pool',
                'The following 5 strategies have been generated to expand your solution exploration:',
                '',
                strategicPool
            ].join('\n');

            // Add to histories with Gemini content for thought signature preservation
            await mainGeneratorManager.addIterativeResponse(combinedCritique, activeContextualState.iterationCount);
            await mainGeneratorManager.addIterativeSuggestion(combinedCritique);
            await iterativeAgentManager.addFixedGeneration(mainGeneration, activeContextualState.iterationCount);
            await iterativeAgentManager.addSuggestion(suggestions, activeContextualState.iterationCount);
            await iterativeAgentManager.addIterativeSuggestion(suggestions);

            activeContextualState.isProcessing = false;
            updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);

            if (abortController?.signal.aborted || !globalState.isContextualRunning) break;

            // Small delay before next iteration (check for abort during delay)
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(resolve, 1000);
                if (abortController) {
                    abortController.signal.addEventListener('abort', () => {
                        clearTimeout(timeout);
                        reject(new Error('Process stopped by user'));
                    });
                }
            }).catch(() => {
                // Abort during delay
                return;
            });

            if (!globalState.isContextualRunning) break;

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            const errorMsg: ContextualMessage = {
                id: newMessageId('system'),
                role: 'system',
                content: `Error: ${errMsg}`,
                timestamp: Date.now(),
                iterationNumber: activeContextualState.iterationCount,
                status: 'error',
                blocks: [{ kind: 'error', message: errMsg }]
            };
            activeContextualState.messages.push(errorMsg);
            activeContextualState.isProcessing = false;
            updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
            break;
        }
    }
}

async function callMainGeneratorAgent(): Promise<{ text: string; geminiContent?: any } | null> {
    if (!activeContextualState || !mainGeneratorManager) return null;

    const modelName = getSelectedModel();
    const temperature = getSelectedTemperature();
    const topP = getSelectedTopP();

    const prompt = await mainGeneratorManager.buildPrompt(
        activeContextualState.currentBestGeneration,
        activeContextualState.currentBestSuggestions,
        activeContextualState.currentMemory
    );

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (abortController?.signal.aborted || !globalState.isContextualRunning) {
            throw new Error('Process stopped by user');
        }

        try {
            if (attempt > 0) {
                const delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(resolve, delay);
                    if (abortController) {
                        abortController.signal.addEventListener('abort', () => {
                            clearTimeout(timeout);
                            reject(new Error('Process stopped by user'));
                        });
                    }
                }).catch(() => {
                    throw new Error('Process stopped by user');
                });
            }

            if (!globalState.isContextualRunning) {
                throw new Error('Process stopped by user');
            }

            const response = await callAI(
                prompt,
                temperature,
                modelName,
                contextualCustomPrompts!.sys_contextual_mainGenerator,
                false,
                topP,
                getThinkingConfig()
            );

            const text = extractTextFromResponse(response);

            if (text) {
                // Return both text and complete Gemini content for thought signature preservation
                return { text, geminiContent: response.candidates?.[0]?.content };
            }

            throw new Error('Provider returned empty response');

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Main Generator call attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);

            // Show retry message in UI if not the last attempt
            if (attempt < MAX_RETRIES && activeContextualState) {
                const retryMsg: ContextualMessage = {
                    id: newMessageId('system'),
                    role: 'system',
                    content: `Main Generator call failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt) / 1000}s...`,
                    timestamp: Date.now(),
                    iterationNumber: activeContextualState.iterationCount,
                    status: 'error',
                    blocks: [{ kind: 'error', message: `Retry ${attempt + 1}/${MAX_RETRIES + 1}: ${lastError.message}` }]
                };
                activeContextualState.messages.push(retryMsg);
                updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
            }

            if (attempt === MAX_RETRIES) {
                break;
            }
        }
    }

    throw lastError || new Error('Failed to get response from Main Generator Agent');
}

async function callIterativeAgent(currentGeneration: string): Promise<{ text: string; geminiContent?: any } | null> {
    if (!activeContextualState || !iterativeAgentManager) return null;

    const modelName = getSelectedModel();
    const temperature = getSelectedTemperature();
    const topP = getSelectedTopP();

    // Build prompt with current generation
    const prompt = await iterativeAgentManager.buildPrompt(currentGeneration, activeContextualState?.currentMemory || '');

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (abortController?.signal.aborted || !globalState.isContextualRunning) {
            throw new Error('Process stopped by user');
        }

        try {
            if (attempt > 0) {
                const delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(resolve, delay);
                    if (abortController) {
                        abortController.signal.addEventListener('abort', () => {
                            clearTimeout(timeout);
                            reject(new Error('Process stopped by user'));
                        });
                    }
                }).catch(() => {
                    throw new Error('Process stopped by user');
                });
            }

            if (!globalState.isContextualRunning) {
                throw new Error('Process stopped by user');
            }

            const response = await callAI(
                prompt,
                temperature,
                modelName,
                contextualCustomPrompts!.sys_contextual_iterativeAgent,
                false,
                topP,
                getThinkingConfig()
            );

            const text = extractTextFromResponse(response);

            if (text) {
                // Return both text and complete Gemini content for thought signature preservation
                return { text, geminiContent: response.candidates?.[0]?.content };
            }

            throw new Error('Provider returned empty response');

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Iterative Agent call attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);

            // Show retry message in UI if not the last attempt
            if (attempt < MAX_RETRIES && activeContextualState) {
                const retryMsg: ContextualMessage = {
                    id: newMessageId('system'),
                    role: 'system',
                    content: `Iterative Agent call failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt) / 1000}s...`,
                    timestamp: Date.now(),
                    iterationNumber: activeContextualState.iterationCount,
                    status: 'error',
                    blocks: [{ kind: 'error', message: `Retry ${attempt + 1}/${MAX_RETRIES + 1}: ${lastError.message}` }]
                };
                activeContextualState.messages.push(retryMsg);
                updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
            }

            if (attempt === MAX_RETRIES) {
                break;
            }
        }
    }

    throw lastError || new Error('Failed to get response from Iterative Agent');
}

async function callStrategicPoolAgent(currentGeneration: string, currentCritique: string): Promise<{ text: string; geminiContent?: any } | null> {
    if (!activeContextualState || !strategicPoolAgentManager) return null;

    const modelName = getSelectedModel();
    const temperature = getSelectedTemperature();
    const topP = getSelectedTopP();

    // Build prompt with current generation and critique
    const prompt = await strategicPoolAgentManager.buildPrompt(
        currentGeneration,
        currentCritique,
        activeContextualState.currentStrategicPool
    );

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (abortController?.signal.aborted || !globalState.isContextualRunning) {
            throw new Error('Process stopped by user');
        }

        try {
            if (attempt > 0) {
                const delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(resolve, delay);
                    if (abortController) {
                        abortController.signal.addEventListener('abort', () => {
                            clearTimeout(timeout);
                            reject(new Error('Process stopped by user'));
                        });
                    }
                }).catch(() => {
                    throw new Error('Process stopped by user');
                });
            }

            if (!globalState.isContextualRunning) {
                throw new Error('Process stopped by user');
            }

            const response = await callAI(
                prompt,
                temperature,
                modelName,
                contextualCustomPrompts!.sys_contextual_solutionPoolAgent,
                false,
                topP,
                getThinkingConfig()
            );

            const text = extractTextFromResponse(response);

            if (text) {
                // Return both text and complete Gemini content for thought signature preservation
                return { text, geminiContent: response.candidates?.[0]?.content };
            }

            throw new Error('Provider returned empty response');

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Strategic Pool Agent call attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);

            // Show retry message in UI if not the last attempt
            if (attempt < MAX_RETRIES && activeContextualState) {
                const retryMsg: ContextualMessage = {
                    id: newMessageId('system'),
                    role: 'system',
                    content: `Strategic Pool Agent call failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${INITIAL_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt) / 1000}s...`,
                    timestamp: Date.now(),
                    iterationNumber: activeContextualState.iterationCount,
                    status: 'error',
                    blocks: [{ kind: 'error', message: `Retry ${attempt + 1}/${MAX_RETRIES + 1}: ${lastError.message}` }]
                };
                activeContextualState.messages.push(retryMsg);
                updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
            }

            if (attempt === MAX_RETRIES) {
                break;
            }
        }
    }

    throw lastError || new Error('Failed to get response from Strategic Pool Agent');
}

async function callMemoryAgentForCondense(recentIterations: IterationData[], currentBestGeneration: string): Promise<string> {
    if (!activeContextualState || !memoryAgentManager) return '';

    const modelName = getSelectedModel();
    const temperature = getSelectedTemperature();
    const topP = getSelectedTopP();

    // Build prompt for memory agent
    const prompt = await memoryAgentManager.buildPrompt(recentIterations, currentBestGeneration);

    // Add memory agent message (processing) to UI
    const memoryMsg: ContextualMessage = {
        id: newMessageId('memory'),
        role: 'memory_agent',
        content: 'Analyzing iterations and updating memory...',
        timestamp: Date.now(),
        iterationNumber: activeContextualState.iterationCount
    };
    activeContextualState.messages.push(memoryMsg);
    updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);

    try {
        const response = await callAI(
            prompt,
            temperature,
            modelName,
            contextualCustomPrompts!.sys_contextual_memoryAgent,
            false,
            topP,
            getThinkingConfig()
        );

        const memory = extractTextFromResponse(response);

        if (memory) {
            // Update the memory message with actual content
            memoryMsg.content = memory;

            // Store in state
            activeContextualState.currentMemory = memory;

            // Add to memory snapshots
            if (memoryAgentManager) {
                memoryAgentManager.addMemorySnapshot(
                    memory,
                    currentBestGeneration,
                    activeContextualState.iterationCount
                );
            }

            activeContextualState.memorySnapshots.push({
                memory,
                finalGeneration: currentBestGeneration,
                condensePoint: activeContextualState.iterationCount
            });

            updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);

            return memory;
        }

        throw new Error('Memory Agent returned empty response');

    } catch (error) {
        console.error('Memory Agent call failed:', error);
        memoryMsg.content = `Error: Failed to generate memory - ${error instanceof Error ? error.message : 'Unknown error'}`;
        updateContextualUI(contextualUIRoot, activeContextualState, stopContextualProcess);
        return activeContextualState.currentMemory; // Return existing memory on error
    }
}

/**
 * Content part types from Gemini API response
 * These represent the different kinds of content the model can return
 * Including images from matplotlib/code execution
 */
export interface ResponsePart {
    type: 'text' | 'code' | 'output' | 'image';
    content: string;
    language?: string;  // For code parts
    mimeType?: string;  // For image parts
}

/**
 * Extract all parts from Gemini response in their NATURAL ORDER
 * This preserves the flow: text → code → output/image → more text
 * Critical for maintaining the agent's reasoning flow
 * 
 * Gemini code execution can return:
 * - text: Regular text content
 * - executableCode: Python code that was executed
 * - codeExecutionResult: Text output from execution (stdout/stderr)
 * - inlineData: Images (matplotlib graphs, etc.) as base64
 */
export function extractPartsInOrder(response: any): ResponsePart[] {
    const orderedParts: ResponsePart[] = [];

    if (!response?.candidates?.[0]?.content?.parts) {
        console.warn('⚠️ No response.candidates[0].content.parts found');
        return orderedParts;
    }

    const parts = response.candidates[0].content.parts;

    // DEBUG: Log the entire response structure to understand what we're actually receiving
    console.group('🔍 GEMINI CODE EXECUTION RESPONSE DEBUG');
    console.log('Total parts received:', parts.length);
    console.log('Full response structure:', JSON.stringify(response, null, 2));

    parts.forEach((part: any, index: number) => {
        console.group(`Part ${index + 1}/${parts.length}`);
        console.log('Keys:', Object.keys(part));
        console.log('Full part:', JSON.stringify(part, null, 2));
        console.groupEnd();
    });
    console.groupEnd();

    for (const part of parts) {
        // Text part
        if (part.text) {
            console.log('✅ Found text part');
            orderedParts.push({
                type: 'text',
                content: part.text
            });
        }
        // Executable code part
        else if (part.executableCode) {
            console.log('✅ Found executableCode part:', part.executableCode);
            orderedParts.push({
                type: 'code',
                content: part.executableCode.code || '',
                language: (part.executableCode.language || 'PYTHON').toLowerCase()
            });
        }
        // Code execution result part (text output)
        else if (part.codeExecutionResult) {
            console.log('✅ Found codeExecutionResult part:', part.codeExecutionResult);
            orderedParts.push({
                type: 'output',
                content: part.codeExecutionResult.output || ''
            });
        }
        // Inline data - images from matplotlib, etc.
        else if (part.inlineData) {
            console.log('✅ Found inlineData part:', { mimeType: part.inlineData.mimeType, dataLength: part.inlineData.data?.length });
            const mimeType = part.inlineData.mimeType || 'image/png';
            const data = part.inlineData.data || '';
            orderedParts.push({
                type: 'image',
                content: data, // Base64 encoded image data
                mimeType: mimeType
            });
        }
        else {
            console.warn('⚠️ Unknown part type:', Object.keys(part), part);
        }
    }

    console.log('📦 Total parts extracted:', orderedParts.length, orderedParts.map(p => p.type));

    return orderedParts;
}

/**
 * Format ordered parts for display with special markers for code execution
 * Uses HTML comments as markers that RenderMathMarkdown can parse for rich rendering
 */
export function formatPartsForDisplay(parts: ResponsePart[]): string {
    if (parts.length === 0) return '';

    const formattedParts: string[] = [];

    for (const part of parts) {
        switch (part.type) {
            case 'text':
                formattedParts.push(part.content);
                break;
            case 'code':
                // Use special markers for code execution blocks
                // These will be parsed by the UI for rich rendering
                formattedParts.push(
                    `\n<!-- CODE_EXECUTION_START -->\n` +
                    `<!-- LANGUAGE: ${part.language} -->\n` +
                    `\`\`\`${part.language}\n${part.content}\n\`\`\`\n` +
                    `<!-- CODE_EXECUTION_END -->`
                );
                break;
            case 'output':
                formattedParts.push(
                    `\n<!-- EXECUTION_OUTPUT_START -->\n` +
                    `\`\`\`\n${part.content}\n\`\`\`\n` +
                    `<!-- EXECUTION_OUTPUT_END -->\n`
                );
                break;
            case 'image':
                // Images from matplotlib/code execution - embed as base64
                formattedParts.push(
                    `\n<!-- EXECUTION_IMAGE_START -->\n` +
                    `<!-- MIME_TYPE: ${part.mimeType} -->\n` +
                    `${part.content}\n` +
                    `<!-- EXECUTION_IMAGE_END -->\n`
                );
                break;
        }
    }

    return formattedParts.join('\n').trim();
}

/**
 * Extract text from response, preserving natural order of all parts
 * Code execution is interleaved with text exactly as Gemini returned it
 */
function extractTextFromResponse(response: any): string {
    if (typeof response === 'string') {
        return response.trim();
    }
    if (response && typeof response === 'object') {
        // Handle Gemini API response format with thinking and code execution
        if (response.candidates && response.candidates[0]) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts) {
                // Extract all parts in their natural order
                const orderedParts = extractPartsInOrder(response);

                // Format preserving the natural flow
                return formatPartsForDisplay(orderedParts);
            }
        }
        // Fallback to legacy extraction
        if (response.text) {
            if (typeof response.text === 'function') {
                return String(response.text()).trim();
            }
            return String(response.text).trim();
        }
        if (response.content) return String(response.content).trim();
        if (response.message) return String(response.message).trim();
    }
    return '';
}
