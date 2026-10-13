/** Shared types for the pipeline: style, scenario content and placed geometry. */

export interface Style {
  /** Rough.js style roughness, passed through to Excalidraw. */
  roughness: number;
  strokeWidth: number;
  bowing: number;
  strokeColor: string;
  fontSize: number;
  /** Unitless line height, as Excalidraw uses it. */
  lineHeight: number;
  /** Average advance width of an upper-case glyph, in em. */
  charWidth: number;
  /** Characters per line before wrapping. */
  wrap: number;
  /** Maximum box rotation in degrees, either way. */
  angle: number;
  /** Padding inside a bubble, in em, chosen per box from the seed. */
  padding: { min: number; max: number };
  /** Gap between clusters and between turns, in px. */
  clusterGap: number;
  turnGap: number;
  /** Actor icon height in px, used when the template has no iconScale. */
  actorSize: number;
  /** Multiply each icon's viewBox size by this instead of fitting to actorSize. */
  iconScale?: number;
  canvas: { width: number; height: number };
}

export interface IconInfo {
  file: string;
  /** Natural size from the SVG viewBox (or width/height attributes). */
  w: number;
  h: number;
}

export interface ActorDecl {
  id: string;
  icon: string;
  caption?: string;
  /** Drawn once for the whole sketch; every thread it speaks in attaches to that one icon. */
  once?: boolean;
}

export interface Turn {
  /** Whose voice it is. */
  speaker: string;
  /** Whose icon the bubble hangs off. Usually the speaker; `car@carpark:` borrows another node. */
  node: string;
  text: string;
  burst: boolean;
  handle: string;
  /** Handles of earlier bubbles in the same thread this one answers. Empty means the previous turn. */
  replyTo: string[];
}

export interface Thread {
  turns: Turn[];
}

export interface Scenario {
  actors: ActorDecl[];
  threads: Thread[];
  /** Cross-thread links, by bubble handle. */
  links: Array<[string, string]>;
}

/** Everything a renderer needs besides the geometry. */
export interface RenderContext {
  seed: number;
  style: Style;
  /** Icon name to file and natural size from its viewBox. */
  icons: Record<string, IconInfo>;
  /** Name used for output files. */
  name: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Pt = [number, number];

export interface Measured {
  lines: string[];
  textW: number;
  textH: number;
  padX: number;
  padY: number;
  w: number;
  h: number;
}

export interface SketchBubble {
  handle: string;
  text: string;
  burst: boolean;
  speaker: string;
  box: Box;
  measured: Measured;
  /** Rotation in degrees. */
  angle: number;
}

export interface SketchActor {
  /** Unique per drawn instance, e.g. `actor.t1.citizen`. */
  handle: string;
  actorId: string;
  icon: string;
  caption?: string;
  box: Box;
}

export interface SketchLink {
  handle: string;
  /** Handle of a bubble or an actor instance. */
  from: string;
  to: string;
  /** Absolute polyline. */
  points: Pt[];
  kind: "turn" | "stub" | "cross";
  /** Pinned Excalidraw fixedPoint ratios, when a hint set them. */
  startRatio?: Pt;
  endRatio?: Pt;
}

export interface Sketch {
  bubbles: SketchBubble[];
  actors: SketchActor[];
  links: SketchLink[];
  /** The drawn area. x and y are usually 0 but hints can push content past the origin. */
  canvas: { x: number; y: number; width: number; height: number };
}

export interface BoxHint { x?: number; y?: number; w?: number; h?: number }
export interface LinkHint { points: Pt[]; start?: Pt; end?: Pt }

/** hints.yml: positions pinned from a hand-edited Excalidraw file. Keyed by handle. */
export interface Hints {
  bubbles?: Record<string, BoxHint>;
  actors?: Record<string, BoxHint>;
  links?: Record<string, LinkHint>;
  /** Actor instances and links deleted by hand. */
  remove?: string[];
}
