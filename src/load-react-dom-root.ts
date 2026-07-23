import { createPortal } from 'react-dom';

export const reactDomRootWasLoaded = typeof createPortal === 'function';
