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
  Group,
} from "react-konva";
import { useAppDispatch, useAppSelector } from "../app/store";
import { setShapes, upsertShape, removeShape } from "../features/CanvaSlice";
import { supabase } from "../lib/supaBaseClient";
import type { Shape } from "../features/CanvaSlice";
import { gsap } from "gsap";
import { ArrowLeft, Users } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import Toolbar, { type CanvasTool } from "../components/Toolbar";
import Inspector from "../components/Inspector";
import {
  GRID,
  connectorPoints,
  gridLines,
  isConnectedArrow,
  snap,
} from "../features/canvasGeometry";
import { canEditRole, colorFor, displayName, isMissingRelation, type SpaceRole } from "../lib/sharing";

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
    updatedAt: row.updated_at,
  };
}

function shapeToRow(shape: Shape, includeId: boolean) {
  const row: Record<string, unknown> = {
    space_id: shape.spaceId,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    rotation: shape.rotation,
    props: shape.props ?? {},
    points: shape.points ?? null,
    text_value: shape.text ?? null,
  };
  if (includeId) row.id = shape.id;
  return row;
}

function sameShape(a: Shape, b: Shape) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.text === b.text &&
    JSON.stringify(a.points) === JSON.stringify(b.points) &&
    JSON.stringify(a.props) === JSON.stringify(b.props)
  );
}

type HistoryCmd =
  | { type: "update"; before: Shape; after: Shape }
  | { type: "create"; shape: Shape }
  | { type: "remove"; shape: Shape }
  | { type: "remove-many"; shapes: Shape[] };

function canvasPointer(stage: any) {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  return transform.point(pointer);
}

async function saveShapeUpdate(id: string, row: Record<string, unknown>, guard?: string) {
  let query = supabase.from("shapes").update(row).eq("id", id);
  if (guard) query = query.eq("updated_at", guard);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return { error };
  if (!data) {
    const fresh = await supabase.from("shapes").select("*").eq("id", id).maybeSingle();
    if (fresh.error) return { error: fresh.error };
    return { conflict: fresh.data ? shapeFromRow(fresh.data) : null };
  }
  return { saved: shapeFromRow(data) };
}

export default function CanvasPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [tool, setTool] = useState<CanvasTool>("rect");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState<string>("");
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [role, setRole] = useState<SpaceRole | "none" | "loading">("loading");
  const [peers, setPeers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; name: string; color: string }>>({});

  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const canEdit = canEditRole(role);
  const shapesById = useAppSelector((s) => s.canvas.shapes);
  const shapes = Object.values(shapesById)
    .filter((s) => s.spaceId === spaceId)
    .sort((a, b) => (a.props?.zIndex ?? 0) - (b.props?.zIndex ?? 0) || a.id.localeCompare(b.id));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const shapesRef = useRef(shapesById);
  const selectedIdRef = useRef(selectedId);
  const gestureBefore = useRef<Shape | null>(null);
  const undoStack = useRef<HistoryCmd[]>([]);
  const redoStack = useRef<HistoryCmd[]>([]);
  const spaceNameRef = useRef(spaceName);
  const canEditRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cursorAt = useRef(0);

  useEffect(() => {
    shapesRef.current = shapesById;
    selectedIdRef.current = selectedId;
    spaceNameRef.current = spaceName;
    canEditRef.current = canEdit;
  });

  const syncHistory = () => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  };

  const pushHistory = (cmd: HistoryCmd) => {
    undoStack.current.push(cmd);
    redoStack.current = [];
    syncHistory();
  };

  const dropHistory = (cmd: HistoryCmd) => {
    const stack = undoStack.current;
    if (stack[stack.length - 1] === cmd) stack.pop();
    syncHistory();
  };

  const writeShape = async (shape: Shape) => {
    const guard = shapesRef.current[shape.id]?.updatedAt ?? shape.updatedAt;
    dispatch(upsertShape({ ...shape, updatedAt: guard }));
    const result = await saveShapeUpdate(
      shape.id,
      {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        rotation: shape.rotation,
        props: shape.props ?? {},
        points: shape.points ?? null,
        text_value: shape.text ?? null,
      },
      guard
    );
    if ("error" in result && result.error) {
      toast.error(result.error.message || "Could not save shape");
      return;
    }
    if ("conflict" in result) {
      if (result.conflict) dispatch(upsertShape(result.conflict));
      else dispatch(removeShape(shape.id));
      toast.error("Someone else changed this shape");
      return;
    }
    if ("saved" in result && result.saved) dispatch(upsertShape(result.saved));
  };

  const persistShape = async (
    id: string,
    patch: Partial<Shape>,
    row: Record<string, unknown>,
    beforeOverride?: Shape
  ) => {
    const current = shapesRef.current[id];
    if (!current || !canEditRef.current) return;
    const before = beforeOverride ?? current;
    const after = { ...current, ...patch };
    const changed = !sameShape(before, after);
    const cmd: HistoryCmd = { type: "update", before, after };
    if (changed) pushHistory(cmd);
    dispatch(upsertShape(after));
    const result = await saveShapeUpdate(id, row, before.updatedAt);
    if ("error" in result && result.error) {
      if (changed) dropHistory(cmd);
      dispatch(upsertShape(before));
      toast.error(result.error.message || "Could not save shape");
      return;
    }
    if ("conflict" in result) {
      if (changed) dropHistory(cmd);
      if (result.conflict) dispatch(upsertShape(result.conflict));
      else dispatch(removeShape(id));
      toast.error("Someone else changed this shape");
      return;
    }
    if ("saved" in result && result.saved) dispatch(upsertShape(result.saved));
  };

  const insertShape = async (draft: Shape, keepId: boolean, record: boolean) => {
    if (!keepId && !canEditRef.current) return null;
    const tempId = keepId ? draft.id : crypto.randomUUID();
    const local = { ...draft, id: tempId };
    dispatch(upsertShape(local));
    const { data, error } = await supabase
      .from("shapes")
      .insert([shapeToRow(local, keepId)])
      .select("*")
      .single();
    if (error || !data) {
      dispatch(removeShape(tempId));
      toast.error(error?.message || "Could not create shape");
      return null;
    }
    const saved = shapeFromRow(data);
    dispatch(upsertShape(saved));
    if (!keepId && saved.id !== tempId) dispatch(removeShape(tempId));
    if (record) pushHistory({ type: "create", shape: saved });
    return saved;
  };

  const deleteShape = async (id: string, record: boolean) => {
    const current = shapesRef.current[id];
    if (!current || (record && !canEditRef.current)) return false;
    const cmd: HistoryCmd = { type: "remove", shape: current };
    if (record) pushHistory(cmd);
    dispatch(removeShape(id));
    if (selectedIdRef.current === id) setSelectedId(null);
    setConnectFrom((from) => (from === id ? null : from));
    const { error } = await supabase.from("shapes").delete().eq("id", id);
    if (error) {
      if (record) dropHistory(cmd);
      dispatch(upsertShape(current));
      toast.error(error.message || "Could not delete shape");
      return false;
    }
    return true;
  };

  const restoreShape = async (shape: Shape) => {
    dispatch(upsertShape(shape));
    const { error } = await supabase.from("shapes").insert([shapeToRow(shape, true)]);
    if (error) {
      dispatch(removeShape(shape.id));
      toast.error(error.message || "Could not restore shape");
    }
  };

  const undo = async () => {
    const cmd = undoStack.current.pop();
    if (!cmd) return;
    redoStack.current.push(cmd);
    syncHistory();
    if (cmd.type === "update") await writeShape(cmd.before);
    if (cmd.type === "create") await deleteShape(cmd.shape.id, false);
    if (cmd.type === "remove") await restoreShape(cmd.shape);
    if (cmd.type === "remove-many") {
      for (const shape of cmd.shapes) await restoreShape(shape);
    }
  };

  const redo = async () => {
    const cmd = redoStack.current.pop();
    if (!cmd) return;
    undoStack.current.push(cmd);
    syncHistory();
    if (cmd.type === "update") await writeShape(cmd.after);
    if (cmd.type === "create") await restoreShape(cmd.shape);
    if (cmd.type === "remove") await deleteShape(cmd.shape.id, false);
    if (cmd.type === "remove-many") {
      for (const shape of cmd.shapes) await deleteShape(shape.id, false);
    }
  };

  const duplicate = async () => {
    const id = selectedIdRef.current;
    const source = id ? shapesRef.current[id] : null;
    if (!source || !spaceId) return;
    const connected = isConnectedArrow(source);
    const saved = await insertShape(
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
    const current = shapesRef.current[id];
    if (!current || isConnectedArrow(current) || !canEditRef.current) return;
    void persistShape(id, { x: current.x + dx, y: current.y + dy }, { x: current.x + dx, y: current.y + dy });
  };

  const changeZ = (direction: 1 | -1) => {
    const id = selectedIdRef.current;
    const current = id ? shapesRef.current[id] : null;
    if (!current || !spaceId) return;
    const indexes = Object.values(shapesRef.current)
      .filter((shape) => shape.spaceId === spaceId)
      .map((shape) => Number(shape.props?.zIndex) || 0);
    const next = direction > 0 ? Math.max(...indexes) + 1 : Math.min(...indexes) - 1;
    const props = { ...current.props, zIndex: next };
    void persistShape(id!, { props }, { props });
  };

  const exportPng = () => {
    const stage = layerRef.current?.getStage();
    if (!stage) return;
    const link = document.createElement("a");
    link.href = stage.toDataURL({ pixelRatio: 2 });
    link.download = `${spaceNameRef.current || "drew"}.png`;
    link.click();
  };

  const handleTransform = (id: string) => async (e: any) => {
    const node = e.target;
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
    await persistShape(id, patch, row);
  };

  const handleDragStart = (id: string) => () => {
    gestureBefore.current = shapesRef.current[id] ?? null;
  };

  const handleDragMove = (id: string) => (e: any) => {
    const current = shapesRef.current[id];
    if (!current) return;
    const x = e.target.x();
    const y = e.target.y();
    if (current.x === x && current.y === y) return;
    dispatch(upsertShape({ ...current, x, y }));
    const me = user?.id;
    if (!me) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: "drag",
      payload: { id, x, y, userId: me },
    });
  };

  const handleDragEnd = (id: string) => async (e: any) => {
    const x = snap(e.target.x());
    const y = snap(e.target.y());
    e.target.position({ x, y });
    await persistShape(id, { x, y }, { x, y }, gestureBefore.current ?? undefined);
  };

  const clearCanvas = async () => {
    if (!spaceId || !canEditRef.current) return;
    const removed = Object.values(shapesRef.current).filter((s) => s.spaceId === spaceId);
    if (removed.length === 0) return;
    const cmd: HistoryCmd = { type: "remove-many", shapes: removed };
    pushHistory(cmd);
    removed.forEach((s) => dispatch(removeShape(s.id)));
    setSelectedId(null);
    setConnectFrom(null);
    const { error } = await supabase.from("shapes").delete().eq("space_id", spaceId);
    if (error) {
      dropHistory(cmd);
      removed.forEach((s) => dispatch(upsertShape(s)));
      toast.error(error.message || "Could not clear canvas");
    }
  };

  const onShapeClick = (id: string) => (e: any) => {
    e.cancelBubble = true;
    if (tool === "pan" || !canEdit) return;
    if (tool === "arrow") {
      if (!connectFrom || connectFrom === id) {
        setConnectFrom(id);
        setSelectedId(id);
        return;
      }
      const from = shapesRef.current[connectFrom];
      const to = shapesRef.current[id];
      setConnectFrom(null);
      setSelectedId(id);
      if (!from || !to || !spaceId) return;
      const points = connectorPoints(from, to);
      void insertShape(
        {
          ...from,
          spaceId,
          type: "arrow",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          points,
          text: undefined,
          props: { stroke: "#000", fill: "#000", fromId: from.id, toId: to.id },
        },
        false,
        true
      );
      return;
    }
    setSelectedId(id);
  };

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
      if (nextRole === "viewer") setTool("pan");
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

  useEffect(() => {
    if (!spaceId || !user || role === "loading" || role === "none") return;

    const loadShapes = async () => {
      const { data, error } = await supabase.from("shapes").select("*").eq("space_id", spaceId);
      if (error) {
        toast.error(error.message || "Could not load shapes");
        return;
      }
      dispatch(setShapes({ spaceId, shapes: (data ?? []).map(shapeFromRow) }));
    };

    loadShapes();

    const name = displayName(user);
    const color = colorFor(user.id);
    const channel = supabase.channel(`space:${spaceId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shapes", filter: `space_id=eq.${spaceId}` },
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
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return;
        setCursors((current) => ({
          ...current,
          [payload.userId]: {
            x: payload.x,
            y: payload.y,
            name: payload.name,
            color: payload.color,
          },
        }));
      })
      .on("broadcast", { event: "drag" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return;
        const current = shapesRef.current[payload.id];
        if (!current) return;
        dispatch(upsertShape({ ...current, x: payload.x, y: payload.y }));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string; color: string }>();
        setPeers(
          Object.entries(state)
            .filter(([id]) => id !== user.id)
            .map(([id, metas]) => ({
              id,
              name: metas[0]?.name || "Someone",
              color: metas[0]?.color || colorFor(id),
            }))
        );
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setCursors((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ name, color });
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [spaceId, dispatch, user, role]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (!canEdit) return;
      const meta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) void redo();
        else void undo();
        return;
      }
      if (meta && key === "y") {
        e.preventDefault();
        void redo();
        return;
      }
      if (meta && key === "d") {
        e.preventDefault();
        void duplicate();
        return;
      }
      if (e.key === "Delete") {
        const id = selectedIdRef.current;
        if (id) void deleteShape(id, true);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        const id = selectedIdRef.current;
        if (!id) return;
        e.preventDefault();
        const step = e.shiftKey ? GRID : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudge(id, dx, dy);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectedShape = selectedId ? shapesById[selectedId] : undefined;

  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;
    const stage = layerRef.current.getStage();
    if (!stage) return;
    const current = selectedId ? shapesRef.current[selectedId] : undefined;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    const locked = !current || current.type === "line" || current.type === "arrow";
    transformerRef.current.nodes(!locked && node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const oldScale = viewport.scale;
    const next = Math.min(4, Math.max(0.2, oldScale * Math.exp(-e.evt.deltaY * 0.001)));
    const worldX = (pointer.x - viewport.x) / oldScale;
    const worldY = (pointer.y - viewport.y) / oldScale;
    setViewport({
      scale: next,
      x: pointer.x - worldX * next,
      y: pointer.y - worldY * next,
    });
  };

  const handleCanvasClick = async (evt: any) => {
    if (!spaceId || tool === "pan" || !canEdit) return;
    const stage = evt.target.getStage();
    if (!stage || evt.target !== stage) return;
    const pos = canvasPointer(stage);
    if (!pos) return;
    if (tool === "arrow") setConnectFrom(null);

    const x = snap(pos.x);
    const y = snap(pos.y);
    const base: Shape = {
      id: "",
      spaceId,
      type: tool,
      x,
      y,
      width: 0,
      height: 0,
      rotation: 0,
      props: { stroke: "#000", fill: "#3b82f6" },
    };

    if (tool === "rect") {
      base.width = 120;
      base.height = 70;
    } else if (tool === "circle") {
      base.width = 80;
      base.height = 80;
    } else if (tool === "line") {
      base.points = [0, 0, 100, 0];
    } else if (tool === "arrow") {
      base.points = [0, 0, 100, 0];
      base.props = { stroke: "#000", fill: "#000" };
    } else if (tool === "text") {
      base.text = "Double-click to edit";
      base.props = { fontSize: 20, fill: "#000" };
    }

    const saved = await insertShape(base, false, true);
    if (saved) setSelectedId(saved.id);
  };

  const lines = gridLines(viewport, stageSize.width, stageSize.height);
  const draggable = tool !== "pan" && canEdit;

  const publishCursor = (event: any) => {
    if (!user) return;
    const now = performance.now();
    if (now - cursorAt.current < 40) return;
    cursorAt.current = now;
    const pos = canvasPointer(event.target.getStage());
    if (!pos) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        x: pos.x,
        y: pos.y,
        name: displayName(user),
        color: colorFor(user.id),
        userId: user.id,
      },
    });
  };

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
        setTool={(next) => {
          setTool(next);
          if (next !== "arrow") setConnectFrom(null);
        }}
        clearCanvas={clearCanvas}
        undo={() => void undo()}
        redo={() => void redo()}
        duplicate={() => void duplicate()}
        exportPng={exportPng}
        canUndo={canUndo}
        canRedo={canRedo}
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
          {peers.map((peer) => (
            <span key={peer.id} className="text-xs font-semibold" style={{ color: peer.color }}>
              {peer.name}
            </span>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 bg-gray-50">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={tool === "pan"}
          onDragEnd={(e) => {
            if (e.target !== e.target.getStage()) return;
            setViewport((current) => ({ ...current, x: e.target.x(), y: e.target.y() }));
          }}
          onWheel={handleWheel}
          onMouseDown={handleCanvasClick}
          onMouseMove={publishCursor}
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
            {shapes.map((s) => {
              const connected = isConnectedArrow(s);
              const from = connected ? shapesById[s.props?.fromId as string] : undefined;
              const to = connected ? shapesById[s.props?.toId as string] : undefined;
              const linked = Boolean(from && to);
              const arrowPoints = linked ? connectorPoints(from as Shape, to as Shape) : (s.points ?? []);

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
                      draggable={draggable}
                      onDragStart={handleDragStart(s.id)}
                      onDragMove={handleDragMove(s.id)}
                      onDragEnd={handleDragEnd(s.id)}
                      onClick={onShapeClick(s.id)}
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
                      draggable={draggable}
                      onDragStart={handleDragStart(s.id)}
                      onDragMove={handleDragMove(s.id)}
                      onDragEnd={handleDragEnd(s.id)}
                      onClick={onShapeClick(s.id)}
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
                      draggable={draggable}
                      onDragStart={handleDragStart(s.id)}
                      onDragMove={handleDragMove(s.id)}
                      onDragEnd={handleDragEnd(s.id)}
                      onClick={onShapeClick(s.id)}
                    />
                  );
                case "arrow":
                  return (
                    <Arrow
                      id={s.id}
                      key={s.id}
                      x={linked ? 0 : s.x}
                      y={linked ? 0 : s.y}
                      points={arrowPoints}
                      stroke={s.props?.stroke || "#000"}
                      fill={s.props?.stroke || "#000"}
                      strokeWidth={3}
                      draggable={draggable && !linked}
                      onDragStart={handleDragStart(s.id)}
                      onDragMove={handleDragMove(s.id)}
                      onDragEnd={handleDragEnd(s.id)}
                      onClick={onShapeClick(s.id)}
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
                      draggable={draggable}
                      onDragStart={handleDragStart(s.id)}
                      onDragMove={handleDragMove(s.id)}
                      onDragEnd={handleDragEnd(s.id)}
                      onClick={onShapeClick(s.id)}
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
      </div>

      {canEdit && selectedShape && (
        <Inspector
          shape={selectedShape}
          onPatch={(patch, row) => void persistShape(selectedShape.id, patch, row)}
          onFront={() => changeZ(1)}
          onBack={() => changeZ(-1)}
        />
      )}
      {connectFrom && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm">
          Click another shape to connect
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-white border-2 border-gray-900 rounded-xl text-xs font-semibold">
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  );
}
