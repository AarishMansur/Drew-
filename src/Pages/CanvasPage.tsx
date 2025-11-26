import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
import Toolbar from "../components/Toolbar";

export default function CanvasPage() {
  const { spaceId } = useParams<{ spaceId: string }>();

  const [tool, setTool] = useState<shapeType>("rect");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const shapes = Object.values(
    useAppSelector((s) => s.canvas.shapes)
  ).filter((s) => s.spaceId === spaceId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const handleSelect = (id: string) => () => setSelectedId(id);

  // ----------------------------
  // RESIZE
  // ----------------------------
  const handleTransform = (id: string) => async (e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const update: any = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };

    if (typeof node.width === "function" && typeof node.height === "function") {
      update.width = node.width() * scaleX;
      update.height = node.height() * scaleY;
    }

    node.scaleX(1);
    node.scaleY(1);

    await supabase.from("shapes").update(update).eq("id", id);
  };


  const handleDrag = (id: string) => async (e: any) => {
    const node = e.target;
    await supabase
      .from("shapes")
      .update({ x: node.x(), y: node.y() })
      .eq("id", id);
  };

  const handleDragLine = (id: string) => async (e: any) => {
    const node = e.target;

    await supabase
      .from("shapes")
      .update({ x: node.x(), y: node.y() })
      .eq("id", id);
  };

  // ----------------------------
  // CLEAR CANVAS
  // ----------------------------
  const clearCanvas = async () => {
    if (!spaceId) return;

    await supabase.from("shapes").delete().eq("space_id", spaceId);

    shapes.forEach((s) => dispatch(removeShape(s.id)));
    setSelectedId(null);
  };

  // ----------------------------
  // ENTRANCE ANIMATION
  // ----------------------------
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4 }
      );
    }
  }, []);

  // ----------------------------
  // LOAD SHAPES + REALTIME
  // ----------------------------
  useEffect(() => {
    if (!spaceId) return;

    const loadShapes = async () => {
      const { data, error } = await supabase
        .from("shapes")
        .select("*")
        .eq("space_id", spaceId);

      if (!error && data) {
        dispatch(
          setShapes(
            data.map((row: any) => ({
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
            })) as Shape[]
          )
        );
      }
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
            const row: any = payload.new;

            dispatch(
              upsertShape({
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
              })
            );
          } else if (payload.eventType === "DELETE") {
            dispatch(removeShape(payload.old.id as string));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, dispatch]);

  // ----------------------------
  // DELETE SELECTED ITEM
  // ----------------------------
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedId) {
        const { error } = await supabase
          .from("shapes")
          .delete()
          .eq("id", selectedId);

        if (!error) {
          dispatch(removeShape(selectedId));
          setSelectedId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  // ----------------------------
  // TRANSFORMER
  // ----------------------------
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

    const base = {
      space_id: spaceId,
      x: pos.x,
      y: pos.y,
      rotation: 0,
      props: { stroke: "#fff", fill: "#3b82f6" },
    };

    let shapeData: any = {};

    if (tool === "rect")
      shapeData = { ...base, type: "rect", width: 120, height: 70 };

    if (tool === "circle")
      shapeData = { ...base, type: "circle", width: 80, height: 80 };

    if (tool === "line")
      shapeData = { ...base, type: "line", points: [0, 0, 50, 0] };

    if (tool === "arrow")
      shapeData = { ...base, type: "arrow", points: [0, 0, 50, 0] };

    if (tool === "text")
      shapeData = {
        ...base,
        type: "text",
        text_value: "New Text",
        props: { fontSize: 20, fill: "#fff" },
      };

    const { data } = await supabase
      .from("shapes")
      .insert([shapeData])
      .select("*")
      .single();

    if (!data) return;

    dispatch(
      upsertShape({
        id: data.id,
        spaceId: data.space_id,
        type: data.type,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        rotation: data.rotation,
        props: data.props,
        points: data.points,
        text: data.text_value,
      })
    );
  };

  // ----------------------------
  // RENDER SHAPES
  // ----------------------------
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div>
          <h1 className="text-sm font-semibold">Space: {spaceId}</h1>
          <p className="text-xs text-slate-400">
            Click anywhere to drop a shape. All changes are synced.
          </p>
        </div>
        <Toolbar
          tool={tool}
          setTool={setTool}
          clearCanvas={clearCanvas}
        />
      </header>

      <div ref={containerRef} className="flex-1">
        <Stage
          width={window.innerWidth}
          height={window.innerHeight - 48}
          onMouseDown={handleCanvasClick}
          className="bg-slate-900"
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
                      stroke={s.props?.stroke || "white"}
                      strokeWidth={3}
                      draggable
                      onClick={handleSelect(s.id)}
                      onDragEnd={handleDragLine(s.id)}
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
                      stroke={s.props?.stroke || "white"}
                      strokeWidth={3}
                      draggable
                      onClick={handleSelect(s.id)}
                      onDragEnd={handleDragLine(s.id)}
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
                      fill={s.props?.fill || "white"}
                      draggable
                      onDragEnd={handleDrag(s.id)}
                      onClick={handleSelect(s.id)}
                      onDblClick={(e) => {
                        const node = e.target;
                        const stage = node.getStage();
                        if (!stage) return;

                        const textPos = node.getAbsolutePosition();
                        const stageRect =
                          stage.container().getBoundingClientRect();

                        const area = document.createElement("textarea");
                        area.value = s.text ?? "";
                        area.style.position = "absolute";
                        area.style.top = stageRect.top + textPos.y + "px";
                        area.style.left = stageRect.left + textPos.x + "px";
                        area.style.fontSize =

                          (s.props?.fontSize || 18) + "px";
                        area.style.padding = "0px";
                        area.style.margin = "0px";
                        area.style.border = "1px solid white";
                        area.style.background = "black";
                        area.style.color = "white";
                        area.style.outline = "none";
                        area.style.resize = "none";
                        area.style.zIndex = "99999";

                        document.body.appendChild(area);
                        area.focus();
                        area.select();

                        area.addEventListener("blur", async () => {
                          const newText = area.value;
                          document.body.removeChild(area);

                          await supabase
                            .from("shapes")
                            .update({ text_value: newText })
                            .eq("id", s.id);

                          dispatch(
                            upsertShape({
                              ...s,
                              text: newText,
                            })
                          );
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
