import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { applyTheme, loadTheme } from './utils/themes';

applyTheme(loadTheme()); // before the first paint, so the saved theme never flashes copper

createRoot(document.getElementById('root')).render(<App />);
