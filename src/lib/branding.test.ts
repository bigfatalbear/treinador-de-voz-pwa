import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_UUID, PIX_PAYLOAD } from './branding';

describe('branding', () => {
  it('usa o UUID de marca exigido', () => {
    expect(APP_UUID).toBe('2dfce9de-de4b-57ae-a291-a170c20195cd');
    expect(APP_NAME).toBe('CORAL PIBENS ACADEMY');
  });

  it('mantém o payload PIX estático', () => {
    expect(PIX_PAYLOAD.startsWith('000201')).toBe(true);
    expect(PIX_PAYLOAD.endsWith('C140')).toBe(true);
  });
});
