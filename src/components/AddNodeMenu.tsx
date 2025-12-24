import React, { useState, useRef, useEffect } from 'react';
import type { NodeType } from '../types/nodes';
import { NODE_TYPES } from '../types/nodes';
import './AddNodeMenu.css';

interface AddNodeMenuProps {
    onSelect: (type: NodeType) => void;
    onClose: () => void;
    position?: { x: number; y: number };
}

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({
    onSelect,
    onClose,
}) => {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const categories = [
        { key: 'all', label: 'All' },
        { key: 'input', label: 'Input' },
        { key: 'generation', label: 'Generation' },
        { key: 'processing', label: 'Processing' },
        { key: 'output', label: 'Output' },
    ];

    const filteredNodes = NODE_TYPES.filter(node => {
        const matchesSearch = node.label.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="add-node-overlay">
            <div className="add-node-menu" ref={menuRef}>
                <div className="menu-header">
                    <h3>Add Node</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="menu-search">
                    <input
                        type="text"
                        placeholder="Search nodes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="menu-categories">
                    {categories.map(cat => (
                        <button
                            key={cat.key}
                            className={`category-btn ${selectedCategory === cat.key ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat.key)}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="menu-nodes">
                    {filteredNodes.map(node => (
                        <button
                            key={node.type}
                            className="node-option"
                            onClick={() => {
                                onSelect(node.type);
                                onClose();
                            }}
                        >
                            <span className="node-option-icon">{node.icon}</span>
                            <div className="node-option-info">
                                <span className="node-option-label">{node.label}</span>
                                <span className="node-option-provider">{node.defaultProvider}</span>
                            </div>
                            <span className="node-option-time">{node.defaultTime}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
