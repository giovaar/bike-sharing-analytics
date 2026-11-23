import { createRoot } from 'react-dom/client';
import App from './App';

const mount = document.getElementById('root');
if (!mount) throw new Error('Root element missing');
createRoot(mount).render(<App />);
