/* Icons for the liquid nav and buttons (outline, 24px grid, drawn with currentColor). */
function Ico({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const ICONS = {
  home: <Ico><path d="M3.5 11.2 12 4l8.5 7.2" /><path d="M6 9.6V20h12V9.6" /><path className="nv-door" d="M10 20v-5h4v5Z" /></Ico>,
  user: <Ico><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20c1.2-3.4 4-5 7.2-5s6 1.6 7.2 5" /></Ico>,
  code: <Ico><path d="M8.5 7 3.5 12l5 5" /><path d="m15.5 7 5 5-5 5" /><path d="m13.2 5-2.4 14" /></Ico>,
  layers: <Ico><path d="m12 3.8 8.5 4.4L12 12.6 3.5 8.2Z" /><path d="m3.5 12 8.5 4.4 8.5-4.4" /><path d="m3.5 15.8 8.5 4.4 8.5-4.4" /></Ico>,
  mail: <Ico><rect x="3.2" y="5.5" width="17.6" height="13" rx="2.2" /><path d="m3.8 7 8.2 6 8.2-6" /></Ico>,
  plane: <Ico><path d="M21 12.2 3.6 5.4l2.7 6.8-2.7 6.4L21 12.2Zm-14.7 0H13" /></Ico>,
  up: <Ico><path d="M12 19.5V5" /><path d="M5.8 11.2 12 5l6.2 6.2" /></Ico>,
  github: <Ico><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></Ico>,
  linkedin: <Ico><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></Ico>,
  file: <Ico><path d="M14 3.5H7.2a1.7 1.7 0 0 0-1.7 1.7v13.6a1.7 1.7 0 0 0 1.7 1.7h9.6a1.7 1.7 0 0 0 1.7-1.7V8Z" /><path d="M14 3.5V8h4.5" /><path d="M9 13h6M9 16.5h4" /></Ico>,
  link: <Ico><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></Ico>,
};
