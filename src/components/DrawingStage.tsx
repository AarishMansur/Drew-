/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type { Shape, shapeType } from "../features/CanvaSlice";
import { connectorPoints, gridLines, isConnectedArrow, snap, GRID } from "../features/canvasGeometry";
import type { LiveCursor } from "../hooks/usePresence";
import type { CanvasTool } from "./Toolbar";

type Viewport = { x: number; y: number; scale: number };
type DrawnShape = Omit<Shape, "id" | "spaceId">;

type DrawingStageProps = {
  stageRef: React.RefObject<any>;
  width: number;
  height: number;
  viewport: Viewport;
  tool: CanvasTool;
  pan: boolean;
  canEdit: boolean;
  shapes: Shape[];
  shapesById: Record<string, Shape>;
  shapesRef: React.RefObject<Record<string, Shape>>;
  selectedId: string | null;
  editingId: string | null;
  cursors: Record<string, LiveCursor>;
  onPanEnd: (x: number, y: number) => void;
  onWheel: (event: any) => void;
  onCursor: (x: number, y: number) => void;
  onSelect: (id: string | null) => void;
  onCreate: (shape: DrawnShape) => void;
  onGestureEnd: () => void;
  onEditingDone: () => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onPersist: (id: string, patch: Partial<Shape>, row: Record<string, unknown>) => void;
};

type Gesture = {
  type: shapeType;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  fromId: string | null;
};

const MIN_DRAG = 4;

function canvasPointer(stage: any) {
  const pointer = stage?.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  return transform.point(pointer);
}

function hitShapeId(stage: any, shapes: Record<string, Shape> | null | undefined) {
  const pointer = stage?.getPointerPosition();
  if (!stage || !pointer || !shapes) return null;
  let node = stage.getIntersection(pointer);
  while (node && node !== stage) {
    const id = typeof node.id === "function" ? node.id() : "";
    if (id && shapes[id]) return id as string;
    node = node.getParent?.();
  }
  return null;
}

function boxFromDrag(x0: number, y0: number, x1: number, y1: number) {
  const left = snap(Math.min(x0, x1));
  const top = snap(Math.min(y0, y1));
  const right = snap(Math.max(x0, x1));
  const bottom = snap(Math.max(y0, y1));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function shapeFromGesture(
  gesture: Gesture,
  endId: string | null,
  shapes: Record<string, Shape>,
  commit: boolean
): DrawnShape | null {
  const distance = Math.hypot(gesture.x1 - gesture.x0, gesture.y1 - gesture.y0);
  if (gesture.type === "text") {
    if (!commit) return null;
    return {
      type: "text",
      x: snap(gesture.x0),
      y: snap(gesture.y0),
      width: 0,
      height: 0,
      rotation: 0,
      text: "Text",
      props: { fontSize: 20, fill: "#000" },
    };
  }
  if (gesture.type === "line" || gesture.type === "arrow") {
    if (commit && distance < MIN_DRAG) return null;
    if (gesture.type === "arrow" && gesture.fromId && endId && endId !== gesture.fromId) {
      const from = shapes[gesture.fromId];
      const to = shapes[endId];
      if (from && to) {
        return {
          type: "arrow",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          points: connectorPoints(from, to),
          props: { stroke: "#000", fill: "#000", fromId: from.id, toId: to.id },
        };
      }
    }
    const x = snap(gesture.x0);
    const y = snap(gesture.y0);
    return {
      type: gesture.type,
      x,
      y,
      width: 0,
      height: 0,
      rotation: 0,
      points: [0, 0, snap(gesture.x1) - x, snap(gesture.y1) - y],
      props: { stroke: "#000", fill: gesture.type === "arrow" ? "#000" : "#3b82f6" },
    };
  }
  const box = boxFromDrag(gesture.x0, gesture.y0, gesture.x1, gesture.y1);
  const tiny = distance < MIN_DRAG;
  if (!commit && tiny) return null;
  if (gesture.type === "circle") {
    const size = tiny ? 80 : Math.max(box.width, box.height, GRID);
    const cx = tiny ? snap(gesture.x0) : box.x + box.width / 2;
    const cy = tiny ? snap(gesture.y0) : box.y + box.height / 2;
    return {
      type: "circle",
      x: cx,
      y: cy,
      width: size,
      height: size,
      rotation: 0,
      props: { stroke: "#000", fill: "#3b82f6" },
    };
  }
  return {
    type: "rect",
    x: tiny ? snap(gesture.x0 - 60) : box.x,
    y: tiny ? snap(gesture.y0 - 35) : box.y,
    width: tiny ? 120 : Math.max(box.width, GRID),
    height: tiny ? 70 : Math.max(box.height, GRID),
    rotation: 0,
    props: { stroke: "#000", fill: "#3b82f6" },
  };
}

export default function DrawingStage({
  stageRef,
  width,
  height,
  viewport,
  tool,
  pan,
  canEdit,
  shapes,
  shapesById,
  shapesRef,
  selectedId,
  editingId,
  cursors,
  onPanEnd,
  onWheel,
  onCursor,
  onSelect,
  onCreate,
  onGestureEnd,
  onEditingDone,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPersist,
}: DrawingStageProps) {
  const transformerRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const gesture = useRef<Gesture | null>(null);
  const upListener = useRef<((event: MouseEvent) => void) | null>(null);
  const dragOverride = useRef<{ id: string; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const createRef = useRef(onCreate);
  const endRef = useRef(onGestureEnd);
  const selectRef = useRef(onSelect);
  const [draft, setDraft] = useState<DrawnShape | null>(null);
  const lines = useMemo(() => gridLines(viewport, width, height), [viewport, width, height]);
  const drawing = tool !== "select" && tool !== "pan";

  useEffect(() => {
    createRef.current = onCreate;
    endRef.current = onGestureEnd;
    selectRef.current = onSelect;
  });

  const syncBoundArrows = (id: string, x: number, y: number) => {
    const stage = layerRef.current?.getStage();
    const all = shapesRef.current;
    if (!stage || !all) return;
    for (const shape of Object.values(all)) {
      if (!isConnectedArrow(shape)) continue;
      const fromId = shape.props?.fromId as string;
      const toId = shape.props?.toId as string;
      if (fromId !== id && toId !== id) continue;
      const from = all[fromId];
      const to = all[toId];
      if (!from || !to) continue;
      const placed = (item: Shape) => (item.id === id ? { ...item, x, y } : item);
      stage.findOne(`#${shape.id}`)?.points(connectorPoints(placed(from), placed(to)));
    }
    layerRef.current?.batchDraw();
  };

  useLayoutEffect(() => {
    const over = dragOverride.current;
    if (over) syncBoundArrows(over.id, over.x, over.y);
  });

  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;
    const stage = layerRef.current.getStage();
    if (!stage || tool !== "select") {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    const current = selectedId ? shapesRef.current?.[selectedId] : undefined;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    const locked = !current || current.type === "line" || current.type === "arrow";
    transformerRef.current.nodes(!locked && node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, shapesRef, tool]);

  const openEditor = (node: any, shape: Shape) => {
    const stage = node.getStage();
    if (!stage) return;
    const textPos = node.getAbsolutePosition();
    const stageRect = stage.container().getBoundingClientRect();
    const area = document.createElement("textarea");
    area.value = shape.text ?? "";
    area.style.position = "absolute";
    area.style.top = stageRect.top + textPos.y + "px";
    area.style.left = stageRect.left + textPos.x + "px";
    area.style.fontSize = (shape.props?.fontSize || 18) + "px";
    area.style.padding = "4px";
    area.style.margin = "0px";
    area.style.border = "2px solid #000";
    area.style.background = "white";
    area.style.color = "#000";
    area.style.outline = "none";
    area.style.resize = "none";
    area.style.zIndex = "99999";
    area.style.borderRadius = "4px";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.addEventListener("blur", () => {
      const newText = area.value;
      document.body.removeChild(area);
      onPersist(shape.id, { text: newText }, { text_value: newText });
    });
  };

  const editingDoneRef = useRef(onEditingDone);
  const openEditorRef = useRef(openEditor);
  const openedEdit = useRef<string | null>(null);
  useEffect(() => {
    editingDoneRef.current = onEditingDone;
    openEditorRef.current = openEditor;
  });

  useEffect(() => {
    if (!editingId || openedEdit.current === editingId) return;
    const shape = shapesRef.current?.[editingId];
    const node = layerRef.current?.getStage()?.findOne(`#${editingId}`);
    if (!shape || !node || shape.type !== "text") return;
    openedEdit.current = editingId;
    openEditorRef.current(node, shape);
    editingDoneRef.current();
  }, [editingId, shapesRef]);

  const finishGesture = (event: MouseEvent) => {
    const current = gesture.current;
    gesture.current = null;
    setDraft(null);
    if (upListener.current) {
      window.removeEventListener("mouseup", upListener.current);
      upListener.current = null;
    }
    if (!current) return;
    const stage = stageRef.current;
    if (stage) stage.setPointersPositions(event);
    const endId = stage ? hitShapeId(stage, shapesRef.current ?? undefined) : null;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const next = shapeFromGesture(current, endId, shapesRef.current ?? {}, true);
    if (next) createRef.current(next);
    endRef.current();
  };

  useEffect(
    () => () => {
      if (upListener.current) window.removeEventListener("mouseup", upListener.current);
    },
    []
  );

  const handleTransform = (id: string) => (event: any) => {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const patch: Partial<Shape> = {
      x: snap(node.x()),
      y: snap(node.y()),
      rotation: node.rotation(),
    };
    const row: Record<string, unknown> = {
      x: patch.x,
      y: patch.y,
      rotation: patch.rotation,
    };
    if (typeof node.width === "function" && typeof node.height === "function") {
      patch.width = Math.max(GRID, snap(node.width() * scaleX));
      patch.height = Math.max(GRID, snap(node.height() * scaleY));
      row.width = patch.width;
      row.height = patch.height;
    }
    node.scaleX(1);
    node.scaleY(1);
    node.position({ x: patch.x, y: patch.y });
    onPersist(id, patch, row);
  };

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      draggable={pan}
      style={{ cursor: pan ? "grab" : drawing ? "crosshair" : "default" }}
      onDragEnd={(event) => {
        if (event.target !== event.target.getStage()) return;
        onPanEnd(event.target.x(), event.target.y());
      }}
      onWheel={onWheel}
      onMouseDown={(event) => {
        const stage = event.target.getStage();
        if (!stage || pan || !canEdit) {
          if (tool === "select" && event.target === stage) selectRef.current(null);
          return;
        }
        if (tool === "select") {
          if (event.target === stage) selectRef.current(null);
          return;
        }
        if (tool === "pan") return;
        const pos = canvasPointer(stage);
        if (!pos) return;
        gesture.current = {
          type: tool,
          x0: pos.x,
          y0: pos.y,
          x1: pos.x,
          y1: pos.y,
          fromId: tool === "arrow" ? hitShapeId(stage, shapesRef.current ?? undefined) : null,
        };
        setDraft(shapeFromGesture(gesture.current, null, shapesRef.current ?? {}, false));
        if (upListener.current) window.removeEventListener("mouseup", upListener.current);
        upListener.current = finishGesture;
        window.addEventListener("mouseup", finishGesture);
      }}
      onMouseMove={(event) => {
        const stage = event.target.getStage();
        const pos = canvasPointer(stage);
        if (pos) onCursor(pos.x, pos.y);
        const current = gesture.current;
        if (!current || !pos) return;
        current.x1 = pos.x;
        current.y1 = pos.y;
        setDraft(shapeFromGesture(current, null, shapesRef.current ?? {}, false));
      }}
      className="bg-white"
    >
      <Layer ref={layerRef}>
        {lines.map((points, index) => (
          <Line
            key={`grid-${index}`}
            points={points}
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={1 / viewport.scale}
            listening={false}
          />
        ))}
        {shapes.map((shape) => {
          const connected = isConnectedArrow(shape);
          const from = connected ? shapesById[shape.props?.fromId as string] : undefined;
          const to = connected ? shapesById[shape.props?.toId as string] : undefined;
          const linked = Boolean(from && to);
          const arrowPoints = linked ? connectorPoints(from as Shape, to as Shape) : (shape.points ?? []);
          const movable = tool === "select" && canEdit && !pan;
          const drag = {
            draggable: movable,
            onDragStart: () => onDragStart(shape.id),
            onDragMove: (event: any) => {
              const x = event.target.x();
              const y = event.target.y();
              dragOverride.current = { id: shape.id, x, y };
              syncBoundArrows(shape.id, x, y);
              onDragMove(shape.id, x, y);
            },
            onDragEnd: (event: any) => {
              const x = snap(event.target.x());
              const y = snap(event.target.y());
              event.target.position({ x, y });
              dragOverride.current = null;
              onDragEnd(shape.id, x, y);
            },
            onClick: (event: any) => {
              event.cancelBubble = true;
              if (suppressClick.current || tool !== "select" || !canEdit) return;
              onSelect(shape.id);
            },
          };

          switch (shape.type) {
            case "rect":
              return (
                <Rect
                  id={shape.id}
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  rotation={shape.rotation}
                  fill={shape.props?.fill}
                  stroke={shape.props?.stroke}
                  strokeWidth={2}
                  onTransformEnd={handleTransform(shape.id)}
                  {...drag}
                />
              );
            case "circle":
              return (
                <Circle
                  id={shape.id}
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  radius={(shape.width ?? 80) / 2}
                  fill={shape.props?.fill}
                  stroke={shape.props?.stroke}
                  strokeWidth={2}
                  onTransformEnd={handleTransform(shape.id)}
                  {...drag}
                />
              );
            case "line":
              return (
                <Line
                  id={shape.id}
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  points={shape.points ?? []}
                  stroke={shape.props?.stroke || "#000"}
                  strokeWidth={3}
                  {...drag}
                />
              );
            case "arrow":
              return (
                <Arrow
                  id={shape.id}
                  key={shape.id}
                  x={linked ? 0 : shape.x}
                  y={linked ? 0 : shape.y}
                  points={arrowPoints}
                  stroke={shape.props?.stroke || "#000"}
                  fill={shape.props?.stroke || "#000"}
                  strokeWidth={3}
                  {...drag}
                  draggable={movable && !linked}
                />
              );
            case "text":
              return (
                <Text
                  id={shape.id}
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  text={shape.text ?? ""}
                  fontSize={shape.props?.fontSize || 18}
                  fill={shape.props?.fill || "#000"}
                  onDblClick={(event) => {
                    if (!canEdit) return;
                    openEditor(event.target, shape);
                  }}
                  {...drag}
                />
              );
            default:
              return null;
          }
        })}
        {draft?.type === "rect" && (
          <Rect
            x={draft.x}
            y={draft.y}
            width={draft.width}
            height={draft.height}
            fill={draft.props?.fill}
            stroke={draft.props?.stroke}
            strokeWidth={2}
            listening={false}
          />
        )}
        {draft?.type === "circle" && (
          <Circle
            x={draft.x}
            y={draft.y}
            radius={(draft.width || 80) / 2}
            fill={draft.props?.fill}
            stroke={draft.props?.stroke}
            strokeWidth={2}
            listening={false}
          />
        )}
        {draft?.type === "line" && (
          <Line
            x={draft.x}
            y={draft.y}
            points={draft.points ?? []}
            stroke={draft.props?.stroke || "#000"}
            strokeWidth={3}
            listening={false}
          />
        )}
        {draft?.type === "arrow" && (
          <Arrow
            x={draft.x}
            y={draft.y}
            points={draft.points ?? []}
            stroke={draft.props?.stroke || "#000"}
            fill={draft.props?.fill || "#000"}
            strokeWidth={3}
            listening={false}
          />
        )}
        <Transformer ref={transformerRef} />
        {Object.entries(cursors).map(([id, cursor]) => (
          <Group key={id} x={cursor.x} y={cursor.y} listening={false}>
            <Circle radius={5 / viewport.scale} fill={cursor.color} />
            <Text
              x={8 / viewport.scale}
              y={-6 / viewport.scale}
              text={cursor.name}
              fontSize={12 / viewport.scale}
              fill={cursor.color}
            />
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}
