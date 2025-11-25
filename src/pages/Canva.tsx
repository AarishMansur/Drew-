import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Text as KonvaText,
  Arrow,
  Transformer,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Circle as KonvaCircle } from "konva/lib/shapes/Circle";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import Konva from "konva";
import {
  MousePointer2,
  Square,
  Circle as CircleIcon,
  Type,
  ArrowRight,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/reduxHook";
import { setDrawing, setTextEnabled } from "../features/drawing/drawingSlice";
import { setAuth } from "../features/auth/authSlice";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";

type RectShape = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
};

type CircleShape = {
  id: string;
  type: "circle";
  x: number;
  y: number;
  radius: number;
  fill: string;
  stroke: string;
};

type ArrowShape = {
  id: string;
  type: "arrow";
  x: number;
  y: number;
  points: number[];
  fill: string;
  stroke: string;
};

type TextShape = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  stroke: string;
};

type ShapeConfig = RectShape | CircleShape | ArrowShape | TextShape;

type Tool = "select" | "rect" | "circle" | "arrow" | "text";

const TOOLBAR: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "rect", label: "Rectangle", icon: <Square className="w-4 h-4" /> },
  {
    id: "circle",
    label: "Circle",
    icon: <CircleIcon className="w-4 h-4" />,
  },
  { id: "arrow", label: "Arrow", icon: <ArrowRight className="w-4 h-4" /> },
  { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
];

const DEFAULT_COLORS = {
  stroke: "#0f172a",
  fill: "#ffffff",
};

const getInitialStageSize = () => ({
  width: typeof window !== "undefined" ? window.innerWidth : 1200,
  height: typeof window !== "undefined" ? window.innerHeight - 160 : 700,
});

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const Canva: React.FC = () => {
  const dispatch = useAppDispatch();
  const { spaceId } = useParams<{ spaceId: string }>();

  const auth = useAppSelector((state) => state.auth);
  const drawingState = useAppSelector((state) => state.drawing);
  const currentSpace = useAppSelector((state) =>
    spaceId ? state.space.list.find((space) => space.spaceId === spaceId) : null
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shapes, setShapes] = useState<Record<string, ShapeConfig>>({});
  const [stageSize, setStageSize] = useState(getInitialStageSize);
  const [spaceName, setSpaceName] = useState(
    currentSpace?.name ?? "Untitled Space"
  );
  const [participants] = useState(1);
  const [textEditor, setTextEditor] = useState<{
    id: string;
    value: string;
    x: number;
    y: number;
    fontSize: number;
  } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const stageRef = useRef<KonvaStage | null>(null);
  const layerRef = useRef<KonvaLayer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!spaceId || typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`spaceShapes:${spaceId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ShapeConfig[];
        const initial = parsed.reduce<Record<string, ShapeConfig>>(
          (acc, shape) => {
            acc[shape.id] = shape;
            return acc;
          },
          {}
        );
        queueMicrotask(() => setShapes(initial)); 
      } catch {
        /* ignore malformed cache */
      }
    }
  }, [spaceId]);

  useEffect(() => {
    if (currentSpace?.name) {
      queueMicrotask(() => setSpaceName(currentSpace.name));
    }
  }, [currentSpace?.name]);

  useEffect(() => {
    const handleResize = () => {
      setStageSize(getInitialStageSize());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function ensureAuth() {
      if (auth.loggedIn) {
        setShowLoginPrompt(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (data.session) {
        const user = data.session.user;
        dispatch(
          setAuth({
            userId: user.id,
            userName:
              (user.user_metadata?.full_name as string | undefined) ||
              user.email?.split("@")[0] ||
              "User",
            email: user.email ?? "",
          })
        );
        setShowLoginPrompt(false);
      } else {
        if (spaceId) {
          sessionStorage.setItem("postLoginRedirect", `/space/${spaceId}`);
        }
        setShowLoginPrompt(true);
      }
    }

    void ensureAuth();
    return () => {
      isMounted = false;
    };
  }, [auth.loggedIn, dispatch, spaceId]);

  useEffect(() => {
    if (!spaceId || typeof window === "undefined") return;
    const arr = Object.values(shapes);
    window.localStorage.setItem(`spaceShapes:${spaceId}`, JSON.stringify(arr));
  }, [shapes, spaceId]);

  useEffect(() => {
    const tr = transformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    if (selectedId) {
      const selectedNode = layer.findOne(`#${selectedId}`);
      if (selectedNode) {
        tr.nodes([selectedNode]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, shapes]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Delete" && selectedId && !textEditor) {
        setShapes((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, textEditor]);

  const activeTool = useMemo(() => {
    if (drawingState.shape === "rect") return "rect";
    if (drawingState.shape === "circle") return "circle";
    if (drawingState.shape === "arrow") return "arrow";
    if (drawingState.shape === "text") return "text";
    return "select";
  }, [drawingState.shape]);

  const updateShape = useCallback((id: string, attrs: Partial<ShapeConfig>) => {
    setShapes((prev) => {
      const shape = prev[id];
      if (!shape) return prev;
      const updated: ShapeConfig = { ...shape, ...attrs } as ShapeConfig;
      return { ...prev, [id]: updated };
    });
  }, []);

  const handleToolChange = (tool: Tool) => {
    const userId = drawingState.userId || "guest";
    dispatch(
      setDrawing({
        userId,
        shape: tool === "select" ? "select" : tool,
        isDrawing: tool !== "select",
      })
    );
    dispatch(setTextEnabled(tool === "text"));
    if (tool === "select") {
      setSelectedId(null);
    }
  };

  const createShape = useCallback(
    (point: { x: number; y: number }) => {
      if (!auth.loggedIn || !spaceId) return;

      let shapeConfig: Omit<ShapeConfig, "id">;

      switch (activeTool) {
        case "circle":
          shapeConfig = {
            type: "circle",
            x: point.x,
            y: point.y,
            radius: 60,
            fill: DEFAULT_COLORS.fill,
            stroke: DEFAULT_COLORS.stroke,
          } as CircleShape;
          break;
        case "arrow":
          shapeConfig = {
            type: "arrow",
            x: point.x,
            y: point.y,
            points: [0, 0, 140, 40],
            fill: "transparent",
            stroke: DEFAULT_COLORS.stroke,
          } as ArrowShape;
          break;
        case "text":
          shapeConfig = {
            type: "text",
            x: point.x,
            y: point.y,
            text: "Double click to edit",
            fontSize: 20,
            fill: "#0f172a",
            stroke: "#0f172a",
          } as TextShape;
          break;
        case "rect":
        default:
          shapeConfig = {
            type: "rect",
            x: point.x,
            y: point.y,
            width: 160,
            height: 100,
            fill: DEFAULT_COLORS.fill,
            stroke: DEFAULT_COLORS.stroke,
          } as RectShape;
          break;
      }

      const newId = generateId();
      const newShape: ShapeConfig = { ...shapeConfig, id: newId } as ShapeConfig;

      setShapes((prev) => ({
        ...prev,
        [newId]: newShape,
      }));

      setSelectedId(newId);

      if (newShape.type === "text") {
        setTextEditor({
          id: newId,
          value: newShape.text ?? "",
          x: newShape.x,
          y: newShape.y,
          fontSize: newShape.fontSize ?? 20,
        });
      }
    },
    [activeTool, auth.loggedIn, spaceId]
  );

  const handleStagePointerDown = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (!stageRef.current || !auth.loggedIn) return;
    const clickedOnEmpty = e.target === e.target.getStage();

    if (activeTool === "select") {
      if (clickedOnEmpty) {
        setSelectedId(null);
      } else {
        setSelectedId(e.target.id());
      }
      return;
    }

    if (!clickedOnEmpty) return;

    const pointerPosition = stageRef.current.getPointerPosition();
    if (!pointerPosition) return;
    createShape(pointerPosition);
  };

  const handleTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    handleStagePointerDown(
      e as unknown as KonvaEventObject<MouseEvent | TouchEvent>
    );
  };

  const handleShapeDragEnd = (id: string, event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    updateShape(id, { x: node.x(), y: node.y() });
  };

  const handleRectTransform = (id: string, event: KonvaEventObject<Event>) => {
    const node = event.target as Konva.Rect;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    updateShape(id, {
      width: Math.max(40, node.width() * scaleX),
      height: Math.max(40, node.height() * scaleY),
      x: node.x(),
      y: node.y(),
    });
  };

  const handleCircleTransform = (id: string, event: KonvaEventObject<Event>) => {
    const node = event.target as KonvaCircle;
    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);

    updateShape(id, {
      radius: Math.max(25, node.radius() * scaleX),
      x: node.x(),
      y: node.y(),
    });
  };

  const handleArrowTransform = (
    id: string,
    originalPoints: number[],
    event: KonvaEventObject<Event>
  ) => {
    const node = event.target as Konva.Arrow;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const newPoints = originalPoints.map((p, idx) =>
      idx % 2 === 0 ? p * scaleX : p * scaleY
    );

    node.scaleX(1);
    node.scaleY(1);

    updateShape(id, {
      points: newPoints,
      x: node.x(),
      y: node.y(),
    });
  };

  const startTextEditing = (shape: ShapeConfig) => {
    if (shape.type !== "text") return;
    setSelectedId(shape.id);
    setTextEditor({
      id: shape.id,
      value: shape.text,
      x: shape.x,
      y: shape.y,
      fontSize: shape.fontSize ?? 18,
    });
    setTimeout(() => textInputRef.current?.focus(), 0);
  };

  const commitTextEditing = () => {
    if (!auth.loggedIn) {
      setTextEditor(null);
      return;
    }
    if (textEditor) {
      updateShape(textEditor.id, { text: textEditor.value });
      setTextEditor(null);
    }
  };

  return (
    <div className="min-h-screen bg-[whitesmoke] text-slate-900 flex flex-col relative">
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Space
          </div>
          <p className="text-lg font-semibold text-slate-900">{spaceName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 border border-slate-100 shadow-sm">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">{participants}</span>
          </div>
        </div>
      </header>

      <div className="px-6 pt-6">
        <div className="w-full max-w-4xl mx-auto bg-white/90 border border-slate-200 rounded-2xl shadow-lg flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {TOOLBAR.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleToolChange(tool.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  activeTool === tool.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
                disabled={!auth.loggedIn}
              >
                {tool.icon}
                {tool.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative mt-4">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          className="bg-[#f5f7fb]"
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleTouchStart}
          ref={stageRef}
        >
          <Layer ref={layerRef}>
            {Object.values(shapes).map((shape) => {
              if (shape.type === "circle") {
                return (
                  <Circle
                    key={shape.id}
                    id={shape.id}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    draggable={activeTool === "select"}
                    onClick={() => setSelectedId(shape.id)}
                    onTap={() => setSelectedId(shape.id)}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) => handleCircleTransform(shape.id, e)}
                    scaleX={1}
                    scaleY={1}
                  />
                );
              }
              if (shape.type === "rect") {
                return (
                  <Rect
                    key={shape.id}
                    id={shape.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    draggable={activeTool === "select"}
                    onClick={() => setSelectedId(shape.id)}
                    onTap={() => setSelectedId(shape.id)}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) => handleRectTransform(shape.id, e)}
                    scaleX={1}
                    scaleY={1}
                  />
                );
              }
              if (shape.type === "arrow") {
                const points = Array.isArray(shape.points)
                  ? shape.points
                  : [0, 0, 0, 0];
                return (
                  <Arrow
                    key={shape.id}
                    id={shape.id}
                    x={shape.x}
                    y={shape.y}
                    points={points}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    draggable={activeTool === "select"}
                    onClick={() => setSelectedId(shape.id)}
                    onTap={() => setSelectedId(shape.id)}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) =>
                      handleArrowTransform(shape.id, points, e)
                    }
                    scaleX={1}
                    scaleY={1}
                  />
                );
              }
              if (shape.type === "text") {
                return (
                  <KonvaText
                    key={shape.id}
                    id={shape.id}
                    x={shape.x}
                    y={shape.y}
                    text={shape.text}
                    fontSize={shape.fontSize}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    draggable={activeTool === "select"}
                    onClick={() => setSelectedId(shape.id)}
                    onTap={() => setSelectedId(shape.id)}
                    onDblClick={() => startTextEditing(shape)}
                    onDblTap={() => startTextEditing(shape)}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                  />
                );
              }
              return null;
            })}

            <Transformer
              ref={transformerRef}
              rotateEnabled={activeTool === "select"}
              anchorSize={8}
              borderStroke="#6366f1"
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 25 || newBox.height < 25) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>

        {textEditor && (
          <textarea
            ref={textInputRef}
            value={textEditor.value}
            onChange={(e) =>
              setTextEditor({ ...textEditor, value: e.target.value })
            }
            onBlur={commitTextEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitTextEditing();
              }
            }}
            style={{
              position: "absolute",
              top: textEditor.y,
              left: textEditor.x,
              padding: "6px 8px",
              minWidth: "180px",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
              fontSize: `${textEditor.fontSize}px`,
              fontFamily: '"Inter", sans-serif',
              background: "rgba(255,255,255,0.95)",
              color: "#0f172a",
            }}
          />
        )}
      </div>

      {showLoginPrompt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full">
            <p className="text-center text-sm text-slate-500 mb-4">
              Please sign in to collaborate on this space. You will return here
              after login.
            </p>
            <Login />
          </div>
        </div>
      )}
    </div>
  );
};

export default Canva;
