import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { RouteFallback } from './RouteFallback';

const CreateRoute = lazy(() =>
  import('../routes/create/CreateRoute').then((module) => ({ default: module.CreateRoute })),
);
const ReadRoute = lazy(() =>
  import('../routes/read/ReadRoute').then((module) => ({ default: module.ReadRoute })),
);
const DeleteRoute = lazy(() =>
  import('../routes/delete/DeleteRoute').then((module) => ({ default: module.DeleteRoute })),
);
const NotFoundRoute = lazy(() =>
  import('../routes/notFound/NotFoundRoute').then((module) => ({ default: module.NotFoundRoute })),
);

function CreateRouteForLocation() {
  const { key } = useLocation();
  return <CreateRoute key={key} />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<CreateRouteForLocation />} />
        <Route path="/p/:id" element={<ReadRoute />} />
        <Route path="/d/:id" element={<DeleteRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </Suspense>
  );
}
