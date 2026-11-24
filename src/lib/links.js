// Only http(s) and mailto links make it onto the page.
export function safeUrl(u) {
  u = String(u || '').trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^mailto:/i.test(u)) return u;
  return '';
}

export function hostOf(u) {
  const m = /^https?:\/\/([^/]+)/i.exec(safeUrl(u));
  return m ? m[1] : '';
}

export function slug(s, i) {
  const x = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return x || 'project-' + (i + 1);
}

const THEMES = ['concrete', 'terminal', 'paper', 'nebula', 'pitlane'];
export const themeId = (t) => (THEMES.includes(t) ? t : 'concrete');

export function linkIcon(label, url) {
  const s = (String(label) + ' ' + String(url)).toLowerCase();
  return s.indexOf('github') >= 0 ? 'github' : s.indexOf('linkedin') >= 0 ? 'linkedin' : 'link';
}
