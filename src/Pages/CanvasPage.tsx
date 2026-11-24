/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowLeft, Users } from "lucide-react";
import { ToastContainer } from "react-toastify";
import { useAppSelector } from "../app/store";
import DrawingStage from "../components/DrawingStage";
import Inspector from "../components/Inspector";
import Toolbar, { type CanvasTool } from "../components/Toolbar";
import type { Shape } from "../features/CanvaSlice";
import { GRID } from "../features/canvasGeometry";
import { usePresence } from "../hooks/usePresence";
import { useSpaceShapes } from "../hooks/useSpaceShapes";
import { supabase } from "../lib/supaBaseClient";
import { canEditRole, isMissingRelation, type SpaceRole } from "../lib/sharing";

export default function CanvasPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const [tool, setTool] = useState<CanvasTool>("select");
  const [locked, setLocked] = useState(false);
  const [spacePan, setSpacePan] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState("");
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [role, setRole] = useState<SpaceRole | "none" | "loading">("loading");

  const canEdit = canEditRole(role);
  const member = role === "owner" || role === "editor" || role === "viewer";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const selectedIdRef = useRef(selectedId);
  const spaceNameRef = useRef(spaceName);
  const lockedRef = useRef(locked);

  const board = useSpaceShapes({
    spaceId,
    enabled: member,
    canEdit,
    onShapeRemoved: (id) => {
      setSelectedId((current) => (current === id ? null : current));
    },
    onCleared: () => {
      setSelectedId(null);
    },
  });

  const presence = usePresence({
    spaceId,
    user,
    enabled: member,
    onRemoteDrag: board.previewMove,
  });

  useEffect(() => {
    selectedIdRef.current = selectedId;
    spaceNameRef.current = spaceName;
    lockedRef.current = locked;
  });

  useEffect(() => {
    if (!spaceId || !user) return;
    let gone = false;
    (async () => {
      const { data, error } = await supabase
        .from("space_members")
        .select("role, spaces(name)")
        .eq("space_id", spaceId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (gone) return;
      if (error && isMissingRelation(error)) {
        setRole("owner");
        const named = await supabase.from("spaces").select("name").eq("id", spaceId).maybeSingle();
        if (!gone && named.data?.name) setSpaceName(named.data.name);
        return;
      }
      if (error || !data) {
        setRole("none");
        return;
      }
      const nextRole = data.role as SpaceRole;
      setRole(nextRole);
      if (nextRole === "viewer") {
        setTool("pan");
        setLocked(false);
      }
      const space = data.spaces as { name?: string } | { name?: string }[] | null;
      const record = Array.isArray(space) ? space[0] : space;
      if (record?.name) setSpaceName(record.name);
    })();
    return () => {
      gone = true;
    };
  }, [spaceId, user]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 });
    }
  }, [role]);

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
  }, [role]);

  const duplicate = async () => {
    const id = selectedIdRef.current;
    const source = id ? board.getShape(id) : undefined;
    if (!source || !spaceId) return;
    const connected = source.type === "arrow" && source.props?.fromId && source.props?.toId;
    const saved = await board.insertShape(
      {
        ...source,
        x: connected ? source.x : source.x + GRID,
        y: connected ? source.y : source.y + GRID,
        props: { ...source.props },
        points: source.points ? [...source.points] : undefined,
      },
      false,
      true
    );
    if (saved) setSelectedId(saved.id);
  };

  const nudge = (id: string, dx: number, dy: number) => {
    const current = board.getShape(id);
    if (!current || (current.type === "arrow" && current.props?.fromId && current.props?.toId)) return;
    void board.persistShape(
      id,
      { x: current.x + dx, y: current.y + dy },
      { x: current.x + dx, y: current.y + dy }
    );
  };

  const changeZ = (direction: 1 | -1) => {
    const id = selectedIdRef.current;
    const current = id ? board.getShape(id) : undefined;
    if (!current || !spaceId || !id) return;
    const indexes = board.shapes.map((shape) => Number(shape.props?.zIndex) || 0);
    const next = direction > 0 ? Math.max(...indexes) + 1 : Math.min(...indexes) - 1;
    const props = { ...current.props, zIndex: next };
    void board.persistShape(id, { props }, { props });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) setSpacePan(true);
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        setLocked(false);
        if (canEdit) setTool("select");
        return;
      }
      if (!canEdit) return;
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) void board.redo();
        else void board.undo();
        return;
      }
      if (meta && key === "y") {
        event.preventDefault();
        void board.redo();
        return;
      }
      if (meta && key === "d") {
        event.preventDefault();
        void duplicate();
        return;
      }
      if (!meta && !event.altKey) {
        const shortcuts: Partial<Record<string, CanvasTool>> = {
          v: "select",
          h: "pan",
          r: "rect",
          o: "circle",
          l: "line",
          a: "arrow",
          t: "text",
        };
        const nextTool = shortcuts[key];
        if (nextTool) {
          setTool(nextTool);
          setLocked(false);
          return;
        }
      }
      if (event.key === "Delete") {
        const id = selectedIdRef.current;
        if (id) void board.deleteShape(id, true);
        return;
      }
      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        const id = selectedIdRef.current;
        if (!id) return;
        event.preventDefault();
        const step = event.shiftKey ? GRID : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        nudge(id, dx, dy);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const exportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const link = document.createElement("a");
    link.href = stage.toDataURL({ pixelRatio: 2 });
    link.download = `${spaceNameRef.current || "drew"}.png`;
    link.click();
  };

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const oldScale = viewport.scale;
    const next = Math.min(4, Math.max(0.2, oldScale * Math.exp(-event.evt.deltaY * 0.001)));
    const worldX = (pointer.x - viewport.x) / oldScale;
    const worldY = (pointer.y - viewport.y) / oldScale;
    setViewport({
      scale: next,
      x: pointer.x - worldX * next,
      y: pointer.y - worldY * next,
    });
  };

  const pickTool = (next: CanvasTool) => {
    if (!canEdit && next !== "pan") return;
    if (next === tool && next !== "select" && next !== "pan") {
      setLocked((value) => !value);
      return;
    }
    setTool(next);
    setLocked(false);
  };

  const createShape = (partial: Omit<Shape, "id" | "spaceId">) => {
    if (!spaceId) return;
    void board.insertShape({ ...partial, id: "", spaceId }, false, true).then((saved) => {
      if (!saved) return;
      setSelectedId(saved.id);
      if (saved.type === "text") setEditingId(saved.id);
    });
  };

  const endGesture = () => {
    if (!lockedRef.current) setTool("select");
  };

  const selectedShape = selectedId ? board.shapesById[selectedId] : undefined;

  if (role === "loading" || role === "none") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white text-gray-900">
        <p className="text-lg font-medium">
          {role === "loading" ? "Opening space..." : "You don't have access to this space."}
        </p>
        {role === "none" && (
          <button
            onClick={() => navigate("/spaces")}
            className="px-4 py-2 border-2 border-gray-900 rounded-xl font-semibold"
          >
            Back to spaces
          </button>
        )}
      </div>
    );
  }

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
      <Toolbar
        tool={tool}
        locked={locked}
        onPick={pickTool}
        clearCanvas={() => void board.clearSpace()}
        undo={() => void board.undo()}
        redo={() => void board.redo()}
        duplicate={() => void duplicate()}
        exportPng={exportPng}
        canUndo={board.canUndo}
        canRedo={board.canRedo}
        canDuplicate={Boolean(selectedShape)}
        canEdit={canEdit}
      />

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
          <span className="text-sm font-semibold text-gray-900 google-sans">{spaceName || "Space"}</span>
          {presence.peers.map((peer) => (
            <span key={peer.id} className="text-xs font-semibold" style={{ color: peer.color }}>
              {peer.name}
            </span>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 bg-gray-50">
        <DrawingStage
          stageRef={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          viewport={viewport}
          tool={tool}
          pan={tool === "pan" || spacePan}
          canEdit={canEdit}
          shapes={board.shapes}
          shapesById={board.shapesById}
          shapesRef={board.shapesRef}
          selectedId={selectedId}
          editingId={editingId}
          cursors={presence.cursors}
          onPanEnd={(x, y) => setViewport((current) => ({ ...current, x, y }))}
          onWheel={handleWheel}
          onCursor={presence.publishCursor}
          onSelect={setSelectedId}
          onCreate={createShape}
          onGestureEnd={endGesture}
          onEditingDone={() => setEditingId(null)}
          onDragStart={board.beginGesture}
          onDragMove={presence.publishDrag}
          onDragEnd={(id, x, y) => void board.commitMove(id, x, y)}
          onPersist={(id, patch, row) => void board.persistShape(id, patch, row)}
        />
      </div>

      {canEdit && selectedShape && (
        <Inspector
          shape={selectedShape}
          onPatch={(patch, row) => void board.persistShape(selectedShape.id, patch, row)}
          onFront={() => changeZ(1)}
          onBack={() => changeZ(-1)}
        />
      )}
      {locked && tool !== "select" && tool !== "pan" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm">
          Tool stays on until you unlock it
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-white border-2 border-gray-900 rounded-xl text-xs font-semibold">
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  );
}
