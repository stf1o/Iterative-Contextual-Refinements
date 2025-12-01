/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelConfigManager } from './ModelConfig';

export class ApiCallEstimator {
    private modelConfig: ModelConfigManager;
    private countElement: HTMLElement | null;
    private warningElement: HTMLElement | null;
    private pqfWarningElement: HTMLElement | null;

    constructor(modelConfig: ModelConfigManager) {
        this.modelConfig = modelConfig;
        this.countElement = document.getElementById('api-call-count');
        this.warningElement = document.getElementById('api-call-warning');
        this.pqfWarningElement = document.getElementById('api-call-pqf-warning');
    }

    /**
     * Calculate estimated API calls for Deepthink mode
     * Returns a range { min, max } to account for variable retry loops
     */
    public calculateDeepthinkApiCalls(): { min: number, max: number } {
        const params = this.modelConfig.getParameters();

        const strategiesCount = params.strategiesCount;
        const subStrategiesCount = params.subStrategiesCount;
        const hypothesisCount = params.hypothesisCount;
        const skipSubStrategies = params.skipSubStrategies;
        const refinementEnabled = params.refinementEnabled;
        const dissectedObservationsEnabled = params.dissectedObservationsEnabled;
        const iterativeCorrectionsEnabled = params.iterativeCorrectionsEnabled;
        const postQualityFilterEnabled = params.postQualityFilterEnabled;
        const redTeamEnabled = params.redTeamAggressiveness !== 'off';

        let minCalls = 0;
        let maxCalls = 0;

        // 1. Initial Strategy Generation (1 call)
        minCalls += 1;
        maxCalls += 1;

        // 2. Sub-Strategy Generation (N calls - one per strategy, if not skipped)
        if (!skipSubStrategies) {
            minCalls += strategiesCount;
            maxCalls += strategiesCount;
        }

        // 3. Solution Attempts
        const solutionCount = skipSubStrategies ? strategiesCount : (strategiesCount * subStrategiesCount);
        minCalls += solutionCount;
        maxCalls += solutionCount;

        // 4-5. Hypothesis Track (only if hypothesis count > 0)
        if (hypothesisCount > 0) {
            // 4. Hypothesis Generation (1 call)
            minCalls += 1;
            maxCalls += 1;

            // 5. Hypothesis Testing (H calls - one per hypothesis)
            minCalls += hypothesisCount;
            maxCalls += hypothesisCount;

            // Note: Knowledge Synthesis is done by system, not an API call
        }

        // 7-9. Refinement Track (only if refinement enabled)
        if (refinementEnabled) {
            if (iterativeCorrectionsEnabled) {
                // Initial critiques for all strategies (when skip sub-strategies is enabled)
                if (skipSubStrategies) {
                    minCalls += strategiesCount; // Initial critiques
                    maxCalls += strategiesCount;

                    // PostQualityFilter (only if enabled)
                    if (postQualityFilterEnabled) {
                        // Typical Case (Min):
                        // 1 iteration, 50% replacement
                        // Iteration 1: 1 PostQF + ceil(0.5*N) StratGen + ceil(0.5*N) Exec + ceil(0.5*N) Critiques
                        const typicalReplacementCount = Math.ceil(strategiesCount * 0.5);
                        minCalls += 1 + typicalReplacementCount + typicalReplacementCount + typicalReplacementCount;

                        // Worst Case (Max):
                        // 3 iterations, 100% replacement
                        // Iteration 1: 1 PostQF + N StratGen + N Exec + N Critiques
                        // Iteration 2: 1 PostQF + N StratGen + N Exec + N Critiques  
                        // Iteration 3: 1 PostQF + N StratGen + N Exec + N Critiques
                        const postQFIterations = 3;
                        maxCalls += postQFIterations * (1 + strategiesCount + strategiesCount + strategiesCount);
                    }
                }

                // For each solution: 3 iterations × (1 critique + 1 correction + 1 solution pool) = 9 calls per solution
                // Note: Solution pool calls = critique calls (1 per iteration)
                minCalls += solutionCount * 9;
                maxCalls += solutionCount * 9;
            } else {
                // Standard Refinement Mode:
                // 7. Solution Critique (N calls - one per main strategy)
                minCalls += strategiesCount;
                maxCalls += strategiesCount;

                // 8. Dissected Observations Synthesis (1 call if enabled)
                if (dissectedObservationsEnabled) {
                    minCalls += 1;
                    maxCalls += 1;
                }

                // 9. Self-Improvement (M calls - one per solution)
                minCalls += solutionCount;
                maxCalls += solutionCount;
            }
        }

        // 10. Red Team Evaluation (1 call - consolidated agent)
        if (redTeamEnabled) {
            minCalls += 1;
            maxCalls += 1;
        }

        // 11. Final Judging (1 call to select best solution)
        minCalls += 1;
        maxCalls += 1;

        return { min: minCalls, max: maxCalls };
    }

    /**
     * Update the UI with the estimated API call count
     */
    public updateApiCallDisplay(): void {
        const { min, max } = this.calculateDeepthinkApiCalls();
        const params = this.modelConfig.getParameters();
        const redTeamEnabled = params.redTeamAggressiveness !== 'off';
        const postQualityFilterEnabled = params.postQualityFilterEnabled;

        // Update the count display
        if (this.countElement) {
            if (min === max) {
                this.countElement.textContent = `~${min}`;
            } else {
                this.countElement.textContent = `~${min} to ${max}`;
            }
        }

        // Show/hide the red team warning icon
        if (this.warningElement) {
            if (redTeamEnabled) {
                this.warningElement.style.display = 'block';
            } else {
                this.warningElement.style.display = 'none';
            }
        }

        // Show/hide the PQF warning icon
        if (this.pqfWarningElement) {
            if (postQualityFilterEnabled) {
                this.pqfWarningElement.style.display = 'block';
            } else {
                this.pqfWarningElement.style.display = 'none';
            }
        }
    }

    /**
     * Attach event listeners to update on parameter changes
     */
    public attachListeners(): void {
        // Listen to all parameter changes
        const sliders = [
            'strategies-slider',
            'sub-strategies-slider',
            'hypothesis-slider'
        ];

        sliders.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateApiCallDisplay());
            }
        });

        // Listen to toggle changes
        const toggles = [
            'refinement-toggle',
            'skip-sub-strategies-toggle',
            'dissected-observations-toggle',
            'iterative-corrections-toggle',
            'post-quality-filter-toggle',
            'hypothesis-toggle'
        ];

        toggles.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateApiCallDisplay());
            }
        });

        // Listen to red team button clicks - only update if on/off state changes
        const redTeamButtons = document.querySelectorAll('.red-team-button');
        let previousRedTeamEnabled = this.modelConfig.getParameters().redTeamAggressiveness !== 'off';

        redTeamButtons.forEach(button => {
            button.addEventListener('click', () => {
                setTimeout(() => {
                    const currentRedTeamEnabled = this.modelConfig.getParameters().redTeamAggressiveness !== 'off';
                    // Only update if the enabled state changed (off <-> on), not aggressiveness level
                    if (currentRedTeamEnabled !== previousRedTeamEnabled) {
                        previousRedTeamEnabled = currentRedTeamEnabled;
                        this.updateApiCallDisplay();
                    }
                }, 50);
            });
        });

        // Initial update
        this.updateApiCallDisplay();
    }
}
