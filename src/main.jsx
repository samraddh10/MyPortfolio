import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/site.css';

// No StrictMode: the WebGL stage and liquid nav are imperative and set up once per visit,
// and StrictMode's double-run of effects in development would create them twice.
createRoot(document.getElementById('root')).render(<App />);
