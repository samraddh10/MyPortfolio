import { useRef } from 'react';
import { DecodeText } from './Decode.jsx';
import { ExtLink } from './ExtLink.jsx';
import { toast } from './Toast.jsx';
import { runtime } from '../runtime/state.js';

export function Contact({ contact, email, links, resume }) {
  const mailRef = useRef(null);
  const at = email.indexOf('@');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast('Email address copied');
    } catch (e) {
      const a = mailRef.current;
      if (a) { const range = document.createRange(); range.selectNodeContents(a); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); }
      toast('Press Ctrl+C or ⌘C to copy the selected address');
    }
  };

  return (
    <section className="contact" id="contact" data-scene="cube" data-theme="concrete" data-nav="Contact">
      <DecodeText as="h2" className="contact-heading" text={contact.heading || 'Get in touch'} />
      {contact.text && <p className="section-lead">{contact.text}</p>}
      {email && (
        <>
          {/* the email opens up the cube */}
          <p
            className="contact-email"
            onPointerEnter={() => runtime.scene && runtime.scene.setExplode(1)}
            onPointerLeave={() => runtime.scene && runtime.scene.setExplode(0)}
          >
            <a href={'mailto:' + email} ref={mailRef}>
              {at >= 0 ? <>{email.slice(0, at)}<wbr />{email.slice(at)}</> : email}
            </a>
          </p>
          <div className="contact-actions">
            <button type="button" className="btn btn-primary" onClick={copy}>Copy email address</button>
            {links.map((l, i) => <ExtLink key={i} url={l.url} label={l.label} className="btn btn-quiet" />)}
            {resume && <ExtLink url={resume} label="Resume" className="btn btn-quiet" />}
          </div>
        </>
      )}
    </section>
  );
}
