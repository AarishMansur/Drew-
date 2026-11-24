/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/store";
import { removeShape, setShapes, upsertShape } from "../features/CanvaSlice";
import type { Shape } from "../features/CanvaSlice";
import { supabase } from "../lib/supaBaseClient";

export function shapeFromRow(row: any): Shape {
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

type Options = {
  spaceId?: string;
  enabled: boolean;
  canEdit: boolean;
  onShapeRemoved: (id: string) => void;
  onCleared: () => void;
};

export function useSpaceShapes({ spaceId, enabled, canEdit, onShapeRemoved, onCleared }: Options) {
  const dispatch = useAppDispatch();
  const shapesById = useAppSelector((s) => s.canvas.shapes);
  const shapes = Object.values(shapesById)
    .filter((shape) => shape.spaceId === spaceId)
    .sort((a, b) => (a.props?.zIndex ?? 0) - (b.props?.zIndex ?? 0) || a.id.localeCompare(b.id));

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const shapesRef = useRef(shapesById);
  const canEditRef = useRef(canEdit);
  const removedRef = useRef(onShapeRemoved);
  const clearedRef = useRef(onCleared);
  const gestureBefore = useRef<Shape | null>(null);
  const undoStack = useRef<HistoryCmd[]>([]);
  const redoStack = useRef<HistoryCmd[]>([]);

  useEffect(() => {
    shapesRef.current = shapesById;
    canEditRef.current = canEdit;
    removedRef.current = onShapeRemoved;
    clearedRef.current = onCleared;
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
    const { data, error } = await supabase.from("shapes").insert([shapeToRow(local, keepId)]).select("*").single();
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
    removedRef.current(id);
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

  const clearSpace = async () => {
    if (!spaceId || !canEditRef.current) return;
    const removed = Object.values(shapesRef.current).filter((shape) => shape.spaceId === spaceId);
    if (removed.length === 0) return;
    const cmd: HistoryCmd = { type: "remove-many", shapes: removed };
    pushHistory(cmd);
    removed.forEach((shape) => dispatch(removeShape(shape.id)));
    clearedRef.current();
    const { error } = await supabase.from("shapes").delete().eq("space_id", spaceId);
    if (error) {
      dropHistory(cmd);
      removed.forEach((shape) => dispatch(upsertShape(shape)));
      toast.error(error.message || "Could not clear canvas");
    }
  };

  const previewMove = (id: string, x: number, y: number) => {
    const current = shapesRef.current[id];
    if (!current || (current.x === x && current.y === y)) return;
    dispatch(upsertShape({ ...current, x, y }));
  };

  const beginGesture = (id: string) => {
    gestureBefore.current = shapesRef.current[id] ?? null;
  };

  const commitMove = (id: string, x: number, y: number) =>
    persistShape(id, { x, y }, { x, y }, gestureBefore.current ?? undefined);

  useEffect(() => {
    if (!spaceId || !enabled) return;

    const loadShapes = async () => {
      const { data, error } = await supabase.from("shapes").select("*").eq("space_id", spaceId);
      if (error) {
        toast.error(error.message || "Could not load shapes");
        return;
      }
      dispatch(setShapes({ spaceId, shapes: (data ?? []).map(shapeFromRow) }));
    };

    loadShapes();

    const channel = supabase
      .channel(`space:${spaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shapes", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            dispatch(upsertShape(shapeFromRow(payload.new)));
          } else if (payload.eventType === "DELETE") {
            const id = payload.old.id as string;
            dispatch(removeShape(id));
            removedRef.current(id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, enabled, dispatch]);

  return {
    shapes,
    shapesById,
    shapesRef,
    canUndo,
    canRedo,
    persistShape,
    insertShape,
    deleteShape,
    undo,
    redo,
    clearSpace,
    previewMove,
    beginGesture,
    commitMove,
    getShape: (id: string) => shapesRef.current[id],
  };
}
