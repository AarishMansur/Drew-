# Drew

Drew is a shared architecture canvas. Draw shapes, connect them, and work in the same space with other people. Supabase stores the diagrams. The landing page is a short scroll animation.

## Features

- Spaces with owner, editor, and viewer roles. Viewers can pan and zoom. Editors can change the diagram.
- Select, pan, rectangle, circle, line, arrow, and text. Drag to draw. The tool returns to select after one shape. Click the active tool again to keep drawing.
- Snap to a 20px grid, undo and redo, duplicate, nudge, reorder, and export a PNG.
- Arrows bind when you drag from one shape to another.
- Live cursors and in-progress drags. Saved shapes sync through Supabase Realtime. A shape someone else saved first reloads instead of being overwritten.
- Invite by link, or by email. Link invites are single use and expire after 7 days.
- Landing scroll uses Lenis with GSAP. The canvas does not, so the wheel still zooms.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Redux Toolkit, react-konva, GSAP, Lenis, and Supabase (Auth, Postgres, Realtime).

`localStorage` only caches the canvas in the browser. The shared diagram lives in Postgres.

## Setup

```bash
git clone https://github.com/AarishMansur/Drew-.git
cd Drew-
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, copy the example with `Copy-Item .env.example .env`.

Put these in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app stays blank without both values. Use the anon key, not the service role key.

Auth is GitHub, Google, and email magic link. In the Supabase dashboard, add `http://localhost:5173/auth/callback` as a redirect URL.

### Database

Run `supabase/migrations/20261123120000_sharing.sql` once in the Supabase SQL editor. That script creates members and invites, turns on row-level security, and adds `shapes` to the realtime publication. Pushing the file to git does not apply it.

Spaces and shapes need to exist before that script. If creating a space returns a row-level security error after the script, run this as well:

```sql
drop policy if exists drew_spaces_select on public.spaces;
create policy drew_spaces_select on public.spaces
for select using (owner_id = auth.uid() or public.is_space_member(id));
```

The migration file already includes that select policy. You only need the snippet if an older copy of the script was applied first.

## Scripts

```bash
npm run dev      # http://localhost:5173
npm run build
npm run lint
npm run preview
```

## Using a space

| Action | How |
| --- | --- |
| Select | V, or the pointer tool. Click a shape. Click empty canvas to clear. |
| Pan | H, the hand tool, or hold Space |
| Draw | R rectangle, O circle, A arrow, L line, T text, then drag |
| Keep a tool | Click the active drawing tool again |
| Undo / redo | Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y |
| Duplicate | Ctrl+D |
| Nudge | Arrow keys, Shift for one grid step |
| Delete | Delete |
| Back to select | Escape |

Text opens an editor when you place it. Double-click existing text to edit it again.
