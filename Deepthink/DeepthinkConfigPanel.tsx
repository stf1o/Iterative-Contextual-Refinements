/**
 * DeepthinkConfigPanel.tsx
 * Configuration panel displayed on the right side when Deepthink mode is active and idle
 * EXACT REPLICA of the left panel design
 */

export interface DeepthinkConfigPanelProps {
    strategiesCount: number;
    subStrategiesCount: number;
    hypothesisCount: number;
    skipSubStrategies: boolean;
    hypothesisEnabled: boolean;
    redTeamMode: string;
    postQualityFilterEnabled: boolean;
    refinementEnabled: boolean;
    dissectedObservationsEnabled: boolean;
    iterativeCorrectionsEnabled: boolean;
    iterativeDepth: number;
    provideAllSolutionsEnabled: boolean;
    codeExecutionEnabled: boolean;
    isGeminiProvider: boolean;
    onStrategiesChange: (value: number) => void;
    onSubStrategiesChange: (value: number) => void;
    onHypothesisChange: (value: number) => void;
    onSkipSubStrategiesToggle: (enabled: boolean) => void;
    onHypothesisToggle: (enabled: boolean) => void;
    onRedTeamModeChange: (mode: string) => void;
    onPostQualityFilterToggle: (enabled: boolean) => void;
    onRefinementToggle: (enabled: boolean) => void;
    onDissectedObservationsToggle: (enabled: boolean) => void;
    onIterativeCorrectionsToggle: (enabled: boolean) => void;
    onIterativeDepthChange: (value: number) => void;
    onProvideAllSolutionsToggle: (enabled: boolean) => void;
    onCodeExecutionToggle: (enabled: boolean) => void;
}

export function renderDeepthinkConfigPanel(container: HTMLElement, props: DeepthinkConfigPanelProps): void {
    container.innerHTML = `
        <div class="deepthink-config-panel">
            <div class="deepthink-config-scroll-container">
                
                <!-- Top Row Container: Strategy Execution + Red Team -->
                <div class="config-row-container">
                    <div class="config-row-inner">
                    <!-- Strategy Execution Options Container -->
                <div class="strategy-execution-container">
                    <div class="strategy-execution-header">
                        <span class="material-symbols-outlined">account_tree</span>
                        <span>Strategy Execution</span>
                    </div>
                    
                    <div class="strategy-execution-card">
                        <!-- Primary Strategy Count -->
                        <div class="strategy-execution-section">
                            <div class="input-group-tight">
                                <label for="dt-strategies-slider" class="input-label">Strategies: <span id="dt-strategies-value">${props.strategiesCount}</span></label>
                                <input type="range" id="dt-strategies-slider" class="slider" min="1" max="10" step="1" value="${props.strategiesCount}">
                            </div>
                        </div>
                        
                        <!-- Sub-Strategies Slider with Dots -->
                        <div class="strategy-execution-divider"></div>
                        
                        <div class="strategy-execution-section ${props.subStrategiesCount === 0 ? 'dimmed' : ''}">
                            <div class="input-group-tight">
                                <label for="dt-sub-strategies-slider" class="input-label">Sub-strategies: <span id="dt-sub-strategies-value">${props.subStrategiesCount}</span> ${props.subStrategiesCount === 0 ? '<span class="disabled-label">(Disabled)</span>' : ''}</label>
                                <div class="slider-with-dots">
                                    <input type="range" id="dt-sub-strategies-slider" class="slider dots-slider" min="0" max="10" step="1" value="${props.subStrategiesCount}" ${props.iterativeCorrectionsEnabled ? 'disabled' : ''}>
                                    <div class="slider-dots">
                                        ${Array.from({ length: 11 }, (_, i) => `<span class="slider-dot" data-value="${i}">${i}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                    
                    <!-- Red Team Options Container -->
                <div class="red-team-options-container">
                    <div class="red-team-options-header">
                        <span class="material-symbols-outlined">security</span>
                        <span>Red Team Evaluation</span>
                    </div>
                    <div class="red-team-toggle-wrapper">
                        <div class="red-team-buttons">
                            <button type="button" class="red-team-button ${props.redTeamMode === 'off' ? 'active' : ''}" data-value="off">Off</button>
                            <button type="button" class="red-team-button ${props.redTeamMode === 'balanced' ? 'active' : ''}" data-value="balanced">Balanced</button>
                            <button type="button" class="red-team-button ${props.redTeamMode === 'very_aggressive' ? 'active' : ''}" data-value="very_aggressive">Aggressive</button>
                        </div>
                    </div>
                    
                    <!-- Post Quality Filter Card -->
                    <div class="post-quality-filter-card-wrapper">
                        <div class="refinement-method-card post-quality-filter-card ${!props.iterativeCorrectionsEnabled ? 'disabled' : ''}" data-method="postqualityfilter">
                            <div class="method-card-header">
                                <div class="method-card-selector">
                                    <input type="checkbox" id="dt-post-quality-filter-toggle" class="method-checkbox" ${props.postQualityFilterEnabled ? 'checked' : ''} ${!props.iterativeCorrectionsEnabled ? 'disabled' : ''}>
                                    <label for="dt-post-quality-filter-toggle" class="method-checkbox-label">
                                        <div class="method-checkbox-custom"></div>
                                    </label>
                                </div>
                                <div class="method-card-title">
                                    <div class="method-name">Post Quality Filter</div>
                                    <div class="method-type">Strategy Evolution</div>
                                </div>
                            </div>
                            <div class="method-card-description">
                                Requires Iterative Corrections enabled. Iteratively refines strategies based on execution quality.
                            </div>
                        </div>
                    </div>
                    </div>
                    </div>
                </div>
                
                <!-- Bottom Row Container: Information Packet + Refinement -->
                <div class="config-row-container">
                    <div class="config-row-inner">
                    <!-- Information Packet Options Container -->
                <div class="information-packet-container">
                    <div class="information-packet-window" id="dt-information-packet-window">
                        <div class="window-header">
                            <div class="window-left">
                                <label class="window-toggle-label">
                                    <input type="checkbox" id="dt-hypothesis-toggle" class="window-toggle-input" ${props.hypothesisEnabled ? 'checked' : ''}>
                                    <span class="window-toggle-slider"></span>
                                </label>
                                <div class="window-title">Information Packet</div>
                            </div>
                            <div class="window-right">
                                <div class="window-controls">
                                    <div class="window-button close"></div>
                                    <div class="window-button minimize"></div>
                                    <div class="window-button maximize"></div>
                                </div>
                            </div>
                        </div>
                        <div class="window-content" id="dt-information-packet-content">
                            <div class="loading-info">
                                <div class="loading-line" style="width: 85%;"></div>
                                <div class="loading-line" style="width: 92%;"></div>
                                <div class="loading-line" style="width: 78%;"></div>
                                <div class="loading-line" style="width: 95%;"></div>
                                <div class="loading-line" style="width: 68%;"></div>
                                <div class="loading-line" style="width: 88%;"></div>
                                <div class="loading-line" style="width: 90%;"></div>
                                <div class="loading-line" style="width: 75%;"></div>
                                <div class="loading-line" style="width: 93%;"></div>
                                <div class="loading-line" style="width: 82%;"></div>
                                <div class="loading-line" style="width: 87%;"></div>
                                <div class="loading-line" style="width: 79%;"></div>
                                <div class="loading-line" style="width: 91%;"></div>
                                <div class="loading-line" style="width: 84%;"></div>
                                <div class="loading-line" style="width: 77%;"></div>
                                <div class="loading-line" style="width: 89%;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="execution-agents-visualization" id="dt-execution-agents-visualization">
                        <div class="connection-nodes">
                            <svg class="connection-svg" viewBox="0 0 400 40">
                                <defs>
                                    <linearGradient id="dtBlueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style="stop-color:var(--accent-blue);stop-opacity:0.9" />
                                        <stop offset="100%" style="stop-color:var(--accent-blue);stop-opacity:0.3" />
                                    </linearGradient>
                                </defs>
                                <circle cx="200" cy="0" r="4" fill="var(--accent-blue)" opacity="1"/>
                                <line x1="200" y1="0" x2="60" y2="40" stroke="url(#dtBlueGradient)" stroke-width="2" opacity="0.8"/>
                                <line x1="200" y1="0" x2="120" y2="40" stroke="url(#dtBlueGradient)" stroke-width="2" opacity="0.7"/>
                                <line x1="200" y1="0" x2="180" y2="40" stroke="url(#dtBlueGradient)" stroke-width="2" opacity="0.8"/>
                                <line x1="200" y1="0" x2="220" y2="40" stroke="url(#dtBlueGradient)" stroke-width="2" opacity="0.6"/>
                                <line x1="200" y1="0" x2="280" y2="40" stroke="url(#dtBlueGradient)" stroke-width="2" opacity="0.7"/>
                                <line x1="200" y1="0" x2="340" y2="40" stroke="url(#dtBlueGradient)" stroke-width="2" opacity="0.8"/>
                                <circle cx="60" cy="40" r="3" fill="var(--accent-blue)" opacity="0.6"/>
                                <circle cx="120" cy="40" r="3" fill="var(--accent-blue)" opacity="0.5"/>
                                <circle cx="180" cy="40" r="3" fill="var(--accent-blue)" opacity="0.6"/>
                                <circle cx="220" cy="40" r="3" fill="var(--accent-blue)" opacity="0.4"/>
                                <circle cx="280" cy="40" r="3" fill="var(--accent-blue)" opacity="0.5"/>
                                <circle cx="340" cy="40" r="3" fill="var(--accent-blue)" opacity="0.6"/>
                            </svg>
                        </div>
                        <div class="execution-agents-wrapper">
                            <div class="execution-agents-text">
                                Execution & Refinement Agents
                            </div>
                        </div>
                        <!-- Code Execution Toggle has been moved to Solution Refinement panel -->
                    </div>
                    <!-- Hypothesis Slider Card -->
                    <div class="hypothesis-slider-card">
                        <div class="hypothesis-slider-container" id="dt-hypothesis-slider-container">
                            <div class="input-group-tight">
                                <label for="dt-hypothesis-slider" class="input-label">Hypothesis Count: <span id="dt-hypothesis-value">${props.hypothesisCount}</span></label>
                                <input type="range" id="dt-hypothesis-slider" class="slider" min="1" max="6" step="1" value="${props.hypothesisCount}" ${!props.hypothesisEnabled ? 'disabled' : ''}>
                            </div>
                        </div>
                    </div>
                    </div>
                    
                    <!-- Refinement Options Container -->
                <div class="refinement-options-container">
                    <div class="refinement-options-header">
                        <span class="material-symbols-outlined">auto_fix_high</span>
                        <span>Solution Refinement</span>
                    </div>
                    
                    <!-- Master Control -->
                    <div class="refinement-master-control">
                        <label class="toggle-label">
                            <input type="checkbox" id="dt-refinement-toggle" class="toggle-input" ${props.refinementEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                        <div class="refinement-master-info">
                            <div class="refinement-master-title">Enable Refinements</div>
                            <div class="refinement-master-description">Generates critique for each solution & attempts to correct it</div>
                        </div>
                    </div>

                    <!-- Refinement Methods -->
                    <div class="refinement-methods">
                        <div class="refinement-methods-label">Select Refinement Strategy</div>
                        
                        <!-- Row 1: Synthesis + Full Context side by side -->
                        <div class="refinement-methods-row">
                            <!-- Method 1: Synthesis -->
                            <div class="refinement-method-card ${!props.refinementEnabled || props.iterativeCorrectionsEnabled ? 'disabled' : ''}" data-method="synthesis">
                                <div class="method-card-header">
                                    <div class="method-card-selector">
                                        <input type="checkbox" id="dt-dissected-observations-toggle" class="method-checkbox" ${props.dissectedObservationsEnabled ? 'checked' : ''} ${!props.refinementEnabled || props.iterativeCorrectionsEnabled ? 'disabled' : ''}>
                                        <label for="dt-dissected-observations-toggle" class="method-checkbox-label">
                                            <div class="method-checkbox-custom"></div>
                                        </label>
                                    </div>
                                    <div class="method-card-title">
                                        <div class="method-name">Critique Synthesis</div>
                                        <div class="method-type">Single Pass</div>
                                    </div>
                                </div>
                                <div class="method-card-description">
                                    Synthesizes all solution critiques. Cannot use with Iterative Corrections.
                                </div>
                            </div>

                            <!-- Method 3: Full Context -->
                            <div class="refinement-method-card ${!props.refinementEnabled || props.iterativeCorrectionsEnabled ? 'disabled' : ''}" data-method="fullcontext">
                                <div class="method-card-header">
                                    <div class="method-card-selector">
                                        <input type="checkbox" id="dt-provide-all-solutions-toggle" class="method-checkbox" ${props.provideAllSolutionsEnabled ? 'checked' : ''} ${!props.refinementEnabled || props.iterativeCorrectionsEnabled ? 'disabled' : ''}>
                                        <label for="dt-provide-all-solutions-toggle" class="method-checkbox-label">
                                            <div class="method-checkbox-custom"></div>
                                        </label>
                                    </div>
                                    <div class="method-card-title">
                                        <div class="method-name">Full Solution Context</div>
                                        <div class="method-type">Static Solution Pool</div>
                                    </div>
                                </div>
                                <div class="method-card-description">
                                    Provides all solutions to correctors. Cannot use with Iterative Corrections.
                                </div>
                            </div>
                        </div>

                        <!-- Row 2: Iterative full width -->
                        <div class="refinement-method-card ${!props.refinementEnabled ? 'disabled' : ''}" data-method="iterative">
                            <div class="method-card-header">
                                <div class="method-card-selector">
                                    <input type="checkbox" id="dt-iterative-corrections-toggle" class="method-checkbox" ${props.iterativeCorrectionsEnabled ? 'checked' : ''} ${props.refinementEnabled ? '' : 'disabled'}>
                                    <label for="dt-iterative-corrections-toggle" class="method-checkbox-label">
                                        <div class="method-checkbox-custom"></div>
                                    </label>
                                </div>
                                <div class="method-card-title">
                                    <div class="method-name">Iterative Corrections</div>
                                    <div class="method-type">${props.iterativeDepth} Refinement Loop${props.iterativeDepth !== 1 ? 's' : ''}</div>
                                </div>
                            </div>
                            <div class="method-card-description">
                                Iterative loop of Corrector & Critique. Disables Synthesis & Full Context options.
                            </div>
                            <div class="iteration-depth-container" style="display: ${props.iterativeCorrectionsEnabled ? 'block' : 'none'}; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
                                <div class="input-group-tight">
                                    <label for="dt-iteration-depth-slider" class="input-label">Iteration Depth: <span id="dt-iteration-depth-value">${props.iterativeDepth}</span></label>
                                    <input type="range" id="dt-iteration-depth-slider" class="slider" min="1" max="10" step="1" value="${props.iterativeDepth}">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Code Execution Toggle (Gemini only) - inside Solution Refinement panel -->
                    <div class="code-execution-toggle-container" id="dt-code-execution-container" style="display: ${props.isGeminiProvider ? 'flex' : 'none'}; margin-top: 12px;">
                        <label class="code-execution-toggle-label">
                            <input type="checkbox" id="dt-code-execution-toggle" class="code-execution-toggle-input" ${props.codeExecutionEnabled ? 'checked' : ''}>
                            <span class="code-execution-toggle-slider"></span>
                        </label>
                        <div class="code-execution-toggle-info">
                            <span class="code-execution-toggle-title">Code Execution</span>
                            <span class="code-execution-toggle-subtitle">Python sandbox for agents</span>
                        </div>
                    </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    attachConfigPanelEventListeners(container, props);
}

function attachConfigPanelEventListeners(container: HTMLElement, props: DeepthinkConfigPanelProps): void {
    // Strategies slider
    const strategiesSlider = container.querySelector('#dt-strategies-slider') as HTMLInputElement;
    const strategiesValue = container.querySelector('#dt-strategies-value') as HTMLElement;
    if (strategiesSlider && strategiesValue) {
        // Initialize fill (use current max attribute)
        const initValue = parseInt(strategiesSlider.value);
        const initMax = parseInt(strategiesSlider.max);
        const initPercentage = ((initValue - 1) / (initMax - 1)) * 100;
        strategiesSlider.style.background = `linear-gradient(to right, #e86b6b 0%, #e86b6b ${initPercentage}%, var(--slider-track-color) ${initPercentage}%, var(--slider-track-color) 100%)`;

        strategiesSlider.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            strategiesValue.textContent = value.toString();

            // Update slider fill (use current max attribute)
            const max = parseInt(strategiesSlider.max);
            const percentage = ((value - 1) / (max - 1)) * 100;
            strategiesSlider.style.background = `linear-gradient(to right, #e86b6b 0%, #e86b6b ${percentage}%, var(--slider-track-color) ${percentage}%, var(--slider-track-color) 100%)`;

            props.onStrategiesChange(value);
        });
    }

    // Sub-strategies slider (now includes 0 = disabled)
    const subStrategiesSlider = container.querySelector('#dt-sub-strategies-slider') as HTMLInputElement;
    const subStrategiesValue = container.querySelector('#dt-sub-strategies-value') as HTMLElement;
    const subStrategiesSection = subStrategiesSlider?.closest('.strategy-execution-section') as HTMLElement;
    if (subStrategiesSlider && subStrategiesValue && subStrategiesSection) {
        subStrategiesSlider.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);

            // Force update the display value
            if (subStrategiesValue) {
                subStrategiesValue.textContent = value.toString();
            }

            // Update dots visual
            const dots = container.querySelectorAll('.slider-dot');
            dots.forEach((dot, index) => {
                if (index <= value) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });

            // Update dimmed class and disabled label
            if (value === 0) {
                subStrategiesSection.classList.add('dimmed');
                const label = subStrategiesSection.querySelector('.input-label');
                const existingDisabledLabel = label?.querySelector('.disabled-label');
                if (label && !existingDisabledLabel) {
                    const disabledSpan = document.createElement('span');
                    disabledSpan.className = 'disabled-label';
                    disabledSpan.textContent = '(Disabled)';
                    label.appendChild(disabledSpan);
                }
            } else {
                subStrategiesSection.classList.remove('dimmed');
                const disabledLabel = subStrategiesSection.querySelector('.disabled-label');
                if (disabledLabel) {
                    disabledLabel.remove();
                }
            }

            // Update slider fill
            const percentage = (value / 10) * 100;
            subStrategiesSlider.style.background = `linear-gradient(to right, #e86b6b 0%, #e86b6b ${percentage}%, var(--slider-track-color) ${percentage}%, var(--slider-track-color) 100%)`;

            // When value is 0, disable sub-strategies
            props.onSkipSubStrategiesToggle(value === 0);
            props.onSubStrategiesChange(value); // Always update, backend handles 0 case
        });

        // Initialize dots and fill
        const initialValue = parseInt(subStrategiesSlider.value);
        const dots = container.querySelectorAll('.slider-dot');
        dots.forEach((dot, index) => {
            if (index <= initialValue) {
                dot.classList.add('active');
            }
        });

        // Initialize fill
        const initPercentage = (initialValue / 10) * 100;
        subStrategiesSlider.style.background = `linear-gradient(to right, #e86b6b 0%, #e86b6b ${initPercentage}%, var(--slider-track-color) ${initPercentage}%, var(--slider-track-color) 100%)`;
    }

    // Hypothesis toggle with collapse/expand
    const hypothesisToggle = container.querySelector('#dt-hypothesis-toggle') as HTMLInputElement;
    const infoPacketWindow = container.querySelector('#dt-information-packet-window') as HTMLElement;
    if (hypothesisToggle && infoPacketWindow) {
        hypothesisToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;

            // Update the main toggle first
            props.onHypothesisToggle(checked);

            // Collapse/expand the window
            if (checked) {
                infoPacketWindow.classList.remove('collapsed');
            } else {
                infoPacketWindow.classList.add('collapsed');
            }

            // Update disabled state
            const hypothesisSlider = container.querySelector('#dt-hypothesis-slider') as HTMLInputElement;
            if (hypothesisSlider) {
                hypothesisSlider.disabled = !checked;
            }

            // Explicitly update the hypothesis count to ensure it's 0 when disabled
            // This ensures the information packet is actually disabled during the run
            if (!checked) {
                props.onHypothesisChange(0);
            }
        });

        // Initialize collapsed state
        if (!hypothesisToggle.checked) {
            infoPacketWindow.classList.add('collapsed');
        }
    }

    // Hypothesis slider
    const hypothesisSlider = container.querySelector('#dt-hypothesis-slider') as HTMLInputElement;
    const hypothesisValue = container.querySelector('#dt-hypothesis-value') as HTMLElement;
    if (hypothesisSlider && hypothesisValue) {
        // Initialize fill
        const initValue = parseInt(hypothesisSlider.value);
        const initPercentage = ((initValue - 1) / 5) * 100; // min=1, max=6, range=5
        hypothesisSlider.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${initPercentage}%, var(--slider-track-color) ${initPercentage}%, var(--slider-track-color) 100%)`;

        hypothesisSlider.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            hypothesisValue.textContent = value.toString();

            // Update slider fill
            const percentage = ((value - 1) / 5) * 100;
            hypothesisSlider.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${percentage}%, var(--slider-track-color) ${percentage}%, var(--slider-track-color) 100%)`;

            props.onHypothesisChange(value);
        });
    }

    // Red team buttons
    const redTeamButtons = container.querySelectorAll('.red-team-button[data-value]');
    redTeamButtons.forEach(button => {
        button.addEventListener('click', () => {
            const value = (button as HTMLElement).dataset.value;
            if (value) {
                redTeamButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                props.onRedTeamModeChange(value);
            }
        });
    });

    // Post quality filter
    const postQualityFilterToggle = container.querySelector('#dt-post-quality-filter-toggle') as HTMLInputElement;
    if (postQualityFilterToggle) {
        postQualityFilterToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onPostQualityFilterToggle(checked);
        });
    }

    // Refinement toggle - delegate to controller via props
    const refinementToggle = container.querySelector('#dt-refinement-toggle') as HTMLInputElement;
    if (refinementToggle) {
        refinementToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onRefinementToggle(checked);
            // UI updates are handled by controller events -> updateConfigPanelUI
        });
    }

    // Dissected observations
    const dissectedObservationsToggle = container.querySelector('#dt-dissected-observations-toggle') as HTMLInputElement;
    if (dissectedObservationsToggle) {
        dissectedObservationsToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onDissectedObservationsToggle(checked);
        });
    }

    // Iterative corrections - delegate to controller via props
    // All side-effects (limiting strategies, disabling toggles) are handled by the controller
    const iterativeCorrectionsToggle = container.querySelector('#dt-iterative-corrections-toggle') as HTMLInputElement;
    if (iterativeCorrectionsToggle) {
        iterativeCorrectionsToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onIterativeCorrectionsToggle(checked);
            // UI updates are handled by controller events -> updateConfigPanelUI
        });
    }

    // Iteration depth slider
    const iterationDepthSlider = container.querySelector('#dt-iteration-depth-slider') as HTMLInputElement;
    const iterationDepthValue = container.querySelector('#dt-iteration-depth-value') as HTMLElement;
    if (iterationDepthSlider && iterationDepthValue) {
        // Initialize fill
        const initValue = parseInt(iterationDepthSlider.value);
        const initPercentage = ((initValue - 1) / 9) * 100; // min=1, max=10, range=9
        iterationDepthSlider.style.background = `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-purple) ${initPercentage}%, var(--slider-track-color) ${initPercentage}%, var(--slider-track-color) 100%)`;

        iterationDepthSlider.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            iterationDepthValue.textContent = value.toString();

            // Update slider fill
            const percentage = ((value - 1) / 9) * 100;
            iterationDepthSlider.style.background = `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-purple) ${percentage}%, var(--slider-track-color) ${percentage}%, var(--slider-track-color) 100%)`;

            // Update the method-type label
            const methodType = container.querySelector('[data-method="iterative"] .method-type') as HTMLElement;
            if (methodType) {
                methodType.textContent = `${value} Refinement Loop${value !== 1 ? 's' : ''}`;
            }

            props.onIterativeDepthChange(value);
        });
    }

    // Provide all solutions
    const provideAllSolutionsToggle = container.querySelector('#dt-provide-all-solutions-toggle') as HTMLInputElement;
    if (provideAllSolutionsToggle) {
        provideAllSolutionsToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onProvideAllSolutionsToggle(checked);
        });
    }

    // Code execution toggle
    const codeExecutionToggle = container.querySelector('#dt-code-execution-toggle') as HTMLInputElement;
    if (codeExecutionToggle) {
        codeExecutionToggle.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onCodeExecutionToggle(checked);
        });
    }
}

import {
    getDeepthinkConfigController,
    type DeepthinkConfigChangeEvent,
    getProviderForCurrentModel
} from '../Routing';

/**
 * Renders the Deepthink config panel and subscribes to controller state changes.
 * This function now uses the centralized DeepthinkConfigController for all business logic.
 */
export function renderDeepthinkConfigPanelInContainer(pipelinesContentContainer: HTMLElement | null) {
    if (!pipelinesContentContainer) return;

    const controller = getDeepthinkConfigController();
    const state = controller.getState();

    // Hide main header for edge-to-edge config panel
    const mainHeaderContent = document.querySelector('.main-header-content') as HTMLElement;
    if (mainHeaderContent) {
        mainHeaderContent.style.display = 'none';
    }

    // Disable sidebar collapse button when config panel is shown
    const sidebarCollapseButton = document.getElementById('sidebar-collapse-button') as HTMLButtonElement;
    if (sidebarCollapseButton) {
        sidebarCollapseButton.disabled = true;
        sidebarCollapseButton.style.opacity = '0.3';
        sidebarCollapseButton.style.cursor = 'not-allowed';
        sidebarCollapseButton.title = 'Sidebar collapse disabled in config view';
    }

    // Clear any existing panel
    const existingPanel = pipelinesContentContainer.querySelector('.deepthink-config-panel');
    if (existingPanel) {
        existingPanel.remove();
    }

    // Render using state from controller
    renderDeepthinkConfigPanel(pipelinesContentContainer, {
        strategiesCount: state.strategiesCount,
        subStrategiesCount: state.subStrategiesCount,
        hypothesisCount: state.hypothesisCount,
        skipSubStrategies: state.skipSubStrategies,
        hypothesisEnabled: state.hypothesisEnabled,
        redTeamMode: state.redTeamMode,
        postQualityFilterEnabled: state.postQualityFilterEnabled,
        refinementEnabled: state.refinementEnabled,
        dissectedObservationsEnabled: state.dissectedObservationsEnabled,
        iterativeCorrectionsEnabled: state.iterativeCorrectionsEnabled,
        iterativeDepth: state.iterativeDepth,
        provideAllSolutionsEnabled: state.provideAllSolutionsEnabled,
        codeExecutionEnabled: state.codeExecutionEnabled,
        isGeminiProvider: getProviderForCurrentModel() === 'gemini',

        // === CALLBACKS: Delegate to controller ===
        onStrategiesChange: (value) => {
            controller.setStrategiesCount(value);
        },
        onSubStrategiesChange: (value) => {
            controller.setSubStrategiesCount(value);
        },
        onHypothesisChange: (value) => {
            controller.setHypothesisCount(value);
        },
        onSkipSubStrategiesToggle: (skip) => {
            controller.setSkipSubStrategies(skip);
        },
        onHypothesisToggle: (enabled) => {
            controller.setHypothesisEnabled(enabled);
        },
        onRedTeamModeChange: (mode) => {
            controller.setRedTeamMode(mode);
        },
        onPostQualityFilterToggle: (enabled) => {
            controller.setPostQualityFilterEnabled(enabled);
        },
        onRefinementToggle: (enabled) => {
            controller.setRefinementEnabled(enabled);
        },
        onDissectedObservationsToggle: (enabled) => {
            controller.setDissectedObservationsEnabled(enabled);
        },
        onIterativeCorrectionsToggle: (enabled) => {
            controller.setIterativeCorrectionsEnabled(enabled);
        },
        onIterativeDepthChange: (value) => {
            controller.setIterativeDepth(value);
        },
        onProvideAllSolutionsToggle: (enabled) => {
            controller.setProvideAllSolutionsEnabled(enabled);
        },
        onCodeExecutionToggle: (enabled) => {
            controller.setCodeExecutionEnabled(enabled);
        }
    });

    // Subscribe to controller state changes to refresh UI
    const onConfigChange = (e: Event) => {
        const event = e as DeepthinkConfigChangeEvent;
        const newState = event.detail.state;

        // Re-render the panel with new state
        // This ensures both UIs stay in sync when ModelSelectionUI changes state
        updateConfigPanelUI(pipelinesContentContainer, newState, controller);
    };

    controller.addEventListener('configchange', onConfigChange);

    // Store cleanup function on the container for later removal
    (pipelinesContentContainer as any).__deepthinkConfigCleanup = () => {
        controller.removeEventListener('configchange', onConfigChange);
    };
}

/**
 * Updates the config panel UI elements to reflect the current state.
 * This is called when the controller emits a state change event.
 */
function updateConfigPanelUI(
    container: HTMLElement,
    state: ReturnType<typeof getDeepthinkConfigController>['getState'] extends () => infer R ? R : never,
    controller: ReturnType<typeof getDeepthinkConfigController>
) {
    // Update strategies slider
    const strategiesSlider = container.querySelector('#dt-strategies-slider') as HTMLInputElement;
    const strategiesValue = container.querySelector('#dt-strategies-value') as HTMLElement;
    if (strategiesSlider && strategiesValue) {
        strategiesSlider.value = state.strategiesCount.toString();
        strategiesSlider.max = controller.getMaxStrategies().toString();
        strategiesValue.textContent = state.strategiesCount.toString();

        // Update fill
        const max = controller.getMaxStrategies();
        const percentage = ((state.strategiesCount - 1) / (max - 1)) * 100;
        strategiesSlider.style.background = `linear-gradient(to right, #e86b6b 0%, #e86b6b ${percentage}%, var(--slider-track-color) ${percentage}%, var(--slider-track-color) 100%)`;
    }

    // Update sub-strategies slider
    const subStrategiesSlider = container.querySelector('#dt-sub-strategies-slider') as HTMLInputElement;
    const subStrategiesValue = container.querySelector('#dt-sub-strategies-value') as HTMLElement;
    const subStrategiesSection = subStrategiesSlider?.closest('.strategy-execution-section') as HTMLElement;
    if (subStrategiesSlider && subStrategiesValue) {
        subStrategiesSlider.value = state.subStrategiesCount.toString();
        subStrategiesSlider.disabled = state.iterativeCorrectionsEnabled;
        subStrategiesValue.textContent = state.subStrategiesCount.toString();

        // Update dimmed state
        if (subStrategiesSection) {
            if (state.subStrategiesCount === 0 || state.iterativeCorrectionsEnabled) {
                subStrategiesSection.classList.add('dimmed');
            } else {
                subStrategiesSection.classList.remove('dimmed');
            }
        }
    }

    // Update hypothesis toggle and slider
    const hypothesisToggle = container.querySelector('#dt-hypothesis-toggle') as HTMLInputElement;
    const hypothesisSlider = container.querySelector('#dt-hypothesis-slider') as HTMLInputElement;
    const hypothesisValueElem = container.querySelector('#dt-hypothesis-value') as HTMLElement;
    const infoPacketWindow = container.querySelector('#dt-information-packet-window') as HTMLElement;
    if (hypothesisToggle) {
        hypothesisToggle.checked = state.hypothesisEnabled;
    }
    if (hypothesisSlider && hypothesisValueElem) {
        hypothesisSlider.value = (state.hypothesisCount > 0 ? state.hypothesisCount : 1).toString();
        hypothesisSlider.disabled = !state.hypothesisEnabled;
        hypothesisValueElem.textContent = state.hypothesisCount.toString();
    }
    if (infoPacketWindow) {
        if (state.hypothesisEnabled) {
            infoPacketWindow.classList.remove('collapsed');
        } else {
            infoPacketWindow.classList.add('collapsed');
        }
    }

    // Update red team buttons
    const redTeamButtons = container.querySelectorAll('.red-team-button[data-value]');
    redTeamButtons.forEach(btn => {
        const value = (btn as HTMLElement).dataset.value;
        if (value === state.redTeamMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update refinement toggle
    const refinementToggle = container.querySelector('#dt-refinement-toggle') as HTMLInputElement;
    if (refinementToggle) {
        refinementToggle.checked = state.refinementEnabled;
    }

    // Update refinement method cards and checkboxes
    const synthesisToggle = container.querySelector('#dt-dissected-observations-toggle') as HTMLInputElement;
    const fullContextToggle = container.querySelector('#dt-provide-all-solutions-toggle') as HTMLInputElement;
    const iterativeToggle = container.querySelector('#dt-iterative-corrections-toggle') as HTMLInputElement;
    const postQualityToggle = container.querySelector('#dt-post-quality-filter-toggle') as HTMLInputElement;

    const synthesisCard = container.querySelector('[data-method="synthesis"]') as HTMLElement;
    const fullContextCard = container.querySelector('[data-method="fullcontext"]') as HTMLElement;
    const iterativeCard = container.querySelector('[data-method="iterative"]') as HTMLElement;
    const postQualityCard = container.querySelector('.post-quality-filter-card') as HTMLElement;

    // Synthesis (Dissected Observations)
    if (synthesisToggle) {
        synthesisToggle.checked = state.dissectedObservationsEnabled;
        synthesisToggle.disabled = !state.refinementEnabled || state.iterativeCorrectionsEnabled;
    }
    if (synthesisCard) {
        synthesisCard.classList.toggle('disabled', !state.refinementEnabled || state.iterativeCorrectionsEnabled);
    }

    // Full Context (Provide All Solutions)
    if (fullContextToggle) {
        fullContextToggle.checked = state.provideAllSolutionsEnabled;
        fullContextToggle.disabled = !state.refinementEnabled || state.iterativeCorrectionsEnabled;
    }
    if (fullContextCard) {
        fullContextCard.classList.toggle('disabled', !state.refinementEnabled || state.iterativeCorrectionsEnabled);
    }

    // Iterative Corrections
    if (iterativeToggle) {
        iterativeToggle.checked = state.iterativeCorrectionsEnabled;
        iterativeToggle.disabled = !state.refinementEnabled;
    }
    if (iterativeCard) {
        iterativeCard.classList.toggle('disabled', !state.refinementEnabled);
    }

    // Iteration Depth Slider
    const iterationDepthSlider = container.querySelector('#dt-iteration-depth-slider') as HTMLInputElement;
    const iterationDepthValue = container.querySelector('#dt-iteration-depth-value') as HTMLElement;
    const iterationDepthContainer = container.querySelector('.iteration-depth-container') as HTMLElement;
    if (iterationDepthSlider && iterationDepthValue) {
        iterationDepthSlider.value = state.iterativeDepth.toString();
        iterationDepthValue.textContent = state.iterativeDepth.toString();

        // Update fill
        const percentage = ((state.iterativeDepth - 1) / 9) * 100;
        iterationDepthSlider.style.background = `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-purple) ${percentage}%, var(--slider-track-color) ${percentage}%, var(--slider-track-color) 100%)`;
    }
    if (iterationDepthContainer) {
        iterationDepthContainer.style.display = state.iterativeCorrectionsEnabled ? 'block' : 'none';
    }
    // Update method-type label
    const methodTypeLabel = container.querySelector('[data-method="iterative"] .method-type') as HTMLElement;
    if (methodTypeLabel) {
        methodTypeLabel.textContent = `${state.iterativeDepth} Refinement Loop${state.iterativeDepth !== 1 ? 's' : ''}`;
    }

    // Post Quality Filter
    if (postQualityToggle) {
        postQualityToggle.checked = state.postQualityFilterEnabled;
        postQualityToggle.disabled = !state.iterativeCorrectionsEnabled;
    }
    if (postQualityCard) {
        postQualityCard.classList.toggle('disabled', !state.iterativeCorrectionsEnabled);
    }

    // Code Execution Toggle
    const codeExecutionToggle = container.querySelector('#dt-code-execution-toggle') as HTMLInputElement;
    const codeExecutionContainer = container.querySelector('#dt-code-execution-container') as HTMLElement;
    if (codeExecutionToggle) {
        codeExecutionToggle.checked = state.codeExecutionEnabled;
    }
    if (codeExecutionContainer) {
        const isGemini = getProviderForCurrentModel() === 'gemini';
        codeExecutionContainer.style.display = isGemini ? 'flex' : 'none';
    }
}

