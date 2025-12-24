import React, { createContext, useContext, type ReactNode } from 'react';
import { useWorkflow } from '../hooks/useWorkflow';

type WorkflowContextType = ReturnType<typeof useWorkflow>;

const WorkflowContext = createContext<WorkflowContextType | null>(null);

export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const workflow = useWorkflow();
    return (
        <WorkflowContext.Provider value={workflow}>
            {children}
        </WorkflowContext.Provider>
    );
};

export const useWorkflowContext = () => {
    const context = useContext(WorkflowContext);
    if (!context) {
        throw new Error('useWorkflowContext must be used within a WorkflowProvider');
    }
    return context;
};
