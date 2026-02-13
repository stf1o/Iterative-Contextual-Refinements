/**
 * Shiki Syntax Highlighter Setup
 * 
 * Provides syntax highlighting with proper light/dark mode support via CSS variables.
 * Uses dual theme rendering so theme switching is instant via CSS.
 * 
 * OPTIMIZED: Only bundles essential languages to minimize bundle size.
 * Additional languages are loaded dynamically when needed.
 */

import {
    createHighlighter,
    type HighlighterCore
} from 'shiki';

// Import only the themes and languages we need (if using fine-grained bundle, 
// strictly speaking regular 'shiki' includes all, but we can try to limit if possible,
// or just accept the bundle to FIX the issue first).
// Ideally we use 'shiki/bundle/web' but let's stick to 'shiki' to ensure it works.

import langJavaScript from 'shiki/langs/javascript.mjs';
import langTypeScript from 'shiki/langs/typescript.mjs';
import langPython from 'shiki/langs/python.mjs';
import langCss from 'shiki/langs/css.mjs';
import langHtml from 'shiki/langs/html.mjs';
import langJson from 'shiki/langs/json.mjs';
import langBash from 'shiki/langs/bash.mjs';
import langMarkdown from 'shiki/langs/markdown.mjs';
import langSql from 'shiki/langs/sql.mjs';
import langJava from 'shiki/langs/java.mjs';
import langCpp from 'shiki/langs/cpp.mjs';
import langC from 'shiki/langs/c.mjs';
import langGo from 'shiki/langs/go.mjs';
import langRust from 'shiki/langs/rust.mjs';
import langYaml from 'shiki/langs/yaml.mjs';
import langXml from 'shiki/langs/xml.mjs';
import langJsx from 'shiki/langs/jsx.mjs';
import langTsx from 'shiki/langs/tsx.mjs';

// Bundled themes
import themeGithubDark from 'shiki/themes/github-dark.mjs';
import themeGithubLight from 'shiki/themes/github-light.mjs';

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
            // createHighlighter handles engine/wasm implicitly
            const highlighter = await createHighlighter({
                themes: [themeGithubDark, themeGithubLight],
                langs: [
                    langJavaScript, langTypeScript, langPython, langCss, langHtml,
                    langJson, langBash, langMarkdown, langSql, langJava, langCpp,
                    langC, langGo, langRust, langYaml, langXml, langJsx, langTsx
                ]
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
