import { Square, Circle, Minus, ArrowRight, Type, Trash2 } from 'lucide-react';
import type { shapeType } from "../features/CanvaSlice";

interface ToolbarProps {
  tool: shapeType;
  setTool: React.Dispatch<React.SetStateAction<shapeType>>;
  clearCanvas: () => void;
}

export default function Toolbar({ tool, setTool, clearCanvas }: ToolbarProps) {
  const buttons: { id: shapeType; label: string; icon: React.ReactNode }[] = [
    { id: "rect", label: "Rectangle", icon: <Square className="w-4 h-4" /> },
    { id: "circle", label: "Circle", icon: <Circle className="w-4 h-4" /> },
    { id: "line", label: "Line", icon: <Minus className="w-4 h-4" /> },
    { id: "arrow", label: "Arrow", icon: <ArrowRight className="w-4 h-4" /> },
    { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-900 p-2 flex items-center gap-1">
        {buttons.map((b) => (
          <button
            key={b.id}
            onClick={() => setTool(b.id)}
            className={`group relative px-4 py-3 rounded-xl transition-all duration-200 ${
              tool === b.id 
                ? "bg-gray-900 text-white" 
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
            title={b.label}
          >
            {b.icon}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {b.label}
            </span>
          </button>
        ))}

        <div className="w-px h-8 bg-gray-300 mx-1" />

        <button
          onClick={clearCanvas}
          className="px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 group relative"
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