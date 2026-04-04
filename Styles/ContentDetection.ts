const HTML_DOCUMENT_PATTERN = /<(?:!doctype|html|head|body|title|meta|link|style|script)\b/i;
const HTML_TAG_PATTERN = /<([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?>/;
const HTML_CLOSING_TAG_PATTERN = /<\/([a-zA-Z][\w:-]*)>/;
const MARKDOWN_BLOCK_PATTERN = /^(?:#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|```|~~~|>\s)/m;

function hasHtmlTagPair(content: string): boolean {
    return HTML_TAG_PATTERN.test(content) && HTML_CLOSING_TAG_PATTERN.test(content);
}

export function isHTMLContent(content: string): boolean {
    const trimmed = content.trim();

    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        return false;
    }

    if (!trimmed.startsWith('<') && !trimmed.startsWith('<!DOCTYPE')) {
        return false;
    }

    if (!HTML_DOCUMENT_PATTERN.test(trimmed) && !hasHtmlTagPair(trimmed)) {
        return false;
    }

    if (MARKDOWN_BLOCK_PATTERN.test(trimmed) && !trimmed.startsWith('<')) {
        return false;
    }

    if (typeof DOMParser === 'undefined') {
        return true;
    }

    const parsed = new DOMParser().parseFromString(trimmed, 'text/html');
    const topLevelNodes = Array.from(parsed.body.childNodes).filter((node) => (
        node.nodeType !== Node.TEXT_NODE || node.textContent?.trim()
    ));
    const hasTopLevelElement = topLevelNodes.some((node) => node.nodeType === Node.ELEMENT_NODE);
    const hasDocumentStructure = HTML_DOCUMENT_PATTERN.test(trimmed);

    return hasDocumentStructure || hasTopLevelElement;
}
