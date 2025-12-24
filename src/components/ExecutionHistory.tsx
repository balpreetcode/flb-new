import React, { useEffect, useState } from 'react';

interface ExecutionResult {
    workflowId: string;
    workflowName: string;
    status: 'completed' | 'failed';
    startTime: string;
    endTime: string;
    durationMs: number;
    nodeCount: number;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export function ExecutionHistory() {
    const [history, setHistory] = useState<ExecutionResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/workflow/history`);
            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }
            const data = await response.json();
            setHistory(data);
            setError(null);
        } catch (err) {
            setError('Could not load history');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString();
    };

    return (
        <div className="execution-history">
            <div className="history-header">
                <h2>Execution History</h2>
                <button className="btn-secondary" onClick={fetchHistory}>
                    ↻ Refresh
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading-state">Loading history...</div>
            ) : history.length === 0 ? (
                <div className="empty-state">No execution history found. Run a workflow to see it here!</div>
            ) : (
                <div className="history-table-container">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Workflow Name</th>
                                <th>Date</th>
                                <th>Duration</th>
                                <th>Nodes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((run) => (
                                <tr key={run.workflowId}>
                                    <td>
                                        <span className={`status-badge ${run.status}`}>
                                            {run.status === 'completed' ? '✓ Success' : '✕ Failed'}
                                        </span>
                                    </td>
                                    <td>{run.workflowName}</td>
                                    <td>{formatDate(run.startTime)}</td>
                                    <td>{formatDuration(run.durationMs)}</td>
                                    <td>{run.nodeCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
