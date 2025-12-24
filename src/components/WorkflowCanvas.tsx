import React, { useMemo, useState } from 'react';
import { WorkflowNode } from './WorkflowNode';
import { NodeConnector } from './NodeConnector';
import { AddNodeMenu } from './AddNodeMenu';
import { useWorkflowContext } from '../context/WorkflowContext';
import type { NodeType } from '../types/nodes';
import './WorkflowCanvas.css';

export const WorkflowCanvas: React.FC = () => {
    const { workflow, addNode, removeNode, updateNode, execution } = useWorkflowContext();
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [addAfterIndex, setAddAfterIndex] = useState<number | undefined>(undefined);

    const itemCounts = useMemo(() => {
        const counts = new Map<string, number>();
        execution.results.forEach(result => {
            const count = (result.data as any)?.output?.itemsCount;
            if (typeof count === 'number') {
                counts.set(result.nodeId, count);
            }
        });
        return counts;
    }, [execution.results]);

    const outputByNodeId = useMemo(() => {
        const outputs = new Map<string, any>();
        execution.results.forEach(result => {
            const output = (result.data as any)?.output;
            if (output) {
                outputs.set(result.nodeId, output);
            }
        });
        return outputs;
    }, [execution.results]);

    const arrayInputCounts = useMemo(() => {
        const counts = new Map<string, number>();

        const collectReferences = (value: any, refs: Array<{ nodeId: string; outputKey: string }>) => {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) {
                value.forEach(item => collectReferences(item, refs));
                return;
            }
            if (value._type === 'reference' && value.nodeId && value.outputKey) {
                refs.push({ nodeId: value.nodeId, outputKey: value.outputKey });
                return;
            }
            Object.values(value).forEach(item => collectReferences(item, refs));
        };

        workflow.nodes.forEach(node => {
            const refs: Array<{ nodeId: string; outputKey: string }> = [];
            collectReferences(node.config, refs);
            let count: number | undefined;

            refs.forEach(ref => {
                const output = outputByNodeId.get(ref.nodeId);
                if (!output) return;
                const value = output[ref.outputKey];
                if (Array.isArray(value)) {
                    count = count ?? value.length;
                    return;
                }
                if (ref.outputKey === 'items') {
                    if (Array.isArray(output.items)) {
                        count = count ?? output.items.length;
                    } else if (typeof output.itemsCount === 'number') {
                        count = count ?? output.itemsCount;
                    }
                }
            });

            if (typeof count === 'number') {
                counts.set(node.id, count);
            }
        });

        return counts;
    }, [workflow.nodes, outputByNodeId]);

    const handleAddClick = (afterIndex?: number) => {
        setAddAfterIndex(afterIndex);
        setShowAddMenu(true);
    };

    const handleSelectNode = (type: NodeType) => {
        addNode(type, addAfterIndex);
        setShowAddMenu(false);
        setAddAfterIndex(undefined);
    };

    return (
        <div className="workflow-canvas dotted-bg">
            <div className="canvas-content">
                {workflow.nodes.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔧</div>
                        <h2>Start Building Your Workflow</h2>
                        <p>Add your first node to begin creating your AI pipeline</p>
                        <button
                            className="add-first-btn"
                            onClick={() => handleAddClick()}
                        >
                            <span>+</span> Add First Node
                        </button>
                    </div>
                ) : (
                    <>
                        {workflow.nodes.map((node, index) => (
                            <React.Fragment key={node.id}>
                                <WorkflowNode
                                    node={node}
                                    index={index}
                                    onRemove={removeNode}
                                    onUpdate={updateNode}
                                    isCurrentlyRunning={execution.currentNodeId === node.id}
                                    arrayInputCount={arrayInputCounts.get(node.id)}
                                />
                                <NodeConnector
                                    onAddClick={() => handleAddClick(index)}
                                    itemCount={itemCounts.get(node.id)}
                                    showItemCount={node.status === 'completed' || node.status === 'error'}
                                />
                            </React.Fragment>
                        ))}

                        <button
                            className="add-end-btn"
                            onClick={() => handleAddClick(workflow.nodes.length - 1)}
                        >
                            <span>+</span> Add Node
                        </button>
                    </>
                )}
            </div>

            {showAddMenu && (
                <AddNodeMenu
                    onSelect={handleSelectNode}
                    onClose={() => {
                        setShowAddMenu(false);
                        setAddAfterIndex(undefined);
                    }}
                />
            )}
        </div>
    );
};
