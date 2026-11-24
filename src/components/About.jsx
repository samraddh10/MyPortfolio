import { DecodeText } from './Decode.jsx';
import { ExtLink } from './ExtLink.jsx';
import { asciiPortrait } from '../lib/portrait.js';
import { safeUrl } from '../lib/links.js';

// With the 3D scene running, the dot portrait turns to face this text from the left, so the
// text-character portrait only shows when there is no 3D scene (see site.css).
export function About({ profile: p, about }) {
  const edu = about.education || {};
  const rec = (about.recognition || []).filter((r) => r && r.title);
  // the original page's HTML parser dropped the newline right after <pre>; React keeps it
  const ascii = asciiPortrait(p).replace(/^\n/, '');
  return (
    <section className="about" id="about" data-scene="mirror" data-side="left" data-theme="concrete" data-nav="About">
      <div className="about-grid">
        <figure className="ascii-portrait">
          <pre role="img" aria-label={(p.photoAlt || 'Portrait of ' + p.name) + ', drawn in text characters'}>{ascii}</pre>
        </figure>
        <div className="about-copy">
          <DecodeText as="h2" className="section-title" text={about.heading || 'About'} />
          {about.bio && <p className="about-bio">{about.bio}</p>}
          {(edu.school || edu.degree) && (
            <div className="about-block">
              <h3>Education</h3>
              <p className="edu">
                <strong>{edu.school}</strong><br />{edu.degree}
                {(edu.years || edu.grade) && <><br /><span className="muted">{[edu.years, edu.grade].filter(Boolean).join(', ')}</span></>}
              </p>
            </div>
          )}
          {rec.length > 0 && (
            <div className="about-block">
              <h3>Recognition</h3>
              <ul className="rec">
                {rec.map((r, i) => (
                  <li key={i}>
                    {safeUrl(r.url) ? <ExtLink url={r.url} label={r.title} /> : r.title}
                    {r.detail && <span className="muted">{r.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
