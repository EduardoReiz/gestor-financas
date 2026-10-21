import { hashDoToken } from './auth.service';

describe('hashDoToken', () => {
  it('é o SHA-256 em hexadecimal (o token nunca é guardado em texto)', () => {
    expect(hashDoToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('é determinístico e muda com qualquer caractere', () => {
    expect(hashDoToken('token-1')).toBe(hashDoToken('token-1'));
    expect(hashDoToken('token-1')).not.toBe(hashDoToken('token-2'));
    expect(hashDoToken('token-1')).toHaveLength(64);
  });
});
