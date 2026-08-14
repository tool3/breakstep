import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// antd v5 predates React 19 and still calls the removed `ReactDOM.render` in a
// few static paths. This is Ant Design's own shim; it must be imported before
// any antd component is used.
import '@ant-design/v5-patch-for-react-19';
import App from './App';
import './styles/global.scss';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
