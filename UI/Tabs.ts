
import { globalState } from '../Core/State';
import { activateDeepthinkStrategyTab } from '../Deepthink/Deepthink';

export function activateTab(idToActivate: string | number) {
    const { currentMode, activeDeepthinkPipeline } = globalState;

    if (currentMode === 'deepthink' && activeDeepthinkPipeline) {
        activeDeepthinkPipeline.activeTabId = idToActivate as string;
        document.querySelectorAll('#tabs-nav-container .tab-button.deepthink-mode-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#pipelines-content-container > .pipeline-content').forEach(pane => pane.classList.remove('active'));

        const tabButton = document.getElementById(`deepthink-tab-${idToActivate}`);
        const contentPane = document.getElementById(`pipeline-content-${idToActivate}`);
        if (tabButton) tabButton.classList.add('active');
        if (contentPane) contentPane.classList.add('active');

        if (idToActivate === 'strategic-solver' && activeDeepthinkPipeline.initialStrategies.length > 0) {
            activateDeepthinkStrategyTab(activeDeepthinkPipeline.activeStrategyTab ?? 0);
        }

    } else if (currentMode !== 'deepthink') {
        globalState.activePipelineId = idToActivate as number;
        document.querySelectorAll('#tabs-nav-container .tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.id === `pipeline-tab-${globalState.activePipelineId}`);
            btn.setAttribute('aria-selected', (btn.id === `pipeline-tab-${globalState.activePipelineId}`).toString());
        });
        document.querySelectorAll('#pipelines-content-container > .pipeline-content').forEach(pane => {
            pane.classList.toggle('active', pane.id === `pipeline-content-${globalState.activePipelineId}`);
        });
    }
}

export function clearTabsContainer() {
    const tabsNavContainer = document.getElementById('tabs-nav-container');
    if (tabsNavContainer) {
        tabsNavContainer.innerHTML = '';
    }
}
