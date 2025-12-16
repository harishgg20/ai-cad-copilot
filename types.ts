
export type ShapeType = 'box' | 'sphere' | 'cylinder' | 'cone';

export type ShapeCategory = 'structure' | 'electrical' | 'furniture' | 'landscape';

export interface Shape {
  id: string;
  type: ShapeType;
  category?: ShapeCategory;
  groupId?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  args?: number[];
  name?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  visible?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}

export interface DesignState {
  shapes: Shape[];
  history: string[];
}

export interface Attachment {
  mimeType: string;
  data: string;
  name?: string;
}

export interface MaterialInfo {
  color: string;
  name: string;
  description?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  attachment?: Attachment;
}

export interface GeminiResponse {
  text: string;
  designUpdate?: Shape[];
  isExplanation?: boolean;
  isReview?: boolean;
  materialLegend?: MaterialInfo[];
}

export enum AppMode {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  WORKSPACE = 'WORKSPACE',
  ADMIN = 'ADMIN',
}

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  content: string;
  type: 'info' | 'review' | 'material';
}

export interface ProjectData {
  id: string;           // Unique ID for the project
  name: string;         // Display name
  lastModified: number; // For sorting
  shapes: Shape[];
  messages: Message[];  // Save the actual chat bubbles
  materialLegend: MaterialInfo[];
  history: string[];    // Save the prompt context
  thumbnail?: string;   // Optional preview color or data
  ownerEmail?: string;  // Added for Admin tracking
}
