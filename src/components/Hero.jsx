import { NameLines } from './Decode.jsx';
import { ExtLink } from './ExtLink.jsx';
import { ICONS } from './Icons.jsx';

// The dot portrait fills the free side of the stage behind this section.
export function Hero({ profile: p, firstProject, hasProjects, resume, links }) {
  return (
    <section className="hero" id="top" data-scene="portrait" data-theme="concrete" data-nav="Top">
      <NameLines as="h1" className="hero-name" name={p.name} />
      <div className="hero-copy">
        {p.intro && <p className="hero-intro">{p.intro}</p>}
        {p.status && <p className="hero-status">{p.status}</p>}
        <div className="hero-actions">
          {hasProjects && <a className="btn btn-primary" href={'#' + firstProject}>See the projects</a>}
          {resume && (
            <a className="btn btn-resume" href={resume} target="_blank" rel="noopener">
              {ICONS.file}
              <span>View resume</span>
            </a>
          )}
          {links.map((l, i) => <ExtLink key={i} url={l.url} label={l.label} className="btn btn-quiet" />)}
        </div>
        {p.location && <p className="hero-place">Based in {p.location}</p>}
      </div>
    </section>
  );
}
