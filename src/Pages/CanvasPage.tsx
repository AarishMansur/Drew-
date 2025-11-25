import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Stage, Layer, Rect } from "react-konva";
import { useAppDispatch, useAppSelector } from "../app/store";
import { setShapes, upsertShape, removeShape } from "../features/CanvaSlice";
import { supabase } from "../lib/supabaseClient";
import { type Shape } from "../features/CanvaSlice";
import { gsap } from "gsap";

export default function CanvasPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const dispatch = useAppDispatch();
  const shapes = Object.values(
    useAppSelector((s) => s.canvas.shapes)
  ).filter((s) => s.spaceId === spaceId);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // small GSAP entrance animation
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

  const handleCanvasClick = async (evt: any) => {
    if (!spaceId) return;
    const stage = evt.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const { x, y } = pointerPos;

    const { data, error } = await supabase
      .from("shapes")
      .insert([
        {
          space_id: spaceId,
          type: "rect",
          x,
          y,
          width: 120,
          height: 60,
          rotation: 0,
          props: { fill: "#3b82f6" },
        },
      ])
      .select("*")
      .single();

    if (!error && data) {
      // Realtime will also push, but this keeps local fast
      dispatch(
        upsertShape({
          id: data.id,
          spaceId,
          type: data.type,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
          props: data.props,
        })
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div>
          <h1 className="text-sm font-semibold">Space: {spaceId}</h1>
          <p className="text-xs text-slate-400">
            Click anywhere to drop a rectangle. All changes are synced.
          </p>
        </div>
        {/* Later: add "Invite", "Undo", etc. */}
      </header>

      <div ref={containerRef} className="flex-1">
        <Stage
          width={window.innerWidth}
          height={window.innerHeight - 48}
          onMouseDown={handleCanvasClick}
          className="bg-slate-900"
        >
          <Layer>
            {shapes.map((s) => (
              <Rect
                key={s.id}
                x={s.x}
                y={s.y}
                width={s.width}
                height={s.height}
                rotation={s.rotation}
                fill={s.props?.fill || "#3b82f6"}
                draggable
                onDragEnd={async (e) => {
                  const { x, y } = e.target.position();
                  await supabase
                    .from("shapes")
                    .update({ x, y })
                    .eq("id", s.id);
                }}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
