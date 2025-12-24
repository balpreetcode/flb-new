import React from 'react';
import './NodeConnector.css';

interface NodeConnectorProps {
    onAddClick: () => void;
    itemCount?: number;
    showItemCount?: boolean;
}

export const NodeConnector: React.FC<NodeConnectorProps> = ({ onAddClick, itemCount, showItemCount }) => {
    return (
        <div className="node-connector">
            <div className="connector-line"></div>
            <button className="connector-add-btn" onClick={onAddClick}>
                <span>+</span>
            </button>
            {showItemCount && typeof itemCount === 'number' && (
                <div className="connector-items">({itemCount} items)</div>
            )}
            <div className="connector-line"></div>
        </div>
    );
};
