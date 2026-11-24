import { safeUrl } from '../lib/links.js';

// A link that opens in a new tab, or nothing when the URL is missing or not http(s)/mailto.
export function ExtLink({ url, label, className = 'link' }) {
  const u = safeUrl(url);
  if (!u) return null;
  return <a className={className} href={u} target="_blank" rel="noopener">{label}</a>;
}
