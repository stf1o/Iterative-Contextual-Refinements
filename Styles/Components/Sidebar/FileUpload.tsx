import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { globalState } from '../../../Core/State';
import './FileUpload.css';

// Supported file types with their icons and colors
const FILE_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    // Images
    'image/png': { icon: 'image', color: '#10b981', label: 'PNG' },
    'image/jpeg': { icon: 'image', color: '#10b981', label: 'JPG' },
    'image/gif': { icon: 'gif', color: '#8b5cf6', label: 'GIF' },
    'image/webp': { icon: 'image', color: '#10b981', label: 'WEBP' },
    // Documents
    'application/pdf': { icon: 'picture_as_pdf', color: '#ef4444', label: 'PDF' },
    'text/plain': { icon: 'description', color: '#6b7280', label: 'TXT' },
    'text/html': { icon: 'code', color: '#f97316', label: 'HTML' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'description', color: '#3b82f6', label: 'DOCX' },
    // Spreadsheets
    'text/csv': { icon: 'table_chart', color: '#22c55e', label: 'CSV' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'table_chart', color: '#22c55e', label: 'XLSX' },
    // Code files
    'text/x-python': { icon: 'code', color: '#3776ab', label: 'PY' },
    'application/x-python': { icon: 'code', color: '#3776ab', label: 'PY' },
    'text/javascript': { icon: 'javascript', color: '#f7df1e', label: 'JS' },
    'application/javascript': { icon: 'javascript', color: '#f7df1e', label: 'JS' },
    'text/x-c++src': { icon: 'code', color: '#00599c', label: 'CPP' },
    'application/json': { icon: 'data_object', color: '#6b7280', label: 'JSON' },
    // Video
    'video/mp4': { icon: 'movie', color: '#a855f7', label: 'MP4' },
    'video/webm': { icon: 'movie', color: '#a855f7', label: 'WEBM' },
    'video/quicktime': { icon: 'movie', color: '#a855f7', label: 'MOV' },
};

const ACCEPTED_FILES = [
    'image/*',
    '.pdf', '.txt', '.html', '.docx',
    '.csv', '.xlsx',
    '.py', '.js', '.cpp', '.json',
    '.mp4', '.webm', '.mov'
].join(',');

const SIZE_WARNING_THRESHOLD = 15 * 1024 * 1024;

interface FileData {
    base64: string;
    mimeType: string;
    name: string;
    size: number;
}

// File Preview Modal Component
const FilePreviewModal: React.FC<{
    file: FileData;
    onClose: () => void;
}> = ({ file, onClose }) => {
    const isImage = file.mimeType.startsWith('image/');
    const isVideo = file.mimeType.startsWith('video/');
    const isPdf = file.mimeType === 'application/pdf';
    const isText = file.mimeType.startsWith('text/') || file.mimeType === 'application/json';
    const config = FILE_TYPE_CONFIG[file.mimeType] || { icon: 'insert_drive_file', color: '#6b7280', label: 'FILE' };

    // Keyboard handler for Escape
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    // Decode base64 for text files
    const getTextContent = () => {
        try {
            return atob(file.base64);
        } catch {
            return 'Unable to decode file content';
        }
    };

    return (
        <div className="file-preview-modal-overlay" onClick={onClose}>
            <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="preview-modal-header">
                    <div className="preview-file-info">
                        <span
                            className="material-symbols-outlined"
                            style={{ color: config.color }}
                        >
                            {config.icon}
                        </span>
                        <span className="preview-file-name">{file.name}</span>
                        <span className="preview-file-badge" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                            {config.label}
                        </span>
                    </div>
                    <button className="preview-close-btn" onClick={onClose} title="Close (Esc)">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="preview-modal-content">
                    {isImage && (
                        <div className="preview-image-container">
                            <img
                                src={`data:${file.mimeType};base64,${file.base64}`}
                                alt={file.name}
                                className="preview-image"
                            />
                        </div>
                    )}

                    {isVideo && (
                        <video
                            src={`data:${file.mimeType};base64,${file.base64}`}
                            controls
                            autoPlay
                            className="preview-video"
                        />
                    )}

                    {isPdf && (
                        <iframe
                            src={`data:${file.mimeType};base64,${file.base64}`}
                            className="preview-pdf"
                            title={file.name}
                        />
                    )}

                    {isText && (
                        <pre className="preview-code">
                            <code>{getTextContent()}</code>
                        </pre>
                    )}

                    {!isImage && !isVideo && !isPdf && !isText && (
                        <div className="preview-unsupported">
                            <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: config.color }}>
                                {config.icon}
                            </span>
                            <p>Preview not available for this file type</p>
                            <a
                                href={`data:${file.mimeType};base64,${file.base64}`}
                                download={file.name}
                                className="preview-download-btn"
                            >
                                <span className="material-symbols-outlined">download</span>
                                Download File
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const FileUpload: React.FC = () => {
    const [files, setFiles] = useState<FileData[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [totalSize, setTotalSize] = useState(0);
    const [previewFile, setPreviewFile] = useState<FileData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFiles = useCallback((fileList: FileList | File[]) => {
        Array.from(fileList).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const matches = result.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const base64 = matches[2];

                    const newFile: FileData = {
                        mimeType,
                        base64,
                        name: file.name,
                        size: file.size
                    };

                    setFiles(prev => {
                        const updated = [...prev, newFile];
                        globalState.currentProblemImages = updated;
                        const newTotal = updated.reduce((sum, f) => sum + f.size, 0);
                        setTotalSize(newTotal);
                        return updated;
                    });
                }
            };
            reader.readAsDataURL(file);
        });
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            processFiles(event.target.files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files?.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    }, [processFiles]);

    const removeFile = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setFiles(prev => {
            const updated = prev.filter((_, i) => i !== index);
            globalState.currentProblemImages = updated;
            const newTotal = updated.reduce((sum, f) => sum + f.size, 0);
            setTotalSize(newTotal);
            return updated;
        });
    };

    const clearAll = () => {
        setFiles([]);
        globalState.currentProblemImages = [];
        setTotalSize(0);
    };

    const getFileConfig = (mimeType: string) => {
        return FILE_TYPE_CONFIG[mimeType] || { icon: 'insert_drive_file', color: '#6b7280', label: 'FILE' };
    };

    const isImage = (mimeType: string): boolean => mimeType.startsWith('image/');

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const sizeWarning = totalSize > SIZE_WARNING_THRESHOLD;

    return (
        <>
            <div className="file-upload-wrapper">
                {/* Drop Zone */}
                <div
                    className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={ACCEPTED_FILES}
                        multiple
                        style={{ display: 'none' }}
                    />

                    {files.length === 0 ? (
                        <div className="drop-zone-content">
                            <span className="material-symbols-outlined drop-icon">cloud_upload</span>
                            <div className="drop-text">
                                <span className="drop-primary">Drop files here or click to upload</span>
                                <span className="drop-secondary">Images, PDFs, Documents, Code, Video</span>
                            </div>
                        </div>
                    ) : (
                        <div className="drop-zone-mini">
                            <span className="material-symbols-outlined">add</span>
                            <span>Add more files</span>
                        </div>
                    )}
                </div>

                {/* File List */}
                {files.length > 0 && (
                    <div className="file-list-container">
                        <div className="file-list-header">
                            <span className="file-count">{files.length} file{files.length !== 1 ? 's' : ''} • {formatFileSize(totalSize)}</span>
                            <button className="clear-all-btn" onClick={clearAll}>
                                <span className="material-symbols-outlined">delete_sweep</span>
                                Clear all
                            </button>
                        </div>

                        {sizeWarning && (
                            <div className="size-warning">
                                <span className="material-symbols-outlined">warning</span>
                                <span>Large upload ({formatFileSize(totalSize)}). Some providers may reject requests over 20MB.</span>
                            </div>
                        )}

                        <div className="file-grid">
                            {files.map((file, idx) => {
                                const config = getFileConfig(file.mimeType);
                                return (
                                    <div
                                        key={idx}
                                        className="file-card"
                                        title={`Click to preview: ${file.name}`}
                                        onClick={() => setPreviewFile(file)}
                                    >
                                        <button
                                            className="file-remove-btn"
                                            onClick={(e) => removeFile(idx, e)}
                                            title="Remove file"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>

                                        <div className="file-preview-thumb">
                                            {isImage(file.mimeType) ? (
                                                <img
                                                    src={`data:${file.mimeType};base64,${file.base64}`}
                                                    alt={file.name}
                                                    className="file-image"
                                                />
                                            ) : (
                                                <div className="file-icon-wrapper" style={{ backgroundColor: `${config.color}15` }}>
                                                    <span
                                                        className="material-symbols-outlined file-type-icon"
                                                        style={{ color: config.color }}
                                                    >
                                                        {config.icon}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="file-preview-overlay">
                                                <span className="material-symbols-outlined">visibility</span>
                                            </div>
                                        </div>

                                        <div className="file-info">
                                            <span className="file-name">{file.name}</span>
                                            <div className="file-meta">
                                                <span className="file-type-badge" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                                                    {config.label}
                                                </span>
                                                <span className="file-size">{formatFileSize(file.size)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal - rendered to body via portal for true fullscreen */}
            {previewFile && createPortal(
                <FilePreviewModal
                    file={previewFile}
                    onClose={() => setPreviewFile(null)}
                />,
                document.body
            )}
        </>
    );
};
