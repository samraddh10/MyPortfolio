import { LiquidNav, LqItem } from './LiquidNav.jsx';
import { ICONS } from './Icons.jsx';

// Top bar: a square-cornered strip of glass with the section links and the resume, one click away.
export function TopBar({ name, hasWork, hasSkills, resume }) {
  const parts = String(name || '').trim().split(/\s+/);
  const first = parts.shift() || '';
  return (
    <header className="topbar">
      <a className="mark" href="#top">
        {first}
        {parts.length > 0 && <span className="mark-rest">{' ' + parts.join(' ')}</span>}
      </a>
      <LiquidNav kind="nav" className="topnav" label="Sections">
        <LqItem href="#top" label="Home" icon="home" fx="glow" data-nav-link="Top" />
        <LqItem href="#about" label="About" icon="user" fx="wave" data-nav-link="About" />
        {hasWork && <LqItem href="#work" label="Work" icon="code" fx="spin" data-nav-link="Work" />}
        {hasSkills && <LqItem href="#skills" label="Skills" icon="layers" fx="drop" data-nav-link="Skills" />}
        <LqItem href="#contact" label="Contact" icon="mail" fx="pop" data-nav-link="Contact" />
      </LiquidNav>
      {resume && (
        <a className="top-resume" href={resume} target="_blank" rel="noopener" aria-label="Resume (opens in a new tab)">
          {ICONS.file}
          <span className="top-resume-label">Resume</span>
        </a>
      )}
      <div className="progress" aria-hidden="true"><i /></div>
    </header>
  );
}
