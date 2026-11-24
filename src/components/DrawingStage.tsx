/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type { Shape } from "../features/CanvaSlice";
import { connectorPoints, gridLines, isConnectedArrow, snap, GRID } from "../features/canvasGeometry";
import type { LiveCursor } from "../hooks/usePresence";

type Viewport = { x: number; y: number; scale: number };

type DrawingStageProps = {
  stageRef: React.RefObject<any>;
  width: number;
  height: number;
  viewport: Viewport;
  pan: boolean;
  draggable: boolean;
  shapes: Shape[];
  shapesById: Record<string, Shape>;
  shapesRef: React.RefObject<Record<string, Shape>>;
  selectedId: string | null;
  cursors: Record<string, LiveCursor>;
  onPanEnd: (x: number, y: number) => void;
  onWheel: (event: any) => void;
  onMouseDown: (event: any) => void;
  onCursor: (x: number, y: number) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onShapeClick: (id: string, event: any) => void;
  onPersist: (id: string, patch: Partial<Shape>, row: Record<string, unknown>) => void;
};

function canvasPointer(stage: any) {
  const pointer = stage?.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  return transform.point(pointer);
}

export default function DrawingStage({
  stageRef,
  width,
  height,
  viewport,
  pan,
  draggable,
  shapes,
  shapesById,
  shapesRef,
  selectedId,
  cursors,
  onPanEnd,
  onWheel,
  onMouseDown,
  onCursor,
  onDragStart,
  onDragMove,
  onDragEnd,
  onShapeClick,
  onPersist,
}: DrawingStageProps) {
  const transformerRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const lines = gridLines(viewport, width, height);

  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;
    const stage = layerRef.current.getStage();
    if (!stage) return;
    const current = selectedId ? shapesRef.current?.[selectedId] : undefined;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    const locked = !current || current.type === "line" || current.type === "arrow";
    transformerRef.current.nodes(!locked && node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, shapesRef]);

  const handleTransform = (id: string) => async (event: any) => {
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
      onDragEnd={(event) => {
        if (event.target !== event.target.getStage()) return;
        onPanEnd(event.target.x(), event.target.y());
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={(event) => {
        const pos = canvasPointer(event.target.getStage());
        if (pos) onCursor(pos.x, pos.y);
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
          const drag = {
            draggable,
            onDragStart: () => onDragStart(shape.id),
            onDragMove: (event: any) => onDragMove(shape.id, event.target.x(), event.target.y()),
            onDragEnd: (event: any) => {
              const x = snap(event.target.x());
              const y = snap(event.target.y());
              event.target.position({ x, y });
              onDragEnd(shape.id, x, y);
            },
            onClick: (event: any) => onShapeClick(shape.id, event),
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
                  draggable={draggable && !linked}
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
                    const node = event.target;
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
                  }}
                  {...drag}
                />
              );
            default:
              return null;
          }
        })}
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
