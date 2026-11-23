import type { Shape } from "../features/CanvaSlice";

function hexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

type InspectorProps = {
  shape: Shape;
  onPatch: (patch: Partial<Shape>, row: Record<string, unknown>) => void;
  onFront: () => void;
  onBack: () => void;
};

export default function Inspector({ shape, onPatch, onFront, onBack }: InspectorProps) {
  const fill = hexColor(shape.props?.fill, "#3b82f6");
  const stroke = hexColor(shape.props?.stroke, "#000000");
  const fontSize = Number(shape.props?.fontSize) || 18;
  const showFill = shape.type === "rect" || shape.type === "circle" || shape.type === "text";
  const showStroke = shape.type !== "text";

  const updateProps = (partial: Record<string, unknown>) => {
    const props = { ...shape.props, ...partial };
    onPatch({ props }, { props });
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 bg-white border-2 border-gray-900 rounded-xl shadow-lg p-3 flex items-center gap-3">
      {showFill && (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          Fill
          <input
            type="color"
            value={fill}
            onChange={(e) => updateProps({ fill: e.target.value })}
            className="w-8 h-8 bg-transparent"
          />
        </label>
      )}
      {showStroke && (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          Stroke
          <input
            type="color"
            value={stroke}
            onChange={(e) => updateProps({ stroke: e.target.value })}
            className="w-8 h-8 bg-transparent"
          />
        </label>
      )}
      {shape.type === "text" && (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          Size
          <input
            type="number"
            min={8}
            max={160}
            value={fontSize}
            onChange={(e) => updateProps({ fontSize: Number(e.target.value) || fontSize })}
            className="w-16 px-2 py-1 border-2 border-gray-900 rounded-lg"
          />
        </label>
      )}
      <button
        type="button"
        onClick={onBack}
        className="px-3 py-2 text-xs font-semibold border-2 border-gray-900 rounded-lg hover:bg-gray-100"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onFront}
        className="px-3 py-2 text-xs font-semibold border-2 border-gray-900 rounded-lg hover:bg-gray-100"
      >
        Front
      </button>
    </div>
  );
}
