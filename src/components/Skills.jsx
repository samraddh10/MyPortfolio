import { useState } from 'react';
import { DecodeText } from './Decode.jsx';
import { runtime } from '../runtime/state.js';

// Each row lifts its plate in the 3D stack beside the list.
function SkillRow({ group, k }) {
  const [on, setOn] = useState(false);
  const enter = () => { runtime.scene && runtime.scene.setPlate(k); setOn(true); };
  const leave = () => { runtime.scene && runtime.scene.setPlate(-1); setOn(false); };
  return (
    <div
      className={'skill-row' + (on ? ' is-on' : '')}
      data-plate={k}
      tabIndex={0}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
    >
      <dt>{group.label}</dt>
      <dd>{group.items}</dd>
    </div>
  );
}

export function Skills({ heading, groups }) {
  return (
    <section className="skills" id="skills" data-scene="layers" data-theme="concrete" data-plates={groups.length} data-nav="Skills">
      <div className="skills-copy">
        <DecodeText as="h2" className="section-title" text={heading || 'Skills'} />
        <dl className="skill-list">
          {groups.map((g, k) => <SkillRow key={k} group={g} k={k} />)}
        </dl>
      </div>
    </section>
  );
}
