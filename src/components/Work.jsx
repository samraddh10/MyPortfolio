import { DecodeText } from './Decode.jsx';
import { ExtLink } from './ExtLink.jsx';
import { Shot } from './Shot.jsx';
import { hostOf, safeUrl, slug, themeId } from '../lib/links.js';

// Raw request text in a monospace box, with each line break shown as a visible \r\n.
function Bytes({ sample }) {
  const lines = String(sample).split(/\r?\n|\\r\\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return (
    <pre className="bytes" aria-label="Raw request bytes">
      {lines.map((l, k) => (
        <span className="byte-line" key={k}>{l}<span className="crlf" aria-hidden="true">{'\\r\\n'}</span></span>
      ))}
    </pre>
  );
}

// Each project gets its own scene and colours; alternate projects put the scene on the left.
function Project({ pr, i }) {
  const id = slug(pr.id || pr.name, i);
  const images = (pr.images || []).filter((im) => im && im.src);
  const facts = (pr.facts || []).filter((f) => f && (f.value || f.label));
  const flipped = i % 2 === 0;
  return (
    <section
      className={'project' + (flipped ? ' is-flipped' : '')}
      data-side={flipped ? 'left' : 'right'}
      id={id}
      data-scene={pr.scene || 'field'}
      data-theme={themeId(pr.theme)}
      data-nav="Work"
      aria-labelledby={id + '-name'}
    >
      <div className="project-copy">
        <DecodeText as="h2" className="project-name" id={id + '-name'} text={pr.name} />
        {pr.tagline && <p className="project-tagline">{pr.tagline}</p>}
        {pr.description && <p className="project-desc">{pr.description}</p>}
        {facts.length > 0 && (
          <dl className="facts">
            {facts.map((f, k) => (
              <div className="fact" key={k}><DecodeText as="dt" text={f.value} /><dd>{f.label}</dd></div>
            ))}
          </dl>
        )}
        {pr.stack && <p className="stack"><span className="visually-hidden">Built with </span>{pr.stack}</p>}
        <div className="project-links">
          <ExtLink url={pr.live} label="Open live demo" className="btn btn-primary" />
          <ExtLink url={pr.source} label="Read the source" className="btn btn-quiet" />
        </div>
        {pr.liveNote && safeUrl(pr.live) && <p className="live-note">{pr.liveNote}</p>}
      </div>
      <div className="project-visual">
        <div className="scene-window">
          {pr.sample && <Bytes sample={pr.sample} />}
          {pr.sceneNote && <p className="scene-note">{pr.sceneNote}</p>}
        </div>
        {images.length > 0 && <Shot images={images} host={hostOf(pr.live) || pr.name} name={pr.name} />}
      </div>
    </section>
  );
}

export function Work({ work, projects }) {
  return (
    <>
      <section className="work-intro" id="work" data-scene="orb" data-theme="concrete" data-nav="Work">
        <DecodeText as="h2" className="section-title" text={work.heading || 'Work'} />
        {work.text && <p className="section-lead">{work.text}</p>}
      </section>
      {projects.map((pr, i) => <Project key={pr.id || i} pr={pr} i={i} />)}
    </>
  );
}
