import type { Category } from '@/nodes/types';
import type { Theme } from '@/store/uiSlice';

export interface CanvasTheme {
  background: number;
  grid: number;
  nodeFill: number;
  nodeFillAlpha: number;
  text: number;
  textCss: string;
  mutedCss: string;
  edge: number;
  feedback: number;
  gradient: number;
  selected: number;
  error: number;
  blocked: number;
  port: number;
  dim: number;
}

export const canvasThemes: Record<Theme, CanvasTheme> = {
  dark: {
    background: 0x1c1c1f,
    grid: 0x34343a,
    nodeFill: 0xffffff,
    nodeFillAlpha: 0.06,
    text: 0xffffff,
    textCss: '#ffffff',
    mutedCss: '#b6bbbf',
    edge: 0x6abf4b,
    feedback: 0xf5a623,
    gradient: 0x00e5ff,
    selected: 0xffd400,
    error: 0xff5252,
    blocked: 0x8a8a8a,
    port: 0x6abf4b,
    dim: 0x000000,
  },
  light: {
    background: 0xfafafa,
    grid: 0xe2e2e8,
    nodeFill: 0x000000,
    nodeFillAlpha: 0.03,
    text: 0x111111,
    textCss: '#111111',
    mutedCss: '#5c5c66',
    edge: 0x3f9a2a,
    feedback: 0xd9820f,
    gradient: 0x0097b2,
    selected: 0xe0a800,
    error: 0xd32f2f,
    blocked: 0x9a9a9a,
    port: 0x3f9a2a,
    dim: 0xffffff,
  },
};

const CATEGORY_COLORS: Record<Category, number> = {
  Data: 0xf56305,
  Math: 0x3d97ff,
  Activations: 0x3d97ff,
  'Linear algebra': 0x3d97ff,
  Loss: 0xf1c232,
  Training: 0xf1c232,
  Text: 0xf56305,
  Diffusion: 0xb36bff,
  Graphs: 0xf56305,
  Display: 0xb36bff,
  Structure: 0x009aa6,
};

export const categoryColor = (c: Category) => CATEGORY_COLORS[c];
export const GROUP_COLOR = 0x009aa6;
