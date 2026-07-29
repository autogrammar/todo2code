// Shared SVG primitives for the diff views.
//
// The package ships with `typescript` as its only runtime dependency, so every
// visual artefact is emitted as hand-built SVG markup. Nothing here touches the
// filesystem or the network: renderers are pure string builders and therefore
// safe to call from the deterministic side of the LLM boundary.

export interface SvgTheme {
  background: string;
  panel: string;
  panelStroke: string;
  text: string;
  muted: string;
  added: string;
  removed: string;
  changed: string;
  neutral: string;
  accent: string;
  addedFill: string;
  removedFill: string;
}

export const DARK_THEME: SvgTheme = {
  background: '#0f172a',
  panel: '#111827',
  panelStroke: '#334155',
  text: '#f8fafc',
  muted: '#94a3b8',
  added: '#22c55e',
  removed: '#ef4444',
  changed: '#f59e0b',
  neutral: '#64748b',
  accent: '#38bdf8',
  addedFill: '#052e16',
  removedFill: '#450a0a',
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character);
}

export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

// Tabs and control characters break monospace column alignment inside <text>,
// so they are normalised before the string reaches the renderer.
export function sanitizeSourceLine(value: string, tabWidth = 4): string {
  return value
    .replace(/\t/g, ' '.repeat(Math.max(1, tabWidth)))
    .replace(/[\u0000-\u001f\u007f]/g, '\u00b7');
}

export function metricCard(
  x: number,
  y: number,
  label: string,
  value: string | number,
  color: string,
  width = 170,
): string {
  return `<g><rect class="panel" x="${x}" y="${y}" width="${width}" height="68" rx="10"/>`
    + `<rect x="${x}" y="${y}" width="5" height="68" rx="3" fill="${color}"/>`
    + `<text x="${x + 18}" y="${y + 29}" class="metric">${escapeXml(String(value))}</text>`
    + `<text x="${x + 18}" y="${y + 51}" class="label">${escapeXml(label)}</text></g>`;
}

export function svgStyles(theme: SvgTheme = DARK_THEME): string {
  return `.bg{fill:${theme.background}}`
    + `.panel{fill:${theme.panel};stroke:${theme.panelStroke};stroke-width:1}`
    + `.title{font:700 25px ui-sans-serif,system-ui;fill:${theme.text}}`
    + `.meta{font:13px ui-monospace,monospace;fill:${theme.muted}}`
    + `.metric{font:700 20px ui-sans-serif,system-ui;fill:${theme.text}}`
    + `.label{font:12px ui-sans-serif,system-ui;fill:${theme.muted}}`
    + `.section{font:700 17px ui-sans-serif,system-ui}`
    + `.item{font:13px ui-monospace,monospace;fill:${theme.text}}`
    + `.code{font:12.5px ui-monospace,monospace;fill:${theme.text}}`
    + `.gutter{font:11px ui-monospace,monospace;fill:${theme.muted}}`
    + `.more{font:italic 13px ui-sans-serif,system-ui;fill:${theme.muted}}`
    + `.badge{font:700 11px ui-sans-serif,system-ui}`;
}

export interface SvgDocumentOptions {
  width: number;
  height: number;
  title: string;
  description: string;
  theme?: SvgTheme;
  body: string;
}

export function svgDocument(options: SvgDocumentOptions): string {
  const theme = options.theme ?? DARK_THEME;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" `
    + `viewBox="0 0 ${options.width} ${options.height}" width="${options.width}" height="${options.height}">
  <title id="title">${escapeXml(options.title)}</title>
  <desc id="desc">${escapeXml(options.description)}</desc>
  <style>${svgStyles(theme)}</style>
  <rect class="bg" width="100%" height="100%" rx="16"/>
${options.body}
</svg>`;
}
