import { describe, expect, it } from 'vitest';
import { parseApiEndpoints } from '@/core/dialogue/dialogueService';

describe('parseApiEndpoints', () => {
  it('normalizes and deduplicates the primary and fallback endpoints', () => {
    expect(
      parseApiEndpoints('http://localhost:8000/', 'http://backup:8000, http://localhost:8000/'),
    ).toEqual(['http://localhost:8000', 'http://backup:8000']);
  });
});
