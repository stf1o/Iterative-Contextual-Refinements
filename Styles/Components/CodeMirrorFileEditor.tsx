/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import CodeMirror, { Extension } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import './CodeMirrorFileEditor.css';

// --- Types & Interfaces ---

export interface ParsedFile {
    path: string;
    content: string;
    language?: string;
}

interface FileTreeNode {
    name: string;
    path: string;
    isFolder: boolean;
    children?: FileTreeNode[];
    content?: string;
    language?: string;
}

interface CodeMirrorFileEditorProps {
    content: string;
    onContentChange?: (content: string) => void;
    onDownload?: () => void;
    onViewEvolutions?: () => void;
    readOnly?: boolean;
    forceDarkTheme?: boolean;
}

// --- Utilities (Pure Functions) ---

const getLanguageExtension = (path: string): Extension[] => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return [javascript({ jsx: true, typescript: true })];
        case 'html':
            return [html()];
        case 'css':
            return [css()];
        case 'json':
            return [json()];
        case 'md':
        case 'markdown':
        case 'txt':
            return [markdown()];
        case 'py':
            return [python()];
        default:
            return [];
    }
};

const parseAggregatedCode = (code: string): ParsedFile[] => {
    const files: ParsedFile[] = [];
    const fileMarkerRegex = /^\/\/\s*---\s*FILE:\s*(.*?)\s*---\s*$/gm;
    const parts = code.split(fileMarkerRegex);

    for (let i = 1; i < parts.length; i += 2) {
        const filePath = parts[i].trim();
        const content = parts[i + 1]?.trim() || '';

        if (content) {
            files.push({
                path: filePath,
                content,
                language: filePath.split('.').pop()?.toLowerCase()
            });
        }
    }

    if (files.length === 0 && code.trim()) {
        files.push({ path: 'main.tsx', content: code, language: 'typescript' });
    }

    return files;
};

const aggregateFiles = (files: ParsedFile[]): string => {
    return files.map(f => `// --- FILE: ${f.path} ---\n${f.content}\n`).join('\n').trim();
};

const buildFileTree = (files: ParsedFile[]): FileTreeNode[] => {
    const root: FileTreeNode = { name: 'root', path: '', isFolder: true, children: [] };

    files.forEach(file => {
        const parts = file.path.split('/');
        let current = root;

        parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;
            const currentPath = parts.slice(0, index + 1).join('/');

            if (!current.children) current.children = [];

            if (isLast) {
                current.children.push({
                    name: part,
                    path: currentPath,
                    isFolder: false,
                    content: file.content,
                    language: file.language
                });
            } else {
                let folder = current.children.find(c => c.name === part && c.isFolder);
                if (!folder) {
                    folder = { name: part, path: currentPath, isFolder: true, children: [] };
                    current.children.push(folder);
                }
                current = folder;
            }
        });
    });

    return root.children || [];
};

// --- Sub-Components ---

const FileIcon = memo(({ name, isFolder, isDark }: { name: string, isFolder: boolean, isDark: boolean }) => {
    if (isFolder) {
        return <span className="material-symbols-outlined folder-icon">folder</span>;
    }

    const getIconData = () => {
        const ext = name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'tsx': case 'ts': return { icon: 'code', color: isDark ? '#4ec9b0' : '#0084ce' };
            case 'jsx': case 'js': return { icon: 'javascript', color: '#f0db4f' };
            case 'css': return { icon: 'css', color: '#563d7c' };
            case 'html': return { icon: 'html', color: '#e34c26' };
            case 'json': return { icon: 'data_object', color: isDark ? '#cbcb41' : '#b07219' };
            case 'md': case 'txt': return { icon: 'description', color: isDark ? '#969696' : '#616161' };
            default: return { icon: 'insert_drive_file', color: isDark ? '#969696' : '#616161' };
        }
    };

    const { icon, color } = getIconData();
    return <span className="material-symbols-outlined file-icon" style={{ color }}>{icon}</span>;
});

const FileTreeItem = memo(({ node, level, selectedPath, onSelect, isDark }: {
    node: FileTreeNode,
    level: number,
    selectedPath: string,
    onSelect: (path: string) => void,
    isDark: boolean
}) => {
    const isSelected = !node.isFolder && selectedPath === node.path;
    const style = { paddingLeft: `${level * 12 + 8}px` };

    if (node.isFolder) {
        return (
            <div className="file-tree-group">
                <div className="file-tree-item folder" style={style}>
                    <FileIcon name={node.name} isFolder={true} isDark={isDark} />
                    <span className="file-name">{node.name}</span>
                </div>
                {node.children?.map((child, idx) => (
                    <FileTreeItem
                        key={`${child.path}-${idx}`}
                        node={child}
                        level={level + 1}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        isDark={isDark}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`file-tree-item file ${isSelected ? 'selected' : ''}`}
            style={style}
            onClick={() => onSelect(node.path)}
            title={node.path}
        >
            <FileIcon name={node.name} isFolder={false} isDark={isDark} />
            <span className="file-name">{node.name}</span>
        </div>
    );
});

const EmptyState = () => (
    <div className="cm-empty-state">
        <p>No code available</p>
    </div>
);

// --- Main Component ---

export const CodeMirrorFileEditor: React.FC<CodeMirrorFileEditorProps> = ({
    content,
    onContentChange,
    onDownload,
    onViewEvolutions,
    readOnly = false,
    forceDarkTheme = false
}) => {
    const [files, setFiles] = useState<ParsedFile[]>([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [isDark, setIsDark] = useState(forceDarkTheme);

    // Initial parsing
    useEffect(() => {
        setFiles(parseAggregatedCode(content));
        // Reset selection if content changes significantly? 
        // Logic kept simple: try to keep index valid, or reset to 0
        setSelectedFileIndex(prev => {
            if (prev >= parseAggregatedCode(content).length) return 0;
            return prev;
        });
    }, [content]);

    // Dark mode detection
    useEffect(() => {
        if (forceDarkTheme) {
            setIsDark(true);
            return;
        }

        const checkTheme = () => {
            const isDarkMode = !document.body.classList.contains('light-mode');
            setIsDark(isDarkMode);
        };

        checkTheme();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => m.attributeName === 'class' && checkTheme());
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, [forceDarkTheme]);

    // Handlers
    const handleFileSelect = useCallback((path: string) => {
        const index = files.findIndex(f => f.path === path);
        if (index >= 0) setSelectedFileIndex(index);
    }, [files]);

    const handleEditorChange = useCallback((value: string) => {
        if (!readOnly) {
            setFiles(prev => {
                const newFiles = [...prev];
                newFiles[selectedFileIndex] = { ...newFiles[selectedFileIndex], content: value };
                if (onContentChange) {
                    onContentChange(aggregateFiles(newFiles));
                }
                return newFiles;
            });
        }
    }, [selectedFileIndex, onContentChange, readOnly]);

    // Memoized Tree
    const fileTree = useMemo(() => buildFileTree(files), [files]);
    const currentFile = files[selectedFileIndex];

    if (files.length === 0) return <EmptyState />;

    return (
        <div className="cm-file-editor-container-optimized">
            {/* Sidebar */}
            <div className="cm-sidebar">
                <div className="cm-sidebar-header">
                    <span className="material-symbols-outlined icon">folder_open</span>
                    <span>EXPLORER</span>
                </div>

                <div className="cm-file-tree custom-scrollbar">
                    {fileTree.map((node, i) => (
                        <FileTreeItem
                            key={`${node.path}-${i}`}
                            node={node}
                            level={0}
                            selectedPath={currentFile?.path || ''}
                            onSelect={handleFileSelect}
                            isDark={isDark}
                        />
                    ))}
                </div>

                <div className="cm-sidebar-actions">
                    {onViewEvolutions && (
                        <button
                            onClick={onViewEvolutions}
                            className="button primary-action"
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                padding: '0.6rem 0.8rem',
                                fontSize: '0.75rem'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                            <span className="button-text" style={{ whiteSpace: 'nowrap' }}>Evolutions</span>
                        </button>
                    )}
                    {onDownload && (
                        <button
                            onClick={onDownload}
                            className="button primary-action"
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                padding: '0.6rem 0.8rem',
                                fontSize: '0.75rem'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                            <span className="button-text" style={{ whiteSpace: 'nowrap' }}>Download</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="cm-editor-area">
                <div className="cm-tab-bar">
                    {currentFile && (
                        <div className="cm-active-tab">
                            <FileIcon name={currentFile.path} isFolder={false} isDark={isDark} />
                            <span className="tab-filename">{currentFile.path.split('/').pop()}</span>
                            {readOnly && <span className="readonly-badge">READ ONLY</span>}
                        </div>
                    )}
                </div>

                <div className="cm-editor-wrapper">
                    {currentFile && (
                        <CodeMirror
                            value={currentFile.content}
                            height="100%"
                            theme={isDark ? vscodeDark : 'light'}
                            extensions={getLanguageExtension(currentFile.path)}
                            onChange={handleEditorChange}
                            readOnly={readOnly}
                            className="cm-theme"
                            basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                highlightActiveLine: true,
                                closeBrackets: true,
                                autoCloseTags: true,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CodeMirrorFileEditor;
