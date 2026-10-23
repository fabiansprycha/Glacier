/** Sweetie 16 palette: https://lospec.com/palette-list/sweetie-16 */
export const PAL = {
  black: '#1a1c2c',
  purple: '#5d275d',
  red: '#b13e53',
  orange: '#ef7d57',
  yellow: '#ffcd75',
  lime: '#a7f070',
  green: '#38b764',
  teal: '#257179',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  silver: '#94b0c2',
  grey: '#566c86',
  slate: '#333c57',
} as const;

/**
 * Draws a sprite described as text rows, one character per pixel.
 * '.' is transparent, every other character is looked up in `colors`.
 */
export function drawPixels(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  colors: Record<string, string>,
  ox: number,
  oy: number,
  flipX = false,
): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.') continue;
      const color = colors[c];
      if (!color) throw new Error(`No color for '${c}'`);
      ctx.fillStyle = color;
      ctx.fillRect(ox + (flipX ? row.length - 1 - x : x), oy + y, 1, 1);
    }
  });
}
