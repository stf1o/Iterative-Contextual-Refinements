import { LogEntry } from '../UI/LiveConsoleLog';

class Logger {
    private static instance: Logger;
    private logs: LogEntry[] = [];
    private maxLogs: number = 500;
    private listeners: Set<() => void> = new Set();

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public addLog(entry: Omit<LogEntry, 'timestamp'>): void {
        const log: LogEntry = {
            ...entry,
            timestamp: new Date()
        };

        this.logs.push(log);

        // Limit log size
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        this.notifyListeners();
    }

    public logRequest(content: string, model?: string, metadata?: any): void {
        this.addLog({
            type: 'request',
            direction: 'sent',
            content,
            model,
            metadata
        });
    }

    public logResponse(content: string, model?: string, metadata?: any): void {
        this.addLog({
            type: 'response',
            direction: 'received',
            content,
            model,
            metadata
        });
    }

    public logSystem(content: string, metadata?: any): void {
        this.addLog({
            type: 'system',
            content,
            metadata
        });
    }

    public logError(content: string, metadata?: any): void {
        this.addLog({
            type: 'error',
            content,
            metadata
        });
    }

    public logInfo(content: string, metadata?: any): void {
        this.addLog({
            type: 'info',
            content,
            metadata
        });
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public clearLogs(): void {
        this.logs = [];
        this.notifyListeners();
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }
}

export const logger = Logger.getInstance();
export default Logger;
