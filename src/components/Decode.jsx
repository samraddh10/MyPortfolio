import { Fragment, memo } from 'react';
import { DECODE_ON, decodeRef } from '../runtime/decode.js';

const flat = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// One span per letter, grouped by word so words never break apart. They start as dots;
// runtime/decode.js changes their classes directly, so these never re-render.
const Letters = memo(function Letters({ text }) {
  return String(text).split(/(\s+)/).map((part, i) => {
    if (!part) return null;
    if (/^\s+$/.test(part)) return part;
    return (
      <span className="dw" key={i}>
        {Array.from(part).map((ch, j) => <span className="dc is-dot" key={j}>{ch}</span>)}
      </span>
    );
  });
});

// A heading whose letters arrive as dots and settle as it scrolls into view.
export function DecodeText({ as: Tag, text, ...rest }) {
  const t = flat(text);
  if (!DECODE_ON || !t) return <Tag {...rest}>{text}</Tag>;
  return (
    <Tag {...rest} ref={decodeRef}>
      <span className="visually-hidden sr-copy">{t}</span>
      <span aria-hidden="true"><Letters text={text} /></span>
    </Tag>
  );
}

// A name on two lines (first name, then the rest), each line rising in on its own.
export function NameLines({ as: Tag, name, ...rest }) {
  const t = flat(name);
  const parts = t.split(' ');
  const lines = parts.length < 2 ? [name] : [parts[0], parts.slice(1).join(' ')];
  const dec = DECODE_ON && !!t;
  return (
    <Tag {...rest} ref={dec ? decodeRef : undefined}>
      {dec && <span className="visually-hidden sr-copy">{t}</span>}
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="line" aria-hidden={dec || undefined}><span>{dec ? <Letters text={line} /> : line}</span></span>
        </Fragment>
      ))}
    </Tag>
  );
}
