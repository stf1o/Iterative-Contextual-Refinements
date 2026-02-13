import * as Diff from 'diff';
import { EvolutionViewerState, ContentState } from './types';
import { openSequentialViewer } from './SequentialViewer';
import { renderMathContent } from './utils';

// Store active evolution viewers for live updates
const activeEvolutionViewers = new Map<string, EvolutionViewerState>();

export function openEvolutionViewer(pipelineIdOverride?: number) {
    const pipelinesState = (window as any).pipelinesState;
    if (!pipelinesState || !Array.isArray(pipelinesState)) {
        alert('Cannot open evolution viewer: Invalid pipeline data.');
        return;
    }

    const pipelineId = pipelineIdOverride;

    if (pipelineId === null || pipelineId === undefined) {
        const { getDiffSourceData } = require('./DiffModalController');
        const diffSourceData = getDiffSourceData();
        if (diffSourceData) {
            const pipeline = pipelinesState.find((p: any) => p.id === diffSourceData.pipelineId);
            if (pipeline) {
                createEvolutionViewerModal(pipeline);
                return;
            }
        }
        return;
    }

    const pipeline = pipelinesState.find((p: any) => p.id === pipelineId);

    if (!pipeline) {
        alert('Pipeline not found.');
        return;
    }

    createEvolutionViewerModal(pipeline);
}

/**
 * Opens evolution viewer from content history array (for Agentic and Contextual modes)
 */
export function openEvolutionViewerFromHistory(
    contentHistory: Array<{ content: string; title: string; timestamp: number }>,
    sessionId: string
) {
    if (!contentHistory || contentHistory.length === 0) {
        alert('No content history available.');
        return;
    }

    const existingViewer = activeEvolutionViewers.get(sessionId);
    if (existingViewer) {
        updateEvolutionViewer(existingViewer, contentHistory);
        return;
    }

    const mockPipeline = {
        id: Date.now(),
        iterations: contentHistory.map((entry, index) => ({
            iterationNumber: index + 1,
            title: entry.title,
            generatedContent: entry.content,
            contentBeforeBugFix: null
        }))
    };

    createEvolutionViewerModal(mockPipeline, sessionId, contentHistory);
}

/**
 * Updates an existing evolution viewer with new content
 */
function updateEvolutionViewer(
    viewer: EvolutionViewerState,
    contentHistory: Array<{ content: string; title: string; timestamp: number }>
) {
    const { scrollContainer, lastCount } = viewer;

    if (contentHistory.length <= lastCount) {
        return;
    }

    // Re-render the entire view
    const contentStates = contentHistory.map((entry, index) => ({
        content: entry.content,
        title: entry.title,
        iterationNumber: index + 1,
        isBugFix: false
    }));

    scrollContainer.innerHTML = '';
    renderColumns(scrollContainer, contentStates);
    viewer.lastCount = contentHistory.length;

    setTimeout(() => {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }, 100);
}

/**
 * Updates evolution viewer if it's open for the given session
 */
export function updateEvolutionViewerIfOpen(
    sessionId: string,
    contentHistory: Array<{ content: string; title: string; timestamp: number }>
) {
    const viewer = activeEvolutionViewers.get(sessionId);
    if (viewer && contentHistory) {
        updateEvolutionViewer(viewer, contentHistory);
    }
}

function createEvolutionViewerModal(
    pipeline: any,
    sessionId?: string,
    contentHistory?: Array<{ content: string; title: string; timestamp: number }>
) {
    const existing = document.getElementById('evolution-viewer-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'evolution-viewer-overlay';
    overlay.className = 'evolution-viewer-overlay';

    const isInsideDeepthinkModal = document.getElementById('solution-modal-overlay') !== null;
    if (isInsideDeepthinkModal) {
        overlay.style.setProperty('z-index', '2300', 'important');
    }

    const container = document.createElement('div');
    container.className = 'evolution-viewer-container';

    // Header
    const header = document.createElement('div');
    header.className = 'evolution-viewer-header';
    header.innerHTML = `
        <div class="evolution-header-content">
            <span class="material-symbols-outlined evolution-icon">movie</span>
            <h2 class="evolution-title">Content Evolution Timeline</h2>
            <span class="evolution-subtitle">Scroll horizontally to view all iterations</span>
        </div>
        <div class="evolution-header-actions">
            <button id="hide-diff-button" class="hide-diff-button">
                <span class="material-symbols-outlined">visibility_off</span>
                <span class="button-text">Hide Diff</span>
            </button>
            <button id="sequential-view-button" class="sequential-view-button">
                <span class="material-symbols-outlined">play_circle</span>
                <span class="button-text">View Iterations Sequentially</span>
            </button>
        </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.className = 'evolution-close-button';
    closeButton.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeButton.addEventListener('click', closeEvolutionViewer);
    header.appendChild(closeButton);

    container.appendChild(header);

    // Scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'evolution-scroll-container';

    // Build content states
    const iterations = pipeline.iterations.sort((a: any, b: any) => a.iterationNumber - b.iterationNumber);
    const contentStates: ContentState[] = [];

    iterations.forEach((iteration: any) => {
        if (!iteration.generatedContent && !iteration.contentBeforeBugFix) {
            return;
        }

        if (iteration.contentBeforeBugFix &&
            iteration.contentBeforeBugFix.trim() !== '' &&
            iteration.contentBeforeBugFix !== iteration.generatedContent) {
            contentStates.push({
                content: iteration.contentBeforeBugFix,
                title: (iteration.title || `Iteration ${iteration.iterationNumber}`) + ' (Pre-Fix)',
                iterationNumber: iteration.iterationNumber,
                isBugFix: false
            });
        }

        const finalContent = iteration.generatedContent || iteration.contentBeforeBugFix || '';
        if (finalContent.trim() !== '') {
            contentStates.push({
                content: finalContent,
                title: iteration.title || `Iteration ${iteration.iterationNumber}`,
                iterationNumber: iteration.iterationNumber,
                isBugFix: !!iteration.contentBeforeBugFix
            });
        }
    });

    // State
    let hideDiff = false;

    // Sequential view button
    setTimeout(() => {
        const sequentialBtn = document.getElementById('sequential-view-button');
        if (sequentialBtn) {
            sequentialBtn.addEventListener('click', () => {
                openSequentialViewer(contentStates);
            });
        }

        const hideDiffBtn = document.getElementById('hide-diff-button');
        if (hideDiffBtn) {
            hideDiffBtn.addEventListener('click', () => {
                hideDiff = !hideDiff;

                // Update button appearance
                const icon = hideDiffBtn.querySelector('.material-symbols-outlined');
                const text = hideDiffBtn.querySelector('.button-text');
                if (icon && text) {
                    icon.textContent = hideDiff ? 'visibility' : 'visibility_off';
                    text.textContent = hideDiff ? 'Show Diff' : 'Hide Diff';
                }
                hideDiffBtn.classList.toggle('active', hideDiff);

                // Re-render columns
                scrollContainer.innerHTML = '';
                renderColumns(scrollContainer, contentStates, hideDiff);
            });
        }
    }, 0);

    if (contentStates.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'evolution-empty-message';
        emptyMessage.textContent = 'No iterations available to display.';
        scrollContainer.appendChild(emptyMessage);
    } else {
        renderColumns(scrollContainer, contentStates, hideDiff);
    }

    container.appendChild(scrollContainer);
    overlay.appendChild(container);

    // ESC handler
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeEvolutionViewer();
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    (overlay as any).cleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
    };

    document.body.appendChild(overlay);

    if (sessionId && contentHistory) {
        activeEvolutionViewers.set(sessionId, {
            scrollContainer,
            lastCount: contentHistory.length
        });

        const originalCleanup = (overlay as any).cleanup;
        (overlay as any).cleanup = () => {
            if (originalCleanup) originalCleanup();
            activeEvolutionViewers.delete(sessionId);
        };
    }

    setTimeout(() => {
        overlay.classList.add('visible');
    }, 10);
}

/**
 * Render columns with unified diff view (no scroll sync)
 */
function renderColumns(scrollContainer: HTMLElement, contentStates: ContentState[], hideDiff: boolean = false) {
    if (contentStates.length === 0) return;

    for (let colIndex = 0; colIndex < contentStates.length; colIndex++) {
        const column = document.createElement('div');
        column.className = 'evolution-column';

        // Header
        const header = document.createElement('div');
        header.className = 'evolution-column-header';
        const headerTitle = document.createElement('div');
        headerTitle.className = 'evolution-column-title';
        headerTitle.textContent = contentStates[colIndex].title;
        header.appendChild(headerTitle);
        column.appendChild(header);

        // Content
        const contentContainer = document.createElement('div');
        contentContainer.className = 'evolution-column-content';

        if (hideDiff) {
            // Plain rendered content (no diff)
            const renderedContainer = document.createElement('div');
            renderedContainer.className = 'evolution-rendered-content';
            renderedContainer.innerHTML = renderMathContent(contentStates[colIndex].content);
            contentContainer.appendChild(renderedContainer);
        } else {
            const pre = document.createElement('pre');
            const code = document.createElement('code');

            if (colIndex === 0) {
                // First column: show plain content
                const lines = contentStates[0].content.split('\n');
                lines.forEach(line => {
                    const lineDiv = document.createElement('div');
                    lineDiv.className = 'evolution-line';
                    const lineContent = document.createElement('span');
                    lineContent.className = 'evolution-line-content';
                    lineContent.textContent = line || ' ';
                    lineDiv.appendChild(lineContent);
                    code.appendChild(lineDiv);
                });
            } else {
                // Subsequent columns: show unified diff vs previous
                const prevContent = contentStates[colIndex - 1].content;
                const currContent = contentStates[colIndex].content;
                const diffs = Diff.diffLines(prevContent, currContent);

                diffs.forEach(part => {
                    const lines = part.value.split('\n');
                    lines.forEach((line, lineIndex) => {
                        // Skip trailing empty line from split
                        if (line === '' && lineIndex === lines.length - 1) return;

                        const lineDiv = document.createElement('div');
                        lineDiv.className = 'evolution-line';

                        if (part.added) {
                            lineDiv.classList.add('evolution-line-added');
                        } else if (part.removed) {
                            lineDiv.classList.add('evolution-line-removed');
                        }

                        const lineContent = document.createElement('span');
                        lineContent.className = 'evolution-line-content';
                        lineContent.textContent = line || ' ';
                        lineDiv.appendChild(lineContent);
                        code.appendChild(lineDiv);
                    });
                });
            }

            pre.appendChild(code);
            contentContainer.appendChild(pre);
        }

        column.appendChild(contentContainer);
        scrollContainer.appendChild(column);
    }
}

export function closeEvolutionViewer() {
    const overlay = document.getElementById('evolution-viewer-overlay');
    if (overlay) {
        if ((overlay as any).cleanup) {
            (overlay as any).cleanup();
        }
        overlay.classList.remove('visible');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}
