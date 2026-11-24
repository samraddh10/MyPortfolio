import { NameLines } from './Decode.jsx';
import { enterPortfolio } from '../runtime/gate.js';

// Welcome screen shown before the portfolio, only while the root element has the "gated" class.
export function Gate({ name, line }) {
  return (
    <div className="gate" id="gate" role="dialog" aria-modal="true" aria-label="Welcome" onClick={enterPortfolio}>
      <div className="gate-inner">
        <NameLines as="p" className="gate-name" name={name} />
        <p className="gate-line">{line || 'Backend systems, built from the socket up.'}</p>
        <div className="gate-row">
          <button type="button" className="gate-enter" id="gate-enter">Enter the portfolio</button>
          <p className="gate-hint">
            <span className="hint-mouse">or click anywhere, scroll, or press Enter</span>
            <span className="hint-touch">or tap anywhere, or swipe up</span>
          </p>
        </div>
      </div>
    </div>
  );
}
