export interface WorkflowNodeData {
  id: string;
  type: NodeType;
  title: string;
  provider: string;
  status: 'not_run' | 'running' | 'completed' | 'error';
  estimatedTime: string;
  config?: Record<string, unknown>;
  execution?: NodeExecutionConfig;
}

export type ExecutionMode = 'parallel' | 'sequential';

export interface NodeExecutionConfig {
  mode: ExecutionMode;
  waitForAll: boolean;
  aggregateItems: boolean;
}

export type NodeType =
  | 'face_swap'
  | 'image_to_video'
  | 'text_to_image'
  | 'text_to_video'
  | 'text_to_text'
  | 'image_to_image'
  | 'text_to_music'
  | 'text_to_speech'
  | 'enhancer'
  | 'split_text'
  | 'lip_sync'
  | 'ai_avatar'
  | 'image_object_removal'
  | 'image_remove_background'
  | 'video_sound_effects'
  | 'edit_video'
  | 'upload_files'
  | 'clip_merger';

export interface NodeTypeConfig {
  type: NodeType;
  label: string;
  icon: string;
  defaultProvider: string;
  defaultTime: string;
  category: 'input' | 'generation' | 'processing' | 'output';
}

export const NODE_TYPES: NodeTypeConfig[] = [
  { type: 'upload_files', label: 'Upload Files', icon: '📤', defaultProvider: 'Local', defaultTime: '5s', category: 'input' },
  { type: 'text_to_text', label: 'Text To Text', icon: '📝', defaultProvider: 'OpenAI', defaultTime: '10s', category: 'generation' },
  { type: 'text_to_image', label: 'Text To Image', icon: '🖼️', defaultProvider: 'Fal AI', defaultTime: '30s', category: 'generation' },
  { type: 'text_to_video', label: 'Text To Video', icon: '📹', defaultProvider: 'Google', defaultTime: '5min', category: 'generation' },
  { type: 'text_to_music', label: 'Text To Music', icon: '🎵', defaultProvider: 'MiniMax', defaultTime: '3min', category: 'generation' },
  { type: 'text_to_speech', label: 'Text To Speech', icon: '🔊', defaultProvider: 'ElevenLabs', defaultTime: '20s', category: 'generation' },
  { type: 'image_to_video', label: 'Image To Video', icon: '🎬', defaultProvider: 'Runway', defaultTime: '2min', category: 'generation' },
  { type: 'image_to_image', label: 'Image To Image', icon: '🔄', defaultProvider: 'Fal AI', defaultTime: '30s', category: 'processing' },
  { type: 'face_swap', label: 'Face Swap', icon: '🎭', defaultProvider: 'InsightFace', defaultTime: '45s', category: 'processing' },
  { type: 'lip_sync', label: 'Lip Sync', icon: '👄', defaultProvider: 'KlingAI', defaultTime: '10min', category: 'processing' },
  { type: 'ai_avatar', label: 'AI Avatar', icon: '🤖', defaultProvider: 'HeyGen', defaultTime: '3min', category: 'generation' },
  { type: 'enhancer', label: 'Enhancer', icon: '✨', defaultProvider: 'Topaz', defaultTime: '1min', category: 'processing' },
  { type: 'split_text', label: 'Split Text', icon: '✂️', defaultProvider: 'ClipZap', defaultTime: '30s', category: 'processing' },
  { type: 'image_object_removal', label: 'Object Removal', icon: '🗑️', defaultProvider: 'Remove.bg', defaultTime: '15s', category: 'processing' },
  { type: 'image_remove_background', label: 'Remove Background', icon: '🎨', defaultProvider: 'Remove.bg', defaultTime: '10s', category: 'processing' },
  { type: 'video_sound_effects', label: 'Sound Effects', icon: '🔉', defaultProvider: 'Epidemic', defaultTime: '30s', category: 'processing' },
  { type: 'edit_video', label: 'Edit Video', icon: '✏️', defaultProvider: 'FFmpeg', defaultTime: '2min', category: 'processing' },
  { type: 'clip_merger', label: 'Clip Merger', icon: '🔗', defaultProvider: 'FFmpeg', defaultTime: '1min', category: 'output' },
];

export const getNodeTypeConfig = (type: NodeType): NodeTypeConfig => {
  return NODE_TYPES.find(n => n.type === type) || NODE_TYPES[0];
};

export const createNode = (type: NodeType, index: number): WorkflowNodeData => {
  const config = getNodeTypeConfig(type);
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title: `${index + 1}. ${config.label}`,
    provider: config.defaultProvider,
    status: 'not_run',
    estimatedTime: config.defaultTime,
    config: {},
    execution: {
      mode: 'parallel',
      waitForAll: false,
      aggregateItems: false
    }
  };
};
