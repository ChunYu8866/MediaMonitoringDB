import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './lib/theme';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { KeywordsPage } from './pages/KeywordsPage';
import { TopicsPage } from './pages/TopicsPage';
import { EntitiesPage } from './pages/EntitiesPage';
import { MethodPage } from './pages/MethodPage';
import { SearchPage } from './pages/SearchPage';
import { AdvancedAnalysisPage } from './pages/AdvancedAnalysisPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<SearchPage />} />
            <Route path="analysis" element={<AdvancedAnalysisPage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="keywords" element={<KeywordsPage />} />
            <Route path="topics" element={<TopicsPage />} />
            <Route path="entities" element={<EntitiesPage />} />
            <Route path="method" element={<MethodPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
