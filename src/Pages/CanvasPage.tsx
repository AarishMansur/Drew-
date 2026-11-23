/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Line,
  Arrow,
  Text,
  Transformer,
} from "react-konva";
import { useAppDispatch, useAppSelector } from "../app/store";
import { setShapes, upsertShape, removeShape } from "../features/CanvaSlice";
import { supabase } from "../lib/supaBaseClient";
import type { Shape, shapeType } from "../features/CanvaSlice";
import { gsap } from "gsap";
import { ArrowLeft, Users } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import Toolbar from "../components/Toolbar";

function shapeFromRow(row: any): Shape {
  return {
    id: row.id,
    spaceId: row.space_id,
    type: row.type,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    props: row.props,
    points: row.points,
    text: row.text_value,
  };
}

export default function CanvasPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [tool, setTool] = useState<shapeType>("rect");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState<string>("");
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const dispatch = useAppDispatch();
  const shapesById = useAppSelector((s) => s.canvas.shapes);
  const shapes = Object.values(shapesById).filter((s) => s.spaceId === spaceId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const shapesRef = useRef(shapesById);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    shapesRef.current = shapesById;
    selectedIdRef.current = selectedId;
  });

  const handleSelect = (id: string) => () => setSelectedId(id);

  const persistShape = async (id: string, patch: Partial<Shape>, row: Record<string, unknown>) => {
    const current = shapesRef.current[id];
    if (!current) return;
    dispatch(upsertShape({ ...current, ...patch }));
    const { error } = await supabase.from("shapes").update(row).eq("id", id);
    if (error) {
      dispatch(upsertShape(current));
      toast.error(error.message || "Could not save shape");
    }
  };

  const handleTransform = (id: string) => async (e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const patch: Partial<Shape> = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };
    const row: Record<string, unknown> = {
      x: patch.x,
      y: patch.y,
      rotation: patch.rotation,
    };

    if (typeof node.width === "function" && typeof node.height === "function") {
      patch.width = node.width() * scaleX;
      patch.height = node.height() * scaleY;
      row.width = patch.width;
      row.height = patch.height;
    }

    node.scaleX(1);
    node.scaleY(1);

    await persistShape(id, patch, row);
  };

  const handleDrag = (id: string) => async (e: any) => {
    const node = e.target;
    await persistShape(id, { x: node.x(), y: node.y() }, { x: node.x(), y: node.y() });
  };

  const clearCanvas = async () => {
    if (!spaceId) return;
    const removed = Object.values(shapesRef.current).filter((s) => s.spaceId === spaceId);
    removed.forEach((s) => dispatch(removeShape(s.id)));
    setSelectedId(null);
    const { error } = await supabase.from("shapes").delete().eq("space_id", spaceId);
    if (error) {
      removed.forEach((s) => dispatch(upsertShape(s)));
      toast.error(error.message || "Could not clear canvas");
    }
  };

  useEffect(() => {
    if (!spaceId) return;
    const fetchSpace = async () => {
      const { data } = await supabase
        .from("spaces")
        .select("name")
        .eq("id", spaceId)
        .single();
      if (data) setSpaceName(data.name);
    };
    fetchSpace();
  }, [spaceId]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4 }
      );
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!spaceId) return;

    const loadShapes = async () => {
      const { data, error } = await supabase
        .from("shapes")
        .select("*")
        .eq("space_id", spaceId);

      if (error) {
        toast.error(error.message || "Could not load shapes");
        return;
      }

      dispatch(
        setShapes({
          spaceId,
          shapes: (data ?? []).map(shapeFromRow),
        })
      );
    };

    loadShapes();

    const channel = supabase
      .channel(`space:${spaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shapes",
          filter: `space_id=eq.${spaceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            dispatch(upsertShape(shapeFromRow(payload.new)));
          } else if (payload.eventType === "DELETE") {
            const id = payload.old.id as string;
            dispatch(removeShape(id));
            setSelectedId((current) => (current === id ? null : current));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, dispatch]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;

      const id = selectedIdRef.current;
      if (!id) return;

      const current = shapesRef.current[id];
      dispatch(removeShape(id));
      setSelectedId(null);

      const { error } = await supabase.from("shapes").delete().eq("id", id);
      if (error) {
        if (current) dispatch(upsertShape(current));
        setSelectedId(id);
        toast.error(error.message || "Could not delete shape");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;

    const stage = layerRef.current.getStage();
    if (!stage) return;

    const node = stage.findOne(`#${selectedId}`);
    transformerRef.current.nodes(node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, shapes]);

  const handleCanvasClick = async (evt: any) => {
    if (!spaceId) return;

    const stage = evt.target.getStage();
    if (!stage) return;

    const clickedOnEmpty = evt.target === stage;
    if (!clickedOnEmpty) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const tempId = crypto.randomUUID();
    const base = {
      space_id: spaceId,
      x: pos.x,
      y: pos.y,
      rotation: 0,
      props: { stroke: "#000", fill: "#3b82f6" },
    };

    let shapeData: any = {};

    if (tool === "rect")
      shapeData = { ...base, type: "rect", width: 120, height: 70 };

    if (tool === "circle")
      shapeData = { ...base, type: "circle", width: 80, height: 80 };

    if (tool === "line")
      shapeData = { ...base, type: "line", points: [0, 0, 100, 0] };

    if (tool === "arrow")
      shapeData = { ...base, type: "arrow", points: [0, 0, 100, 0] };

    if (tool === "text")
      shapeData = {
        ...base,
        type: "text",
        text_value: "Double-click to edit",
        props: { fontSize: 20, fill: "#000" },
      };

    const local: Shape = {
      id: tempId,
      spaceId,
      type: shapeData.type,
      x: shapeData.x,
      y: shapeData.y,
      width: shapeData.width ?? 0,
      height: shapeData.height ?? 0,
      rotation: 0,
      props: shapeData.props,
      points: shapeData.points,
      text: shapeData.text_value,
    };

    dispatch(upsertShape(local));

    const { data, error } = await supabase.from("shapes").insert([shapeData]).select("*").single();
    if (error || !data) {
      dispatch(removeShape(tempId));
      toast.error(error?.message || "Could not create shape");
      return;
    }
    dispatch(upsertShape(shapeFromRow(data)));
    dispatch(removeShape(tempId));
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
      />
      <Toolbar tool={tool} setTool={setTool} clearCanvas={clearCanvas} />

      <div className="fixed top-4 left-4 z-40">
        <button
          onClick={() => navigate("/spaces")}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border-2 border-gray-900 text-gray-900 font-semibold hover:bg-gray-50 transition-all duration-200 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="fixed top-4 right-4 z-40">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border-2 border-gray-900 shadow-lg">
          <Users className="w-4 h-4 text-gray-700" />
          <span className="text-sm font-semibold text-gray-900 google-sans">
            {spaceName || "Space"}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 bg-gray-50">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleCanvasClick}
          className="bg-white"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
          }}
        >
          <Layer ref={layerRef}>
            {shapes.map((s) => {
              switch (s.type) {
                case "rect":
                  return (
                    <Rect
                      id={s.id}
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      width={s.width}
                      height={s.height}
                      rotation={s.rotation}
                      fill={s.props?.fill}
                      stroke={s.props?.stroke}
                      strokeWidth={2}
                      draggable
                      onDragEnd={handleDrag(s.id)}
                      onClick={handleSelect(s.id)}
                      onTransformEnd={handleTransform(s.id)}
                    />
                  );

                case "circle":
                  return (
                    <Circle
                      id={s.id}
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      radius={(s.width ?? 80) / 2}
                      fill={s.props?.fill}
                      stroke={s.props?.stroke}
                      strokeWidth={2}
                      draggable
                      onDragEnd={handleDrag(s.id)}
                      onClick={handleSelect(s.id)}
                      onTransformEnd={handleTransform(s.id)}
                    />
                  );

                case "line":
                  return (
                    <Line
                      id={s.id}
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      points={s.points ?? []}
                      stroke={s.props?.stroke || "#000"}
                      strokeWidth={3}
                      draggable
                      onClick={handleSelect(s.id)}
                      onDragEnd={handleDrag(s.id)}
                    />
                  );

                case "arrow":
                  return (
                    <Arrow
                      id={s.id}
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      points={s.points ?? []}
                      stroke={s.props?.stroke || "#000"}
                      strokeWidth={3}
                      draggable
                      onClick={handleSelect(s.id)}
                      onDragEnd={handleDrag(s.id)}
                    />
                  );

                case "text":
                  return (
                    <Text
                      id={s.id}
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      text={s.text ?? ""}
                      fontSize={s.props?.fontSize || 18}
                      fill={s.props?.fill || "#000"}
                      draggable
                      onDragEnd={handleDrag(s.id)}
                      onClick={handleSelect(s.id)}
                      onDblClick={(e) => {
                        const node = e.target;
                        const stage = node.getStage();
                        if (!stage) return;

                        const textPos = node.getAbsolutePosition();
                        const stageRect = stage.container().getBoundingClientRect();

                        const area = document.createElement("textarea");
                        area.value = s.text ?? "";
                        area.style.position = "absolute";
                        area.style.top = stageRect.top + textPos.y + "px";
                        area.style.left = stageRect.left + textPos.x + "px";
                        area.style.fontSize = (s.props?.fontSize || 18) + "px";
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

                        area.addEventListener("blur", async () => {
                          const newText = area.value;
                          document.body.removeChild(area);
                          await persistShape(s.id, { text: newText }, { text_value: newText });
                        });
                      }}
                    />
                  );

                default:
                  return null;
              }
            })}

            <Transformer ref={transformerRef} />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
