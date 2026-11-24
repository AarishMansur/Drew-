import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supaBaseClient";
import { colorFor, displayName } from "../lib/sharing";

export type LiveCursor = { x: number; y: number; name: string; color: string };
export type Peer = { id: string; name: string; color: string };

type Options = {
  spaceId?: string;
  user: User | null;
  enabled: boolean;
  onRemoteDrag: (id: string, x: number, y: number) => void;
};

export function usePresence({ spaceId, user, enabled, onRemoteDrag }: Options) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [cursors, setCursors] = useState<Record<string, LiveCursor>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cursorAt = useRef(0);
  const dragHandler = useRef(onRemoteDrag);
  const userRef = useRef(user);

  useEffect(() => {
    dragHandler.current = onRemoteDrag;
    userRef.current = user;
  });

  useEffect(() => {
    if (!spaceId || !user || !enabled) return;

    const name = displayName(user);
    const color = colorFor(user.id);
    const channel = supabase.channel(`presence:${spaceId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
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
        dragHandler.current(payload.id, payload.x, payload.y);
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
  }, [spaceId, user, enabled]);

  const publishCursor = (x: number, y: number) => {
    const me = userRef.current;
    if (!me) return;
    const now = performance.now();
    if (now - cursorAt.current < 40) return;
    cursorAt.current = now;
    void channelRef.current?.send({
      type: "broadcast",
      event: "cursor",
      payload: { x, y, name: displayName(me), color: colorFor(me.id), userId: me.id },
    });
  };

  const publishDrag = (id: string, x: number, y: number) => {
    const me = userRef.current;
    if (!me) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: "drag",
      payload: { id, x, y, userId: me.id },
    });
  };

  return { peers, cursors, publishCursor, publishDrag };
}
