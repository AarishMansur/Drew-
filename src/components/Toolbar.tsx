import type { shapeType } from "../features/CanvaSlice";

interface ToolbarProps {
  tool: shapeType;
  setTool: React.Dispatch<React.SetStateAction<shapeType>>;
  clearCanvas: () => void;
}

export default function Toolbar({ tool, setTool, clearCanvas }: ToolbarProps) {
  const buttons: { id: shapeType; label: string }[] = [
    { id: "rect", label: "Rectangle" },
    { id: "circle", label: "Circle" },
    { id: "line", label: "Line" },
    { id: "arrow", label: "Arrow" },
    { id: "text", label: "Text" },
  ];

  return (
    <div className="flex gap-2 items-center">
      {buttons.map((b) => (
        <button
          key={b.id}
          onClick={() => setTool(b.id)}
          className={`px-3 py-1 rounded ${
            tool === b.id ? "bg-blue-500" : "bg-slate-700"
          }`}
        >
          {b.label}
        </button>
      ))}

      <button onClick={clearCanvas} className="px-3 py-1 rounded bg-red-600">
        Clear
      </button>
    </div>
  );
}
