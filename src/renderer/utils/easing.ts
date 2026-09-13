import type { EasingFunction } from '../../common/types';

export function applyEasing(easing: EasingFunction, value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);

  switch (easing) {
    case 'ease-in-out':
      return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    case 'ease-out':
      return 1 - Math.pow(1 - clamped, 3);
    default:
      return clamped;
  }
}
