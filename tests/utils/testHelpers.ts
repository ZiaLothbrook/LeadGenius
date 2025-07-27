import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement, ReactNode } from 'react';

// Test utilities for React components
interface AllTheProvidersProps {
  children: ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock data generators
export const generateMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const generateMockProspect = (overrides = {}) => ({
  id: 'test-prospect-id',
  userId: 'test-user-id',
  name: 'John Doe',
  title: 'CEO',
  company: 'Test Corp',
  industry: 'Technology',
  location: 'San Francisco, CA',
  email: 'john@testcorp.com',
  phone: '+1-555-0123',
  linkedinUrl: 'https://linkedin.com/in/johndoe',
  dataQuality: 0.95,
  verified: true,
  priority: 'high' as const,
  notes: 'Test prospect',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const generateMockCampaign = (overrides = {}) => ({
  id: 'test-campaign-id',
  userId: 'test-user-id',
  name: 'Test Campaign',
  description: 'Test campaign description',
  status: 'active' as const,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// API response helpers
export const createMockApiResponse = <T>(data: T, success = true) => ({
  json: async () => success ? data : { error: 'API Error' },
  ok: success,
  status: success ? 200 : 500,
  statusText: success ? 'OK' : 'Internal Server Error',
});

// Test database helpers
export const setupTestDatabase = async () => {
  // Add test database setup logic here
  // This could include creating test tables, seeding data, etc.
};

export const cleanupTestDatabase = async () => {
  // Add test database cleanup logic here
  // This could include truncating tables, removing test data, etc.
};

// Time helpers for testing
export const advanceTimersByTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
};

export const runAllTimers = () => {
  jest.runAllTimers();
};

// Error boundary for testing error scenarios
export class TestErrorBoundary extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestErrorBoundary';
  }
}