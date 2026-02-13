/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSON5 from 'json5';
import { parse as parseLossless } from 'lossless-json';

/**
 * JSON parsing utilities for AI outputs and data processing
 */

/**
 * Safely parse JSON with multiple fallback strategies for AI-generated content
 * @param raw - Raw string to parse
 * @param context - Context description for error logging
 * @returns Parsed JSON object or throws error
 */
export function parseJsonSafe(raw: string, context: string): any {
    if (!raw || typeof raw !== 'string') {
        throw new Error(`Invalid input for ${context}: ${typeof raw}`);
    }

    // Strip fences/formatting
    const cleaned = cleanJsonOutput(raw);

    // Try native JSON.parse first (fastest, handles strict JSON)
    try {
        return JSON.parse(cleaned);
    } catch {
        // Fallback to JSON5 for relaxed JSON (trailing commas, unquoted keys, single quotes)
        try {
            return JSON5.parse(cleaned);
        } catch (e) {
            console.warn(`JSON parse failed in ${context}. Error:`, e);
            throw e;
        }
    }
}

/**
 * Parse JSON ensuring numeric precision using lossless-json
 * Use this when you expect large numbers that standard JS numbers can't handle.
 * @param raw - Raw string to parse
 * @returns Parsed JSON object with potentially special number types
 */
export function parseJsonLossless(raw: string): any {
    const cleaned = cleanJsonOutput(raw);
    return parseLossless(cleaned);
}


/**
 * Clean JSON output by removing markdown fences and fixing common formatting issues
 * @param jsonString - Raw JSON string to clean
 * @returns Cleaned JSON string
 */
export function cleanJsonOutput(jsonString: string): string {
    if (!jsonString || typeof jsonString !== 'string') return jsonString;

    let cleaned = jsonString.trim();

    // Remove markdown code block fences if present
    if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
        const lines = cleaned.split('\n');
        // Remove first line (```json or ```)
        lines.shift();
        // Remove last line if it's just ```
        if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
            lines.pop();
        }
        cleaned = lines.join('\n').trim();
    }

    // Also remove trailing/leading ``` if regex is preferred or fences are not on new lines
    cleaned = cleaned.replace(/^```[\w]*\s*/, '').replace(/\s*```$/, '');

    // Handle extraction of JSON object/array from larger text
    // (This is still useful because LLMs often chatter before/after JSON)
    const arrayStart = cleaned.indexOf('[');
    const objectStart = cleaned.indexOf('{');

    let jsonStart = -1;
    let jsonEnd = -1;

    // Determine which comes first: array or object
    if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
        jsonStart = arrayStart;
        jsonEnd = cleaned.lastIndexOf(']'); // Match [ with ]
    } else if (objectStart !== -1) {
        jsonStart = objectStart;
        jsonEnd = cleaned.lastIndexOf('}'); // Match { with }
    }

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    // Convert Python-style triple-quoted strings to valid JSON strings
    // (Neither JSON nor JSON5 support triple quotes, this is an LLM quirk)
    cleaned = cleaned.replace(/"""([\s\S]*?)"""/g, (_m, inner: string) => JSON.stringify(inner));
    cleaned = cleaned.replace(/'''([\s\S]*?)'''/g, (_m, inner: string) => JSON.stringify(inner));

    return cleaned;
}