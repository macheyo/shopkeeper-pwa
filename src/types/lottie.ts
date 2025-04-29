// Types for Lottie animation data structures and API
export interface LottieAnimationSegment {
  t: number; // Time
  s: number[]; // Start values
  e?: number[]; // End values
  h?: number; // Hold (1 = hold, 0 = no hold)
}

export interface LottieTransform {
  p?: { a?: number; k?: number[] | LottieAnimationSegment[] }; // Position
  a?: { a?: number; k?: number[] }; // Anchor point
  s?: { a?: number; k?: number[] | LottieAnimationSegment[] }; // Scale
  r?: { a?: number; k?: number | LottieAnimationSegment[] }; // Rotation
  o?: { a?: number; k?: number }; // Opacity
}

export interface LottieShape {
  ty: string; // Type (e.g., "gr" for group, "el" for ellipse)
  it?: LottieShape[]; // Items (for groups)
  d?: number; // Direction
  p?: { a?: number; k?: number[] }; // Position
  s?: { a?: number; k?: number[] }; // Size
  c?: { a?: number; k?: number[] }; // Color
  o?: { a?: number; k?: number }; // Opacity
  r?: number; // Roundness
  w?: { a?: number; k?: number }; // Width (for stroke)
  lc?: number; // Line cap
  lj?: number; // Line join
}

export interface LottieLayer {
  ddd: number; // 3D flag
  ind: number; // Index
  ty: number; // Type
  nm: string; // Name
  sr?: number; // Time stretch
  ks: LottieTransform; // Transform properties
  shapes?: LottieShape[]; // Shapes
  ip?: number; // In point
  op?: number; // Out point
  st?: number; // Start time
  bm?: number; // Blend mode
}

export interface LottieAsset {
  id: string; // Asset ID
  w?: number; // Width
  h?: number; // Height
  p?: string; // Path (for image assets)
  u?: string; // Base path
  e?: number; // Embedded flag
  t?: string; // Type (e.g., "image")
  layers?: LottieLayer[]; // Layers (for precomp assets)
}

export interface LottieAnimation {
  v: string; // Version
  fr: number; // Frame rate
  ip: number; // In point
  op: number; // Out point
  w: number; // Width
  h: number; // Height
  nm: string; // Name
  ddd: number; // 3D flag
  assets: LottieAsset[]; // Assets (images, precomps)
  layers: LottieLayer[]; // Layers
}

// Types for the Lottie API
export interface LottieInstance {
  destroy: () => void;
  goToAndPlay: (value: number, isFrame?: boolean) => void;
  goToAndStop: (value: number, isFrame?: boolean) => void;
  pause: () => void;
  play: () => void;
  setSpeed: (speed: number) => void;
  setDirection: (direction: number) => void;
  stop: () => void;
}

export interface LottieRendererSettings {
  preserveAspectRatio?: string; // E.g., "xMidYMid meet"
  clearCanvas?: boolean; // Clear canvas before drawing new frame
  progressiveLoad?: boolean; // Enable progressive loading
  hideOnTransparent?: boolean; // Hide elements when opacity reaches 0
  className?: string; // CSS class name to add
}

export interface LottieOptions {
  container: HTMLElement;
  renderer: "svg" | "canvas" | "html";
  loop?: boolean | number;
  autoplay?: boolean;
  name?: string;
  animationData?: LottieAnimation;
  path?: string;
  rendererSettings?: LottieRendererSettings;
}

export interface LottieAPI {
  loadAnimation: (options: LottieOptions) => LottieInstance;
  destroy: (animationID: string) => void;
}
