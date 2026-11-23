import type { Shape } from "./CanvaSlice";

export const GRID = 20;

export function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

export function isConnectedArrow(shape: Shape) {
  return shape.type === "arrow" && Boolean(shape.props?.fromId) && Boolean(shape.props?.toId);
}

type Box = { cx: number; cy: number; hw: number; hh: number; circle: boolean };

function box(shape: Shape): Box {
  if (shape.type === "circle") {
    const radius = (shape.width || 80) / 2;
    return { cx: shape.x, cy: shape.y, hw: radius, hh: radius, circle: true };
  }

  let width = shape.width;
  let height = shape.height;
  if (shape.type === "text") {
    const font = Number(shape.props?.fontSize) || 18;
    width = width || Math.max(40, (shape.text?.length || 1) * font * 0.55);
    height = height || font * 1.4;
  }
  width = width || 80;
  height = height || 40;
  return {
    cx: shape.x + width / 2,
    cy: shape.y + height / 2,
    hw: width / 2,
    hh: height / 2,
    circle: false,
  };
}

function edge(bounds: Box, towardX: number, towardY: number) {
  const dx = towardX - bounds.cx;
  const dy = towardY - bounds.cy;
  const length = Math.hypot(dx, dy) || 1;
  if (bounds.circle) {
    return {
      x: bounds.cx + (dx / length) * bounds.hw,
      y: bounds.cy + (dy / length) * bounds.hh,
    };
  }
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : bounds.hw / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : bounds.hh / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: bounds.cx + dx * scale, y: bounds.cy + dy * scale };
}

export function connectorPoints(from: Shape, to: Shape) {
  const start = box(from);
  const end = box(to);
  const a = edge(start, end.cx, end.cy);
  const b = edge(end, start.cx, start.cy);
  return [a.x, a.y, b.x, b.y];
}

export function gridLines(viewport: { x: number; y: number; scale: number }, width: number, height: number) {
  const worldWidth = width / viewport.scale;
  const worldHeight = height / viewport.scale;
  const left = -viewport.x / viewport.scale - worldWidth;
  const top = -viewport.y / viewport.scale - worldHeight;
  const right = left + worldWidth * 3;
  const bottom = top + worldHeight * 3;
  const lines: number[][] = [];
  const startX = Math.floor(left / GRID) * GRID;
  const startY = Math.floor(top / GRID) * GRID;
  for (let x = startX; x <= right; x += GRID) lines.push([x, top, x, bottom]);
  for (let y = startY; y <= bottom; y += GRID) lines.push([left, y, right, y]);
  return lines;
}
