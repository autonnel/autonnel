// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnauthenticatedPage from '@/components/primitives/UnauthenticatedPage';

describe('UnauthenticatedPage', () => {
  it('renders provided login copy and link', () => {
    render(
      <UnauthenticatedPage
        title="Private Console"
        subtitle="Sign in required"
        loginUrl="/auth/start"
        buttonText="Continue"
      />,
    );

    expect(screen.getByText('Private Console')).toBeTruthy();
    expect(screen.getByText('Sign in required')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe('/auth/start');
  });
});
