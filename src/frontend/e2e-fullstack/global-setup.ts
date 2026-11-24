import type { FullConfig } from '@playwright/test';

const API_URL = process.env.FULLSTACK_API_URL ?? 'http://localhost:5000';
const UNKNOWN_PASTE = '/api/v1/pastes/aaaaaaaaaaaa';
const PROBLEM_JSON = 'application/problem+json';
const TIMEOUT_MS = 5_000;

const START_HINT = [
  'Start it from src/backend with ASPNETCORE_ENVIRONMENT=Development:',
  '  dotnet run --project src/SecurePaste.Api',
  'PostgreSQL must be running with the migrations applied.',
].join('\n');

async function get(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
}

async function requireReadyApi(): Promise<void> {
  let status: string;
  try {
    status = String((await get(`${API_URL}/readyz`)).status);
  } catch (error) {
    status = error instanceof Error ? error.message : String(error);
  }
  if (status !== '200') {
    throw new Error(
      `The full-stack suite needs the API at ${API_URL}, but ${API_URL}/readyz answered: ${status}.\n${START_HINT}`,
    );
  }
}

async function requireProxy(baseUrl: string): Promise<void> {
  const response = await get(`${baseUrl}${UNKNOWN_PASTE}`);
  const type = response.headers.get('content-type') ?? '';
  if (response.status !== 404 || !type.startsWith(PROBLEM_JSON)) {
    throw new Error(
      `${baseUrl} does not proxy /api to the backend: GET ${UNKNOWN_PASTE} answered ${response.status} ${type}.`,
    );
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  await requireReadyApi();
  const baseUrl = config.projects[0]?.use.baseURL;
  if (baseUrl === undefined) {
    throw new Error('The full-stack config has no baseURL.');
  }
  await requireProxy(baseUrl);
}
