import { useWindowDimensions } from 'react-native';

export interface Responsive {
  width: number;
  height: number;
  /** Very narrow devices, e.g. the Galaxy Fold cover display (~280–320dp). */
  isXSmall: boolean;
  /** Small phones (< 360dp). */
  isSmall: boolean;
  /** Large phones / small tablets and unfolded foldables (>= 600dp). */
  isLarge: boolean;
  /** Tablets (>= 768dp). */
  isTablet: boolean;
  /** Scales a base value up on tablets and down on small phones. */
  scale: (base: number) => number;
  /** Picks a value by breakpoint, falling back to the closest smaller one. */
  select: <T>(values: {
    xsmall?: T;
    small?: T;
    base: T;
    large?: T;
    tablet?: T;
  }) => T;
}

/**
 * Live, fold-aware responsive helper. Unlike a module-level Dimensions read,
 * this re-renders when the window size changes (rotation, fold/unfold, split
 * screen), so layouts adapt instead of clipping.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  const isXSmall = width < 340;
  const isSmall = width < 360;
  const isLarge = width >= 600;
  const isTablet = width >= 768;

  const scale = (base: number): number => {
    if (isTablet) return Math.round(base * 1.15);
    if (isXSmall) return Math.round(base * 0.85);
    if (isSmall) return Math.round(base * 0.92);
    return base;
  };

  const select = <T,>(values: {
    xsmall?: T;
    small?: T;
    base: T;
    large?: T;
    tablet?: T;
  }): T => {
    if (isTablet && values.tablet !== undefined) return values.tablet;
    if (isLarge && values.large !== undefined) return values.large;
    if (isXSmall && values.xsmall !== undefined) return values.xsmall;
    if (isSmall && values.small !== undefined) return values.small;
    return values.base;
  };

  return {
    width,
    height,
    isXSmall,
    isSmall,
    isLarge,
    isTablet,
    scale,
    select,
  };
}
