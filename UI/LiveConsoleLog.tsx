import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';

export interface LogEntry {
    timestamp: Date;
    type: 'request' | 'response' | 'system' | 'error' | 'info';
    direction?: 'sent' | 'received';
    content: string;
    model?: string;
    metadata?: any;
}

interface LiveConsoleLogProps {
    isOpen: boolean;
    onClose: () => void;
    logs: LogEntry[];
    onClear: () => void;
}

export const LiveConsoleLog: React.FC<LiveConsoleLogProps> = ({ 
    isOpen, 
    onClose, 
    logs, 
    onClear 
}) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    };

    const getTypeColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'request': return '#FF4081';
            case 'response': return '#00E676';
            case 'system': return '#2979FF';
            case 'error': return '#FF5252';
            case 'info': return '#FFC400';
            default: return '#A0A8C8';
        }
    };

    const getDirectionIcon = (direction?: 'sent' | 'received') => {
        if (direction === 'sent') return 'arrow_upward';
        if (direction === 'received') return 'arrow_downward';
        return 'info';
    };

    if (!isOpen) return null;

    return (
        <div className="live-console-log-overlay" onClick={onClose}>
            <div className="live-console-log-panel" onClick={(e) => e.stopPropagation()}>
                <div className="live-console-log-header">
                    <div className="live-console-log-title">
                        <Icon name="terminal" />
                        <span>Nexus AI Live Console Log</span>
                    </div>
                    <div className="live-console-log-controls">
                        <button 
                            className="live-console-log-btn"
                            onClick={() => setAutoScroll(!autoScroll)}
                            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
                        >
                            <Icon name={autoScroll ? 'vertical_align_bottom' : 'pause'} />
                        </button>
                        <button 
                            className="live-console-log-btn"
                            onClick={onClear}
                            title="Clear logs"
                        >
                            <Icon name="delete" />
                        </button>
                        <button 
                            className="live-console-log-btn close-btn"
                            onClick={onClose}
                            title="Close console"
                        >
                            <Icon name="close" />
                        </button>
                    </div>
                </div>
                
                <div className="live-console-log-content">
                    {logs.length === 0 ? (
                        <div className="live-console-log-empty">
                            <Icon name="info" />
                            <span>No logs yet. Start interacting with the AI to see requests and responses.</span>
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className={`live-console-log-entry ${log.type}`}>
                                <div className="live-console-log-entry-header">
                                    <span className="live-console-log-timestamp">
                                        {formatTimestamp(log.timestamp)}
                                    </span>
                                    <span className="live-console-log-type-badge" style={{ borderColor: getTypeColor(log.type) }}>
                                        <Icon name={getDirectionIcon(log.direction)} />
                                        <span>{log.type.toUpperCase()}</span>
                                    </span>
                                    {log.model && (
                                        <span className="live-console-log-model">
                                            {log.model}
                                        </span>
                                    )}
                                </div>
                                <div className="live-console-log-entry-content">
                                    <pre>{log.content}</pre>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};

export default LiveConsoleLog;
