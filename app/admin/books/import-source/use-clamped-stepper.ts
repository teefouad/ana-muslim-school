export interface ClampedStepperRange {
  min: number;
  max: number;
  step: number;
}

/** Shared clamped increment/decrement logic for FontSizeControl and the PDF
 * viewer toolbar's zoom control -- both are a "value stepped by a fixed
 * amount between a min/max, with the button disabled at each bound" control,
 * so the clamping math lives once instead of being re-derived in each. */
export function useClampedStepper(
  value: number,
  { min, max, step }: ClampedStepperRange,
  onChange: (value: number) => void,
) {
  return {
    canDecrement: value > min,
    canIncrement: value < max,
    decrement: () => onChange(Math.max(min, value - step)),
    increment: () => onChange(Math.min(max, value + step)),
  };
}
