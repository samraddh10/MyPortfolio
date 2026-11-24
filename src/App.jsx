import { useEffect } from 'react';
import content from './data/site.js';
import { safeUrl, slug } from './lib/links.js';
import { bootRuntime } from './runtime/boot.js';
import { Gate } from './components/Gate.jsx';
import { TopBar } from './components/TopBar.jsx';
import { Hero } from './components/Hero.jsx';
import { About } from './components/About.jsx';
import { Work } from './components/Work.jsx';
import { Skills } from './components/Skills.jsx';
import { Contact } from './components/Contact.jsx';
import { Footer } from './components/Footer.jsx';
import { Toast } from './components/Toast.jsx';

// Layout: a fixed Three.js stage fills the window; the copy holds a left column and the
// cubes rebuild on the right as each section scrolls in. The stage, grain and #app are
// siblings because the CSS uses `#stage.is-live ~ #app` to swap in the 3D-only layout.
export default function App() {
  const p = content.profile;
  const projects = content.projects || [];
  const groups = ((content.skills && content.skills.groups) || []).filter((g) => g && (g.label || g.items));
  const links = (p.links || []).filter((l) => safeUrl(l && l.url));
  const email = String(p.email || '').trim();
  const resume = safeUrl(p.resumeUrl);
  const firstProject = projects.length ? slug(projects[0].id || projects[0].name, 0) : 'skills';

  useEffect(() => { bootRuntime(content); }, []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <canvas id="stage" aria-hidden="true" />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <filter id="lq-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="grain" aria-hidden="true" />
      <Gate name={p.name} line={p.gateLine} />
      <div id="app">
        <TopBar name={p.name} hasWork={projects.length > 0} hasSkills={groups.length > 0} resume={resume} />
        <main id="main">
          <Hero profile={p} firstProject={firstProject} hasProjects={projects.length > 0} resume={resume} links={links} />
          <About profile={p} about={content.about || {}} />
          {projects.length > 0 && <Work work={content.work || {}} projects={projects} />}
          {groups.length > 0 && <Skills heading={content.skills.heading} groups={groups} />}
          <Contact contact={content.contact || {}} email={email} links={links} resume={resume} />
        </main>
        <Footer name={p.name} links={links} email={email} resume={resume} />
      </div>
      <Toast />
    </>
  );
}
