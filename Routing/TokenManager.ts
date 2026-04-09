/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Token Management Utilities for Iterative Studio
 * Provides token estimation, compression strategies, and quota management
 */

// Approximate tokens per character for different languages/models
const TOKEN_ESTIMATION_RATES = {
    // Average case: ~4 characters per token for English text
    AVERAGE: 4,
    // Conservative estimate for code/mixed content
    CONSERVATIVE: 3,
    // For Asian languages or dense technical content
    DENSE: 2
};

// Safe margin to stay below limits (percentage)
const SAFE_MARGIN = 0.85; // Use only 85% of limit to be safe

// Model-specific token limits (input tokens)
const MODEL_TOKEN_LIMITS: Record<string, number> = {
    // Gemini/Gemma models
    'gemma-4': 16000,
    'gemma-4-31b': 16000,
    'gemini-3.1-pro-preview': 32000,
    'gemini-3-flash-preview': 32000,
    'gemini-3.1-flash-lite-preview': 32000,
    'gemini-2.5-pro': 32000,
    'gemini-2.5-flash': 32000,
    // OpenAI models
    'gpt-4o': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    // Anthropic models
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    // Default fallback
    'default': 16000
};

/**
 * Estimate token count from text content
 * Uses character-based estimation (fast, no external dependencies)
 */
export function estimateTokens(text: string, mode: 'average' | 'conservative' | 'dense' = 'average'): number {
    if (!text) return 0;
    
    const rate = TOKEN_ESTIMATION_RATES[mode.toUpperCase() as keyof typeof TOKEN_ESTIMATION_RATES] || TOKEN_ESTIMATION_RATES.AVERAGE;
    return Math.ceil(text.length / rate);
}

/**
 * Estimate tokens for structured messages array
 */
export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
    let totalTokens = 0;
    
    // Add overhead for message structure (~10 tokens per message)
    totalTokens += messages.length * 10;
    
    for (const msg of messages) {
        // System/assistant messages may have slightly different tokenization
        const mode = msg.role === 'system' ? 'conservative' : 'average';
        totalTokens += estimateTokens(msg.content, mode);
    }
    
    return totalTokens;
}

/**
 * Get token limit for a specific model
 */
export function getModelTokenLimit(modelId: string): number {
    // Try exact match first
    if (modelId in MODEL_TOKEN_LIMITS) {
        return MODEL_TOKEN_LIMITS[modelId];
    }
    
    // Try partial match
    for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
        if (modelId.includes(key) || key.includes(modelId)) {
            return limit;
        }
    }
    
    // Return default limit
    return MODEL_TOKEN_LIMITS['default'];
}

/**
 * Check if content exceeds safe token limit
 */
export function isNearTokenLimit(text: string, modelId: string, threshold: number = SAFE_MARGIN): boolean {
    const limit = getModelTokenLimit(modelId);
    const safeLimit = Math.floor(limit * threshold);
    const estimatedTokens = estimateTokens(text, 'conservative');
    
    return estimatedTokens >= safeLimit;
}

/**
 * Check if messages exceed safe token limit
 */
export function areMessagesNearTokenLimit(
    messages: Array<{ role: string; content: string }>,
    modelId: string,
    threshold: number = SAFE_MARGIN
): boolean {
    const limit = getModelTokenLimit(modelId);
    const safeLimit = Math.floor(limit * threshold);
    const estimatedTokens = estimateMessagesTokens(messages);
    
    return estimatedTokens >= safeLimit;
}

/**
 * Compress old iterations by replacing full content with atomic reconstructions
 * This is the primary strategy for reducing context size in iterative modes
 */
export function compressIterations(
    iterations: Array<{
        iterationNumber: number;
        critique?: string;
        correctedSolution?: string;
        atomic_reconstruction?: string;
    }>,
    keepLastN: number = 2
): string {
    if (iterations.length <= keepLastN) {
        // No compression needed
        return iterations.map(iter => 
            `Iteration ${iter.iterationNumber}:\nCritique: ${iter.critique || 'N/A'}\nSolution: ${iter.correctedSolution || 'N/A'}`
        ).join('\n\n---\n\n');
    }
    
    const compressed: string[] = [];
    
    // Add summary of compressed iterations
    const compressedCount = iterations.length - keepLastN;
    compressed.push(`[Iterations 1-${compressedCount} compressed for context efficiency]\n`);
    
    // Add atomic reconstructions for compressed iterations if available
    const reconstructions = iterations.slice(0, compressedCount)
        .filter(iter => iter.atomic_reconstruction)
        .map(iter => `Iteration ${iter.iterationNumber} Summary: ${iter.atomic_reconstruction}`);
    
    if (reconstructions.length > 0) {
        compressed.push(reconstructions.join('\n'));
    }
    
    compressed.push('\n--- END COMPRESSED ITERATIONS ---\n');
    
    // Add full content for recent iterations
    const recentIterations = iterations.slice(-keepLastN);
    const fullContent = recentIterations.map(iter => 
        `Iteration ${iter.iterationNumber}:\nCritique: ${iter.critique || 'N/A'}\nSolution: ${iter.correctedSolution || 'N/A'}`
    ).join('\n\n---\n\n');
    
    compressed.push(fullContent);
    
    return compressed.join('\n');
}

/**
 * Truncate solution pool entries while preserving critical information
 */
export function compressSolutionPool(
    poolContent: string,
    maxTokens: number,
    modelId: string
): string {
    const currentTokens = estimateTokens(poolContent, 'average');
    
    if (currentTokens <= maxTokens) {
        return poolContent;
    }
    
    // Strategy 1: Remove whitespace and formatting
    let compressed = poolContent.replace(/\s+/g, ' ').trim();
    
    // Strategy 2: If still too large, truncate individual solutions
    if (estimateTokens(compressed, 'average') > maxTokens) {
        const solutionBlocks = compressed.split(/===\s*Solution\s*\d+/i);
        const preservedBlocks: string[] = [];
        let runningTokens = 0;
        
        for (const block of solutionBlocks) {
            const blockTokens = estimateTokens(block, 'average');
            if (runningTokens + blockTokens < maxTokens * 0.9) {
                preservedBlocks.push(block);
                runningTokens += blockTokens;
            } else {
                // Truncate this block
                const remainingTokens = Math.floor((maxTokens * 0.9) - runningTokens);
                const truncatedBlock = block.substring(0, remainingTokens * 3);
                preservedBlocks.push(truncatedBlock + '\n[...truncated due to token limit...]');
                break;
            }
        }
        
        compressed = preservedBlocks.join('=== Solution ');
    }
    
    return compressed;
}

/**
 * Build a reduced context by keeping only essential information
 */
export function buildReducedContext(params: {
    problem: string;
    strategy: string;
    iterations: Array<any>;
    currentCritique?: string;
    keepLastIterations?: number;
}): string {
    const {
        problem,
        strategy,
        iterations,
        currentCritique,
        keepLastIterations = 2
    } = params;
    
    const compressedIterations = compressIterations(iterations, keepLastIterations);
    
    return `Core Challenge: ${problem}\n\n<INTERPRETIVE FRAMEWORK>\n"${strategy}"\n</INTERPRETIVE FRAMEWORK>\n\n<HISTORY>\n${compressedIterations}\n</HISTORY>\n\n${currentCritique ? `<CURRENT CRITIQUE>\n${currentCritique}\n</CURRENT CRITIQUE>\n` : ''}`;
}

/**
 * Calculate how many tokens can be safely used for new content
 */
export function getAvailableTokens(currentText: string, modelId: string, reservedForResponse: number = 4096): number {
    const limit = getModelTokenLimit(modelId);
    const safeLimit = Math.floor(limit * SAFE_MARGIN);
    const usedTokens = estimateTokens(currentText, 'conservative');
    
    return Math.max(0, safeLimit - usedTokens - reservedForResponse);
}

/**
 * Error type for token limit exceeded
 */
export class TokenLimitExceededError extends Error {
    constructor(
        public estimatedTokens: number,
        public limit: number,
        public modelId: string,
        message?: string
    ) {
        super(message || `Token limit exceeded: ${estimatedTokens} estimated tokens vs ${limit} limit for ${modelId}`);
        this.name = 'TokenLimitExceededError';
    }
}

/**
 * Validate that content will not exceed token limits before API call
 * Throws TokenLimitExceededError if limit would be exceeded
 */
export function validateTokenLimit(text: string, modelId: string, threshold: number = SAFE_MARGIN): void {
    const limit = getModelTokenLimit(modelId);
    const safeLimit = Math.floor(limit * threshold);
    const estimatedTokens = estimateTokens(text, 'conservative');
    
    if (estimatedTokens > safeLimit) {
        throw new TokenLimitExceededError(estimatedTokens, limit, modelId);
    }
}

/**
 * Validate messages array for token limits
 */
export function validateMessagesTokenLimit(
    messages: Array<{ role: string; content: string }>,
    modelId: string,
    threshold: number = SAFE_MARGIN
): void {
    const limit = getModelTokenLimit(modelId);
    const safeLimit = Math.floor(limit * threshold);
    const estimatedTokens = estimateMessagesTokens(messages);
    
    if (estimatedTokens > safeLimit) {
        throw new TokenLimitExceededError(estimatedTokens, limit, modelId);
    }
}
