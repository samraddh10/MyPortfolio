import { LiquidNav, LqItem } from './LiquidNav.jsx';
import { linkIcon, safeUrl } from '../lib/links.js';

// The footer's drop follows the pointer instead of marking the current section.
export function Footer({ name, links, email, resume }) {
  return (
    <footer className="foot">
      <div className="foot-copy"><p>© {new Date().getFullYear()} {name}</p></div>
      <LiquidNav kind="foot" className="foot-nav" label="Elsewhere">
        {links.map((l, i) => <LqItem key={i} href={safeUrl(l.url)} label={l.label} icon={linkIcon(l.label, l.url)} fx="spin" external />)}
        {email && <LqItem href={'mailto:' + email} label="Email" icon="plane" fx="plane" />}
        {resume && <LqItem href={resume} label="Resume" icon="file" fx="pop" external />}
        <LqItem href="#top" label="Back to top" icon="up" fx="glow" />
      </LiquidNav>
    </footer>
  );
}
