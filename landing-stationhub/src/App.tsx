import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DocsLayout } from '@/src/components/docs/DocsLayout';
import { DEFAULT_DOC_SLUG } from '@/src/docs/content';
import { DemoPage } from '@/src/pages/DemoPage';
import { DocsPageView } from '@/src/pages/DocsPageView';
import { HomePage } from '@/src/pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Navigate to={DEFAULT_DOC_SLUG} replace />} />
          <Route path=":slug" element={<DocsPageView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
