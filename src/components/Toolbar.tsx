import type { ReactNode } from "react";
import {
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Trash2,
  Hand,
  Undo2,
  Redo2,
  Copy,
  Download,
  MousePointer2,
  Lock,
} from "lucide-react";
import type { shapeType } from "../features/CanvaSlice";

export type CanvasTool = shapeType | "select" | "pan";

type ToolbarProps = {
  tool: CanvasTool;
  locked: boolean;
  onPick: (tool: CanvasTool) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  duplicate: () => void;
  exportPng: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canDuplicate: boolean;
  canEdit: boolean;
};

export default function Toolbar({
  tool,
  locked,
  onPick,
  clearCanvas,
  undo,
  redo,
  duplicate,
  exportPng,
  canUndo,
  canRedo,
  canDuplicate,
  canEdit,
}: ToolbarProps) {
  const buttons: { id: CanvasTool; label: string; icon: ReactNode }[] = [
    { id: "select", label: "Select", icon: <MousePointer2 className="w-4 h-4" /> },
    { id: "pan", label: "Pan", icon: <Hand className="w-4 h-4" /> },
    { id: "rect", label: "Rectangle", icon: <Square className="w-4 h-4" /> },
    { id: "circle", label: "Circle", icon: <Circle className="w-4 h-4" /> },
    { id: "arrow", label: "Arrow", icon: <ArrowRight className="w-4 h-4" /> },
    { id: "line", label: "Line", icon: <Minus className="w-4 h-4" /> },
    { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-900 p-2 flex items-center gap-1 flex-wrap justify-center">
        {buttons.map((b) => (
          <button
            key={b.id}
            onClick={() => onPick(b.id)}
            className={`group relative px-4 py-3 rounded-xl transition-all duration-200 disabled:opacity-40 ${
              tool === b.id ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
            title={
              locked && tool === b.id
                ? `${b.label} stays on. Click again to unlock`
                : tool === b.id && b.id !== "select" && b.id !== "pan"
                  ? `${b.label}. Click again to keep drawing`
                  : b.label
            }
            disabled={!canEdit && b.id !== "pan"}
          >
            {b.icon}
            {locked && tool === b.id && <Lock className="absolute top-1 right-1 w-3 h-3" />}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {b.label}
            </span>
          </button>
        ))}

        <div className="w-px h-8 bg-gray-300 mx-1" />

        <IconButton label="Undo" onClick={undo} disabled={!canUndo || !canEdit}>
          <Undo2 className="w-4 h-4" />
        </IconButton>
        <IconButton label="Redo" onClick={redo} disabled={!canRedo || !canEdit}>
          <Redo2 className="w-4 h-4" />
        </IconButton>
        <IconButton label="Duplicate" onClick={duplicate} disabled={!canDuplicate || !canEdit}>
          <Copy className="w-4 h-4" />
        </IconButton>
        <IconButton label="Export PNG" onClick={exportPng}>
          <Download className="w-4 h-4" />
        </IconButton>

        <div className="w-px h-8 bg-gray-300 mx-1" />

        <button
          onClick={clearCanvas}
          disabled={!canEdit}
          className="px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 group relative disabled:opacity-40"
          title="Clear Canvas"
        >
          <Trash2 className="w-4 h-4" />
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Clear Canvas
          </span>
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="group relative px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white"
    >
      {children}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </button>
  );
}
