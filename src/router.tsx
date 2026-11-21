import { createHashRouter, useParams } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { App } from './App';
import { HomePage } from './components/Layout/HomePage';
import {
  allNotesLoader,
  noteLoader,
  allLogsLoader,
  logLoader,
} from './loaders/dataLoaders';

// Lazy Load Components
const AllNotesView = lazy(() => import('./components/Views/AllNotesView').then(m => ({ default: m.AllNotesView })));
const AllLogsView = lazy(() => import('./components/Views/AllLogsView').then(m => ({ default: m.AllLogsView })));
const NoteEditor = lazy(() => import('./components/Views/NoteEditor').then(m => ({ default: m.NoteEditor })));
const LogEditor = lazy(() => import('./components/Views/LogEditor').then(m => ({ default: m.LogEditor })));
const DiagramsView = lazy(() => import('./components/Views/DiagramsView').then(m => ({ default: m.DiagramsView })));
const DiagramEditorWrapper = lazy(() => import('./components/Views/DiagramEditor').then(m => ({ default: m.DiagramEditorWrapper })));
const LogDashboardView = lazy(() => import('./components/Views/LogDashboardView').then(m => ({ default: m.LogDashboardView })));

const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full text-text-muted">
        Loading...
    </div>
);

// Wrapper that forces remount on ID change using key prop
function NoteEditorKeyed() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NoteEditor key={id} />
    </Suspense>
  );
}

function LogEditorKeyed() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LogEditor key={id} />
    </Suspense>
  );
}

import { useLocation } from 'react-router-dom';

function LogDashboardKeyed() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  // Use id or location key to force remount
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LogDashboardView key={id || `new-${location.key}`} />
    </Suspense>
  );
}

import { ErrorPage } from './components/Layout/ErrorPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'notes',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AllNotesView />
          </Suspense>
        ),
        loader: allNotesLoader,
      },
      {
        path: 'notes/:id',
        element: <NoteEditorKeyed />,
        loader: noteLoader,
        id: 'note-editor',
      },
      {
        path: 'logs',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AllLogsView />
          </Suspense>
        ),
        loader: allLogsLoader,
      },
      {
        path: 'logs/:id',
        element: <LogEditorKeyed />,
        loader: logLoader,
        id: 'log-editor',
      },
      {
        path: 'diagrams',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <DiagramsView />
          </Suspense>
        ),
      },
      {
        path: 'log-analysis',
        element: <LogDashboardKeyed />,
      },
      {
        path: 'log-analysis/:id',
        element: <LogDashboardKeyed />,
      },
      {
        path: 'diagrams/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <DiagramEditorWrapper />
          </Suspense>
        ),
      },
    ],
  },
]);

