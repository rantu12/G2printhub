"use client";

type ProductColorSelectorProps = {
  colors: readonly { name: string; value: string }[];
  selectedColor: string;
  onSelect: (color: string) => void;
};

export default function ProductColorSelector({
  colors,
  selectedColor,
  onSelect,
}: ProductColorSelectorProps) {
  return (
    <fieldset className="product-color-selector">
      <legend>
        Color: <strong>{selectedColor}</strong>
      </legend>
      <div className="product-color-swatches">
        {colors.map((color) => (
          <button
            key={color.name}
            type="button"
            className={`product-color-swatch${
              selectedColor === color.name ? " is-selected" : ""
            }`}
            style={{ backgroundColor: color.value }}
            aria-label={`Select ${color.name}`}
            aria-pressed={selectedColor === color.name}
            onClick={() => onSelect(color.name)}
          />
        ))}
      </div>
    </fieldset>
  );
}
