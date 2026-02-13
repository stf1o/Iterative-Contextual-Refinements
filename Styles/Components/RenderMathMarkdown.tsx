import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';
import { highlightCodeSync, isLanguageSupported, resolveLanguage } from '../Shiki';
import he from 'he';
import { nanoid } from 'nanoid';
import type { Root as HastRoot, Element as HastElement, Text as HastText } from 'hast';
import type { Code } from 'mdast';

// --- Types & Interfaces ---

declare global {
    interface Window {
        toggleCodeBlock: (codeId: string) => void;
        copyCodeBlock: (codeId: string) => Promise<void>;
        __codeblockEventsSetup?: boolean;
        __codeblockBusy?: Record<string, boolean>;
    }
}

// --- Constants & Config ---

// Shiki handles light/dark themes via CSS variables
// Themes are configured in Styles/Shiki.ts

const MAX_CODE_HIGHLIGHT_SIZE = 50000;

// --- Helper Functions ---

// Use battle-tested `he` library for HTML encoding/decoding
function escapeHtml(str: string): string {
    return he.encode(str, { useNamedReferences: true });
}

function decodeEntities(str: string): string {
    return he.decode(str);
}

// Use battle-tested `nanoid` for ID generation (cryptographically secure)
function generateCodeId(): string {
    return `code-${nanoid(9)}`;
}

// --- HTML Templates ---
// Template functions for consistent, maintainable HTML generation
// Note: These use template literals directly because we need to inject raw HTML 
// from Shiki. Libraries like vhtml escape content, which breaks syntax highlighting.

const COPY_ICON_SVG = `<span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>`;

interface CodeBlockOptions {
    codeId: string;
    language: string;
    displayLang: string;
    highlightedCode: string;  // Raw HTML from Shiki
    extraClass?: string;
}

function renderCodeBlockHtml({ codeId, language, displayLang, highlightedCode, extraClass = '' }: CodeBlockOptions): string {
    const isShikiBlock = highlightedCode.includes('<pre class="shiki');

    // If it's a Shiki block, it already contains <pre><code>...</code></pre> and styling
    // So we don't wrap it again
    const contentHtml = isShikiBlock
        ? highlightedCode
        : `<pre><code id="${escapeHtml(codeId)}" class="language-${escapeHtml(language)}">${highlightedCode}</code></pre>`;

    return `<div class="code-block-container ${extraClass}">
<div class="code-block-header">
<span class="code-block-title">${escapeHtml(displayLang)}</span>
<button class="code-copy-icon copy-code-btn" data-code-id="${escapeHtml(codeId)}" title="Copy code">${COPY_ICON_SVG}</button>
</div>
<div class="code-block-content">
${contentHtml}
</div>
</div>`;
}

interface OutputBlockOptions {
    title: string;
    content: string;  // Already escaped
    extraClass?: string;
}

function renderOutputBlockHtml({ title, content, extraClass = '' }: OutputBlockOptions): string {
    return `<div class="code-block-container exec-output-block ${extraClass}">
<div class="code-block-header">
<span class="code-block-title">${escapeHtml(title)}</span>
</div>
<div class="code-block-content exec-output-content">
<pre><code class="exec-output-text">${content}</code></pre>
</div>
</div>`;
}

interface ImageItemOptions {
    dataUrl: string;
    mimeType: string;
    formatLabel: string;
    estimatedSizeKB: number;
}

function renderImageItemHtml({ dataUrl, mimeType, formatLabel, estimatedSizeKB }: ImageItemOptions): string {
    return `<div class="exec-image-item" data-src="${escapeHtml(dataUrl)}" data-mime="${escapeHtml(mimeType)}" data-format="${escapeHtml(formatLabel)}" data-size="${estimatedSizeKB}">
<img src="${escapeHtml(dataUrl)}" alt="Generated visualization" class="exec-rendered-image" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'exec-image-error\\'>Failed to render image</div>';"/>
</div>`;
}

function renderImageGridHtml(imagesHtml: string): string {
    return `<div class="code-block-container exec-image-block">
<div class="code-block-header">
<span class="code-block-title">FIGURE</span>
</div>
<div class="exec-image-grid">${imagesHtml}</div>
</div>`;
}

function renderImageErrorHtml(errorMessage: string): string {
    return `<div class="exec-image-item exec-image-error-item">
<div class="exec-image-error">${escapeHtml(errorMessage)}</div>
</div>`;
}

// --- Theme Management ---

// highlight.js theme CSS is now bundled via index.css
// The github-dark theme is loaded by default
// Theme switching can be handled via CSS custom properties if needed
function loadHighlightTheme() {
    // No-op: themes are now statically bundled
    // Future enhancement: could toggle CSS classes for light/dark mode
}

// --- Event Listeners Setup ---

function setupGlobalEvents() {
    if (typeof window === 'undefined') return;

    // Theme observer
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.attributeName === 'class') {
                loadHighlightTheme();
                break;
            }
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    loadHighlightTheme();

    // Global toggle function
    window.toggleCodeBlock = function (codeId: string) {
        const codeContent = document.getElementById(codeId);
        const toggleBtn = document.getElementById(`toggle-${codeId}`);
        const container = codeContent?.closest('.code-block-container');

        if (!codeContent || !toggleBtn || !container) return;

        const isExpanded = codeContent.classList.contains('expanded');
        codeContent.classList.toggle('expanded', !isExpanded);
        codeContent.classList.toggle('collapsed', isExpanded);
        toggleBtn.classList.toggle('expanded', !isExpanded);
        container.classList.toggle('expanded', !isExpanded);
        container.classList.toggle('collapsed', isExpanded);
    };

    // Delegated click listener for copy buttons
    if (!window.__codeblockEventsSetup) {
        window.__codeblockBusy = {};

        document.addEventListener('click', async (ev) => {
            const target = ev.target as HTMLElement;
            const btn = target.closest('.copy-code-btn') as HTMLElement;

            if (!btn) return;

            const explicitId = btn.getAttribute('data-code-id') || '';
            let id = explicitId;

            if (!id) {
                const container = btn.closest('.code-block-container');
                const codeEl = container?.querySelector('.code-block-content code');
                if (codeEl) id = codeEl.id;
            }

            if (!id) return;

            const key = `copy:${id}`;
            if (window.__codeblockBusy?.[key]) return;

            if (window.__codeblockBusy) window.__codeblockBusy[key] = true;

            try {
                // Find code element
                let codeElement = document.getElementById(id);
                if (!codeElement) {
                    const container = btn.closest('.code-block-container');
                    codeElement = container?.querySelector('.code-block-content code') as HTMLElement | null;
                }

                if (codeElement) {
                    const codeText = codeElement.textContent || '';
                    await navigator.clipboard.writeText(codeText);

                    // Update Icon
                    const icon = btn.querySelector('.material-symbols-outlined');
                    if (icon) {
                        const originalText = icon.textContent;
                        icon.textContent = 'check';

                        setTimeout(() => {
                            icon.textContent = originalText;
                            if (window.__codeblockBusy) delete window.__codeblockBusy[key];
                        }, 1500);
                        return; // Exit here if successful and we're handling the cleanup in the timeout
                    }
                }
            } catch (err) {
                console.error('Copy failed:', err);
            }

            // Fallback cleanup if something went wrong or no icon found
            setTimeout(() => {
                if (window.__codeblockBusy) delete window.__codeblockBusy[key];
            }, 500);
        }, true);

        // Image Preview Modal
        window.addEventListener('exec-image-preview', ((e: CustomEvent<{ src: string; alt: string; mimeType?: string; format?: string }>) => {
            const { src, alt, format } = e.detail;
            if (!src) return;

            const formatLabel = format || 'PNG';

            const overlay = document.createElement('div');
            overlay.className = 'file-preview-modal-overlay';
            overlay.innerHTML = `
<div class="file-preview-modal">
    <div class="preview-modal-header">
        <div class="preview-file-info">
            <span class="material-symbols-outlined" style="color: #10b981">image</span>
            <span class="preview-file-name">Generated Figure</span>
            <span class="preview-file-badge" style="background-color: rgba(16, 185, 129, 0.13); color: #10b981">${escapeHtml(formatLabel)}</span>
        </div>
        <button class="preview-close-btn" title="Close (Esc)">
            <span class="material-symbols-outlined">close</span>
        </button>
    </div>
    <div class="preview-modal-content">
        <div class="preview-image-container">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(alt || 'Execution output')}" class="preview-image" />
        </div>
    </div>
</div>`;

            const closeModal = () => {
                overlay.style.animation = 'fadeIn 0.2s ease reverse';
                const modal = overlay.querySelector('.file-preview-modal') as HTMLElement;
                if (modal) modal.style.animation = 'scaleIn 0.2s ease reverse';
                setTimeout(() => overlay.remove(), 180);
                document.body.style.overflow = '';
                document.removeEventListener('keydown', escHandler);
            };

            const escHandler = (ev: KeyboardEvent) => {
                if (ev.key === 'Escape') closeModal();
            };

            overlay.addEventListener('click', (ev) => {
                if (ev.target === overlay) closeModal();
            });

            document.addEventListener('keydown', escHandler);
            document.body.style.overflow = 'hidden';
            document.body.appendChild(overlay);

            const closeBtn = overlay.querySelector('.preview-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    closeModal();
                });
            }

            const modal = overlay.querySelector('.file-preview-modal');
            if (modal) {
                modal.addEventListener('click', (ev) => ev.stopPropagation());
            }
        }) as EventListener);

        // Add click handlers for exec images (delegated)
        document.addEventListener('click', (ev) => {
            const target = ev.target as HTMLElement;
            const imageItem = target.closest('.exec-image-item') as HTMLElement;

            if (!imageItem) return;

            const src = imageItem.dataset.src || (imageItem.querySelector('img') as HTMLImageElement)?.src;
            const format = imageItem.dataset.format || 'PNG';

            if (src) {
                window.dispatchEvent(new CustomEvent('exec-image-preview', {
                    detail: { src, alt: 'Generated Figure', format }
                }));
            }
        });

        window.__codeblockEventsSetup = true;
    }
}

// --- Rendering Logic ---

// React hook to force re-render when highlighter is ready
import { useState, useEffect } from 'react';
import { onHighlighterReady, isHighlighterReady } from '../Shiki';

export function useHighlighting() {
    const [isReady, setIsReady] = useState(isHighlighterReady());

    useEffect(() => {
        if (isReady) return;
        return onHighlighterReady(() => setIsReady(true));
    }, [isReady]);

    return isReady;
}

function renderCompleteDocument(content: string, type: 'latex' | 'html'): string {
    const codeId = generateCodeId();
    const codeToHighlight = type === 'html' ? decodeEntities(content) : content;
    let highlightedCode = '';

    try {
        if (content.length <= MAX_CODE_HIGHLIGHT_SIZE && isLanguageSupported(type)) {
            highlightedCode = highlightCodeSync(codeToHighlight, type);
        } else {
            highlightedCode = escapeHtml(codeToHighlight);
        }
    } catch {
        highlightedCode = escapeHtml(codeToHighlight);
    }

    // If highlighter wasn't ready and we got plaintext, we rely on the parent component 
    // to re-render using the useHighlighting hook.

    const displayLang = type === 'latex' ? 'LATEX DOCUMENT' : 'HTML';
    const codeBlock = renderCodeBlockHtml({ codeId, language: type, displayLang, highlightedCode });

    return `<div class="rich-content-display"><div class="latex-content-wrapper"><div style="font-size: 1.4rem; line-height: 1.6;">${codeBlock}</div></div></div>`;
}

function renderCodeBlock(code: string, language: string): string {
    const codeId = generateCodeId();
    const validLang = language && isLanguageSupported(language) ? resolveLanguage(language) : 'plaintext';
    const cleanCode = decodeEntities(code);
    let highlightedCode = '';

    // Check if code already contains syntax highlighting output (from LLM copying previous output)
    // If so, skip re-highlighting to prevent double-escaping
    const alreadyHighlighted = /<span\s+class="(hljs-|shiki)/.test(cleanCode);

    if (alreadyHighlighted) {
        // Code already has highlighting spans - use as-is
        highlightedCode = cleanCode;
    } else if (cleanCode.length > MAX_CODE_HIGHLIGHT_SIZE) {
        highlightedCode = escapeHtml(cleanCode);
        console.warn(`Code block too large (${cleanCode.length} chars), skipping syntax highlighting`);
    } else {
        try {
            highlightedCode = highlightCodeSync(cleanCode, validLang);
        } catch {
            highlightedCode = escapeHtml(cleanCode);
        }
    }

    return renderCodeBlockHtml({
        codeId,
        language: validLang || 'text',
        displayLang: (language || 'Code').toUpperCase(),
        highlightedCode
    });
}

// --- Code Execution Block Rendering ---

let executionCellCounter = 0;

function renderCodeExecutionBlock(code: string, language: string, _cellNumber: number): string {
    const codeId = generateCodeId();
    const validLang = language && isLanguageSupported(language) ? resolveLanguage(language) : 'python';
    const cleanCode = decodeEntities(code);
    let highlightedCode = '';

    // Check if code already contains syntax highlighting output (from LLM copying previous output)
    const alreadyHighlighted = /<span\s+class="(hljs-|shiki)/.test(cleanCode);

    if (alreadyHighlighted) {
        highlightedCode = cleanCode;
    } else if (cleanCode.length > MAX_CODE_HIGHLIGHT_SIZE) {
        highlightedCode = escapeHtml(cleanCode);
    } else {
        try {
            highlightedCode = highlightCodeSync(cleanCode, validLang);
        } catch {
            highlightedCode = escapeHtml(cleanCode);
        }
    }

    return renderCodeBlockHtml({
        codeId,
        language: validLang,
        displayLang: validLang.toUpperCase(),
        highlightedCode,
        extraClass: 'exec-code-block'
    });
}

function renderExecutionOutputBlock(output: string, _cellNumber: number): string {
    const escapedOutput = escapeHtml(output);
    const hasError = output.toLowerCase().includes('error') ||
        output.toLowerCase().includes('traceback') ||
        output.toLowerCase().includes('exception');

    return renderOutputBlockHtml({
        title: hasError ? 'ERROR' : 'OUTPUT',
        content: escapedOutput,
        extraClass: hasError ? 'exec-output-error' : ''
    });
}

function renderExecutionImageBlock(base64Data: string, mimeType: string, _cellNumber: number): string {
    if (!base64Data || base64Data.trim() === '') {
        return renderImageErrorHtml('Empty image data received');
    }

    const normalizedMimeType = mimeType?.startsWith('image/') ? mimeType : 'image/png';
    const formatLabel = normalizedMimeType.replace('image/', '').toUpperCase();

    let dataUrl: string;
    if (base64Data.startsWith('data:')) {
        dataUrl = base64Data;
    } else {
        const base64Regex = /^[A-Za-z0-9+/=]+$/;
        const cleanBase64 = base64Data.replace(/\s/g, '');

        if (!base64Regex.test(cleanBase64)) {
            return renderImageErrorHtml('Invalid base64 encoding');
        }

        dataUrl = `data:${normalizedMimeType};base64,${cleanBase64}`;
    }

    const estimatedSizeKB = Math.round((base64Data.length * 3) / 4 / 1024);

    return renderImageItemHtml({ dataUrl, mimeType: normalizedMimeType, formatLabel, estimatedSizeKB });
}

// Store for pre-rendered HTML blocks that bypass the unified pipeline
let storedBlocks: string[] = [];

function preprocessCodeExecutionBlocks(content: string): { processed: string; blocks: string[] } {
    let processed = content;
    executionCellCounter = 0;
    storedBlocks = [];

    // Helper to store HTML and return placeholder
    const storePlaceholder = (html: string): string => {
        const idx = storedBlocks.length;
        storedBlocks.push(html);
        return `<!--STORED_BLOCK_${idx}-->`;
    };

    // Transform executed code blocks
    const codeExecPattern = /<!-- CODE_EXECUTION_START -->\s*\n?<!-- LANGUAGE: (\w+) -->\s*\n?```\w*\n([\s\S]*?)\n```\s*\n?<!-- CODE_EXECUTION_END -->/g;
    processed = processed.replace(codeExecPattern, (_, language, code) => {
        executionCellCounter++;
        const html = renderCodeExecutionBlock(code.trim(), language.toLowerCase(), executionCellCounter);
        return storePlaceholder(html);
    });

    // Transform execution output blocks
    let outputCounter = 0;
    const outputPattern = /<!-- EXECUTION_OUTPUT_START -->\s*\n?```\n?([\s\S]*?)\n?```\s*\n?<!-- EXECUTION_OUTPUT_END -->/g;
    processed = processed.replace(outputPattern, (_, output) => {
        outputCounter++;
        const html = renderExecutionOutputBlock(output.trim(), outputCounter);
        return storePlaceholder(html);
    });

    // Transform image blocks
    const imagePattern = /<!-- EXECUTION_IMAGE_START -->\s*\n?<!-- MIME_TYPE: ([^\s]+) -->\s*\n?([\s\S]*?)\n?<!-- EXECUTION_IMAGE_END -->/g;
    let imageCounter = 0;
    const imageHtmlParts: string[] = [];
    processed = processed.replace(imagePattern, (_, mimeType, base64Data) => {
        imageCounter++;
        const html = renderExecutionImageBlock(base64Data.trim(), mimeType, imageCounter);
        imageHtmlParts.push(html);
        return `<!--TEMP_IMG_${imageHtmlParts.length - 1}-->`;
    });

    // Wrap consecutive images in grid - replace temp markers with grid
    const consecutiveImagesPattern = /((?:<!--TEMP_IMG_\d+-->\s*)+)/g;
    processed = processed.replace(consecutiveImagesPattern, (match) => {
        const indices = [...match.matchAll(/<!--TEMP_IMG_(\d+)-->/g)].map(m => parseInt(m[1]));
        const imagesHtml = indices.map(i => imageHtmlParts[i]).join('');
        const gridHtml = renderImageGridHtml(imagesHtml);
        return storePlaceholder(gridHtml);
    });

    return { processed, blocks: storedBlocks };
}

// --- Unified Pipeline ---

function rehypeAddClasses() {
    return (tree: HastRoot) => {
        const visit = (node: HastRoot | HastElement | HastText) => {
            if (node.type === 'element') {
                const element = node as HastElement;

                if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tagName)) {
                    const level = parseInt(element.tagName[1]);
                    const existingClass = (element.properties?.className as string[] || []).join(' ');
                    const levelClass = level <= 3 ? `token-heading${level}` : '';
                    element.properties = element.properties || {};
                    element.properties.className = `token-heading ${levelClass} ${existingClass}`.trim().split(' ').filter(Boolean);
                }

                if (element.tagName === 'strong') {
                    element.properties = element.properties || {};
                    const existingClass = (element.properties.className as string[] || []);
                    element.properties.className = [...existingClass, 'token-critical'];
                }

                if (element.children) {
                    element.children.forEach(child => visit(child as HastElement));
                }
            }
        };

        tree.children.forEach(child => visit(child as HastElement));
    };
}

function createProcessor() {
    return unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkGfm)
        .use(remarkRehype, {
            allowDangerousHtml: true,
            handlers: {
                code(_state: unknown, node: Code) {
                    // Return raw HTML - let rehypeRaw parse it into HAST
                    return {
                        type: 'raw',
                        value: renderCodeBlock(node.value, node.lang || '')
                    };
                }
            }
        })
        // Parse raw HTML nodes back into hast so they're properly rendered
        // This is essential for highlight.js HTML to not be escaped
        .use(rehypeRaw)
        .use(rehypeKatex, {
            throwOnError: false,
            trust: true,
            strict: false
        })
        // Note: We intentionally don't use rehype-highlight here.
        // Code blocks are highlighted manually in renderCodeBlock() using hljs.highlight().
        // Using both would cause conflicts and potential nested code block detection issues.
        .use(rehypeAddClasses)
        .use(rehypeStringify, {
            allowDangerousHtml: true
        });
}

let cachedProcessor: ReturnType<typeof createProcessor> | null = null;

function getProcessor() {
    if (!cachedProcessor) {
        cachedProcessor = createProcessor();
    }
    return cachedProcessor;
}

// --- LaTeX Detection & Conversion ---

/**
 * Detect if content contains LaTeX math by looking for:
 * 1. Backslash followed by alphabetic characters (LaTeX commands like \frac, \alpha, etc.)
 * 2. Common math notation patterns (subscripts, superscripts with braces)
 * 
 * This is more robust than listing individual commands as it catches:
 * - All Greek letters (\alpha, \beta, etc.)
 * - All operators (\frac, \sum, \int, etc.)
 * - All arrows (\to, \rightarrow, etc.)
 * - All delimiters (\left, \right, etc.)
 * - User-defined macros
 */
const LATEX_COMMAND_PATTERN = /\\[a-zA-Z]+/;

/**
 * Additional patterns that indicate math content even without backslash commands:
 * - Subscripts/superscripts with braces: x_{n}, x^{2}
 * - Curly brace groups that suggest math: {n+1}
 */
const MATH_NOTATION_PATTERNS = [
    /[_^]\{[^}]+\}/,  // Subscripts/superscripts with braces: x_{n}, x^{2}
    /\\[{}]/,          // Escaped braces: \{ \}
];

/**
 * Check if content contains LaTeX math that should be rendered.
 * Uses pattern-based detection rather than an exhaustive command list.
 */
function containsLatexMath(content: string): boolean {
    // Primary check: LaTeX commands (\word)
    if (LATEX_COMMAND_PATTERN.test(content)) {
        return true;
    }
    // Secondary check: math notation patterns
    return MATH_NOTATION_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Convert inline code blocks containing LaTeX to proper math delimiters.
 * This allows remark-math to recognize and render them as math.
 * 
 * Transforms: `\frac{1}{2}` -> $\frac{1}{2}$
 * But keeps regular code: `const x = 1` unchanged
 */
function convertBacktickedLatexToMath(content: string): string {
    // Match inline code blocks (single backticks, not triple)
    // Negative lookbehind/lookahead ensures we don't match code fences (```)
    return content.replace(/(?<!`)`([^`]+)`(?!`)/g, (match, codeContent) => {
        // Check if this inline code contains LaTeX math commands
        if (containsLatexMath(codeContent)) {
            // Convert to inline math: $...$
            return `$${codeContent}$`;
        }
        // Not math - keep as code
        return match;
    });
}

// --- Main Render Function ---

function renderMathContent(content: string): string {
    if (!content) return '';

    // Pre-process: convert backticked LaTeX to proper math delimiters
    const mathConvertedContent = convertBacktickedLatexToMath(content);

    // Pre-process Code Execution Blocks - returns placeholders and stored HTML
    const { processed: preprocessedContent, blocks } = preprocessCodeExecutionBlocks(mathConvertedContent);

    // Detect Complete Documents (Early Exit)
    const trimmed = preprocessedContent.trim();
    if (trimmed.startsWith('\\documentclass') || (trimmed.includes('\\begin{document}') && trimmed.includes('\\end{document}'))) {
        return renderCompleteDocument(preprocessedContent, 'latex');
    }
    if (trimmed.startsWith('<!DOCTYPE html>') || (trimmed.startsWith('<html') && trimmed.includes('</html>'))) {
        return renderCompleteDocument(preprocessedContent, 'html');
    }

    // Process with Unified Pipeline
    const processor = getProcessor();
    let resultHtml: string;

    try {
        const result = processor.processSync(preprocessedContent);
        resultHtml = String(result);
    } catch (error) {
        console.error('Unified processing error:', error);
        resultHtml = `<pre>${escapeHtml(preprocessedContent)}</pre>`;
    }

    // Replace placeholders with stored HTML BEFORE sanitization
    // This ensures the pre-rendered HTML bypasses the unified pipeline completely
    blocks.forEach((html, idx) => {
        resultHtml = resultHtml.replace(`<!--STORED_BLOCK_${idx}-->`, html);
    });

    // Sanitize
    resultHtml = DOMPurify.sanitize(resultHtml, {
        ADD_TAGS: [
            'div', 'span', 'pre', 'code',
            'math', 'annotation', 'semantics', 'mrow', 'mn', 'mo', 'mi', 'msup', 'msub', 'mfrac',
            'mtext', 'mspace', 'msqrt', 'mroot', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd',
            'table', 'tr', 'td', 'th', 'tbody', 'thead', 'caption', 'colgroup', 'col',
            'svg', 'polygon', 'polyline', 'line', 'rect', 'path', 'circle', 'g', 'defs', 'use', 'symbol',
            'img', 'del', 's', 'input'
        ],
        ADD_ATTR: [
            'class', 'style', 'title', 'id',
            'data-code-id', 'data-cell-number',
            'data-src', 'data-mime', 'data-format', 'data-size',
            'viewBox', 'd', 'fill', 'stroke', 'stroke-width',
            'x', 'y', 'width', 'height', 'rx', 'ry',
            'points', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
            'xmlns', 'xmlns:xlink', 'xlink:href', 'transform',
            'src', 'alt', 'loading',
            'align', 'valign', 'colspan', 'rowspan',
            'type', 'checked', 'disabled'
        ],
        ADD_URI_SCHEMES: ['data'],
        RETURN_TRUSTED_TYPE: false
    } as any) as unknown as string;

    return `<div class="rich-content-display"><div class="latex-content-wrapper" style="font-size: 1.4rem; line-height: 1.6;">${resultHtml}</div></div>`;
}

// --- Exports ---

if (typeof window !== 'undefined') {
    setupGlobalEvents();
}

export function createRenderMathMarkdownElement(content: string, className: string = ''): HTMLElement {
    const div = document.createElement('div');
    div.className = `render-math-markdown ${className}`;
    div.innerHTML = renderMathContent(content);
    return div;
}

export function renderMathContentIntoElement(element: HTMLElement, content: string): void {
    element.innerHTML = renderMathContent(content);
}

export { renderMathContent };
export default renderMathContent;