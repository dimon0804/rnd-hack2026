/** Дискретные уровни масштаба корневого шрифта (влияет на rem по всему сайту). */
export const FONT_SCALE_STEPS = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45] as const;

export const DEFAULT_FONT_SCALE_INDEX = 2;

export function clampFontScaleIndex(index: number): number {
  return Math.max(0, Math.min(index, FONT_SCALE_STEPS.length - 1));
}
