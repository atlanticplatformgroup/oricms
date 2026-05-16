import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { ReadonlyFieldValue } from '../ReadonlyFieldValue';

function renderValue(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('ReadonlyFieldValue', () => {
  it('renders primitive values', () => {
    renderValue(<ReadonlyFieldValue value="Hello world" field={{ key: 'title', label: 'Title', type: 'string' } as any} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders nested objects with structured rows', () => {
    renderValue(<ReadonlyFieldValue value={{ title: 'Hello', nested: { slug: 'hello-world' } }} field={{ key: 'meta', type: 'object' } as any} />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Nested')).toBeInTheDocument();
    expect(screen.getByText('hello-world')).toBeInTheDocument();
  });

  it('falls back to a structured dump at depth limit', () => {
    renderValue(
      <ReadonlyFieldValue
        value={{ level1: { level2: { level3: { slug: 'deep-value' } } } }}
        field={{ key: 'meta', type: 'object' } as any}
      />,
    );
    expect(screen.getByText('Level1')).toBeInTheDocument();
    expect(screen.getByText('Level2')).toBeInTheDocument();
    expect(screen.queryByText('Level3')).not.toBeInTheDocument();
    expect(screen.getByText(/"slug": "deep-value"/)).toBeInTheDocument();
  });

  it('renders arrays', () => {
    renderValue(<ReadonlyFieldValue value={['one', 'two']} field={{ key: 'tags', type: 'array' } as any} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('renders empty state for nullish values', () => {
    renderValue(<ReadonlyFieldValue value={null} field={{ key: 'title', type: 'string' } as any} />);
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('renders relation labels when provided', () => {
    renderValue(<ReadonlyFieldValue value="author-1" field={{ key: 'author', type: 'relation' } as any} context={{ relationLabels: { 'author-1': 'Jane Editor' } }} />);
    expect(screen.getByText('Jane Editor')).toBeInTheDocument();
  });

  it('renders structured project asset references', () => {
    renderValue(
      <ReadonlyFieldValue
        value={{ $ref: 'asset', scope: 'project', path: 'assets/images/hero.png' }}
        field={{ key: 'heroImage', label: 'Hero image', type: 'image' } as any}
      />,
    );

    expect(screen.getByText('hero.png')).toBeInTheDocument();
    expect(screen.getByText('assets/images/hero.png')).toBeInTheDocument();
  });

  it('renders structured global asset references', () => {
    renderValue(
      <ReadonlyFieldValue
        value={{ $ref: 'asset', scope: 'global', assetId: 'brand/logo-primary' }}
        field={{ key: 'brandLogo', label: 'Brand logo', type: 'image' } as any}
      />,
    );

    expect(screen.getByText('logo-primary')).toBeInTheDocument();
    expect(screen.getByText('brand/logo-primary')).toBeInTheDocument();
  });
});
