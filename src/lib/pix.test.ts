import { describe, expect, it } from 'vitest';
import { crc16, isValidPixPayload } from './pix';
import { PIX_PAYLOAD } from './branding';

describe('PIX', () => {
  it('calcula o CRC16 do payload oficial do app', () => {
    expect(crc16(PIX_PAYLOAD.slice(0, -4))).toBe('C140');
    expect(PIX_PAYLOAD.slice(-4)).toBe('C140');
  });

  it('valida a estrutura do payload', () => {
    expect(isValidPixPayload(PIX_PAYLOAD)).toBe(true);
  });

  it('rejeita payload com CRC alterado', () => {
    expect(isValidPixPayload(`${PIX_PAYLOAD.slice(0, -4)}0000`)).toBe(false);
  });

  it('rejeita payload curto', () => {
    expect(isValidPixPayload('123')).toBe(false);
  });
});
