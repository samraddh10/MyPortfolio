import { useEffect, useState } from 'react';

let show = null;
let timer = 0;

// Brief status message at the bottom of the screen, used for copy feedback.
export function toast(msg) {
  if (show) show(msg);
}

export function Toast() {
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);
  useEffect(() => {
    show = (m) => {
      setMsg(m);
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), 2200);
    };
    return () => { show = null; };
  }, []);
  return <div className={'toast' + (on ? ' is-on' : '')} role="status">{msg}</div>;
}
