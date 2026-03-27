/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const ADAPTIVE_DEEPTHINK_AGENT_META: Record<string, { displayName: string; icon: string }> = {
    GenerateStrategies: {
        displayName: 'Strategy Generation Agent',
        icon: 'psychology'
    },
    GenerateHypotheses: {
        displayName: 'Hypothesis Generation Agent',
        icon: 'science'
    },
    TestHypotheses: {
        displayName: 'Hypothesis Testing Agent',
        icon: 'troubleshoot'
    },
    ExecuteStrategies: {
        displayName: 'Strategy Execution Agent',
        icon: 'settings_suggest'
    },
    SolutionCritique: {
        displayName: 'Solution Critique Agent',
        icon: 'security'
    },
    CorrectedSolutions: {
        displayName: 'Solution Correction Agent',
        icon: 'auto_fix'
    },
    SelectBestSolution: {
        displayName: 'Final Judge Agent',
        icon: 'flag'
    }
};

export function isAdaptiveDeepthinkAgentTool(toolName: string): boolean {
    return toolName in ADAPTIVE_DEEPTHINK_AGENT_META;
}

export function getAdaptiveDeepthinkAgentDisplayName(toolName: string): string {
    return ADAPTIVE_DEEPTHINK_AGENT_META[toolName]?.displayName ?? toolName;
}

export function getAdaptiveDeepthinkAgentIcon(toolName: string): string {
    return ADAPTIVE_DEEPTHINK_AGENT_META[toolName]?.icon ?? 'smart_toy';
}
