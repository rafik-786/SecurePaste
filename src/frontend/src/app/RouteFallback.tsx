import { LoadingStatus } from '../components/Spinner';

export const ROUTE_LOADING_LABEL = 'Loading...';

export function RouteFallback() {
  return <LoadingStatus label={ROUTE_LOADING_LABEL} />;
}
