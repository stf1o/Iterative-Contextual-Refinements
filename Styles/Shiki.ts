/**
 * Shiki Syntax Highlighter Setup
 * 
 * Provides syntax highlighting with proper light/dark mode support via CSS variables.
 * Uses dual theme rendering so theme switching is instant via CSS.
 * 
 * OPTIMIZED: Only bundles essential languages to minimize bundle size.
 * Additional languages are loaded dynamically when needed.
 */

import { createBundledHighlighter, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

// Fine-grained bundle: only load the languages + themes we explicitly list.
const createHighlighter = createBundledHighlighter({
    langs: {
        javascript: () => import('shiki/langs/javascript.mjs'),
        typescript: () => import('shiki/langs/typescript.mjs'),
        python: () => import('shiki/langs/python.mjs'),
        css: () => import('shiki/langs/css.mjs'),
        html: () => import('shiki/langs/html.mjs'),
        json: () => import('shiki/langs/json.mjs'),
        bash: () => import('shiki/langs/bash.mjs'),
        markdown: () => import('shiki/langs/markdown.mjs'),
        sql: () => import('shiki/langs/sql.mjs'),
        java: () => import('shiki/langs/java.mjs'),
        cpp: () => import('shiki/langs/cpp.mjs'),
        c: () => import('shiki/langs/c.mjs'),
        go: () => import('shiki/langs/go.mjs'),
        rust: () => import('shiki/langs/rust.mjs'),
        yaml: () => import('shiki/langs/yaml.mjs'),
        xml: () => import('shiki/langs/xml.mjs'),
        jsx: () => import('shiki/langs/jsx.mjs'),
        tsx: () => import('shiki/langs/tsx.mjs')
    },
    themes: {
        'github-dark': () => import('shiki/themes/github-dark.mjs'),
        'github-light': () => import('shiki/themes/github-light.mjs')
    },
    // Use JS regex engine to avoid wasm loading requirements in the browser.
    engine: () => createJavaScriptRegexEngine()
});

// Singleton highlighter instance
let highlighterInstance: HighlighterCore | null = null;
let initPromise: Promise<HighlighterCore> | null = null;
const readinessListeners: (() => void)[] = [];

// Language aliases for common variations
const LANGUAGE_ALIASES: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'sh': 'bash',
    'shell': 'bash',
    'md': 'markdown',
    'yml': 'yaml',
    'c++': 'cpp',
    'cs': 'csharp',
    'text': 'plaintext',
    'txt': 'plaintext'
};

// Languages we bundle
const BUNDLED_LANGUAGES = [
    'javascript', 'typescript', 'python', 'css', 'html', 'json',
    'bash', 'markdown', 'sql', 'java', 'cpp', 'c', 'go', 'rust',
    'yaml', 'xml', 'jsx', 'tsx'
];

/**
 * Initialize the Shiki highlighter with dual themes for light/dark mode
 */
export async function initHighlighter(): Promise<HighlighterCore> {
    if (highlighterInstance) return highlighterInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const highlighter = await createHighlighter({
                themes: ['github-dark', 'github-light'],
                langs: [...BUNDLED_LANGUAGES]
            });
            highlighterInstance = highlighter as HighlighterCore; // Cast to Core type
            // Notify listeners
            readinessListeners.forEach(l => l());
            readinessListeners.length = 0;
            return highlighter as HighlighterCore;
        } catch (error) {
            console.error('Failed to initialize Shiki:', error);
            initPromise = null; // Allow retry
            throw error;
        }
    })();

    return initPromise;
}

/**
 * Subscribe to highlighter readiness (for re-rendering components)
 */
export function onHighlighterReady(callback: () => void): () => void {
    if (highlighterInstance) {
        callback();
        return () => { };
    }
    readinessListeners.push(callback);
    return () => {
        const idx = readinessListeners.indexOf(callback);
        if (idx !== -1) readinessListeners.splice(idx, 1);
    };
}

/**
 * Get the highlighter instance (must be initialized first)
 */
export function getHighlighter(): HighlighterCore | null {
    return highlighterInstance;
}

/**
 * Check if highlighter is ready
 */
export function isHighlighterReady(): boolean {
    return highlighterInstance !== null;
}

/**
 * Resolve language alias to actual language name
 */
export function resolveLanguage(lang: string): string {
    const lowered = lang.toLowerCase();
    return LANGUAGE_ALIASES[lowered] || (BUNDLED_LANGUAGES.includes(lowered) ? lowered : 'plaintext');
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lang: string): boolean {
    const lowered = lang.toLowerCase();
    return LANGUAGE_ALIASES[lowered] !== undefined || BUNDLED_LANGUAGES.includes(lowered);
}

/**
 * Highlight code with dual themes (light + dark)
 * Returns HTML with CSS variables for instant theme switching
 */
export function highlightCode(code: string, lang: string = 'plaintext'): string {
    if (!highlighterInstance) {
        // Init in background if not started
        if (!initPromise) initHighlighter().catch(console.error);
        // Fallback: return simple pre/code
        return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    }

    const resolvedLang = resolveLanguage(lang);

    // If language not loaded, use plaintext
    const availableLangs = highlighterInstance.getLoadedLanguages();
    const langToUse = availableLangs.includes(resolvedLang) ? resolvedLang : 'plaintext';

    try {
        return highlighterInstance.codeToHtml(code, {
            lang: langToUse,
            themes: {
                light: 'github-light',
                dark: 'github-dark'
            },
            defaultColor: false
        });
    } catch (error) {
        console.warn(`Shiki highlighting failed for language "${lang}":`, error);
        return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    }
}

/**
 * Highlight code synchronously (returns escaped text if not ready)
 */
export function highlightCodeSync(code: string, lang: string = 'plaintext'): string {
    return highlightCode(code, lang);
}

/**
 * Highlight code asynchronously (ensures highlighter is initialized)
 */
export async function highlightCodeAsync(code: string, lang: string = 'plaintext'): Promise<string> {
    await initHighlighter();
    return highlightCode(code, lang);
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Auto-initialize on module load (non-blocking)
if (typeof window !== 'undefined') {
    initHighlighter().catch(err => {
        console.error('Failed to initialize Shiki highlighter:', err);
    });
}

export default {
    initHighlighter,
    getHighlighter,
    isHighlighterReady,
    highlightCode,
    highlightCodeSync,
    highlightCodeAsync,
    resolveLanguage,
    isLanguageSupported,
    onHighlighterReady
};
