import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.module';

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const DURACAO_DESAFIO_MS = 5 * 60 * 1000;
// O app tem um dono só: todas as passkeys pertencem ao mesmo "usuário" WebAuthn.
const ID_DO_DONO = new TextEncoder().encode('gestor-financas-dono');

interface Desafio {
  valor: string;
  tipo: 'cadastro' | 'entrada';
  expiraEm: number;
}

export const hashDoToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  // Desafios pendentes ficam em memória: duram 5 minutos e só existe um servidor.
  private readonly desafios = new Map<string, Desafio>();

  constructor(private readonly prisma: PrismaService) {}

  private get rp() {
    return {
      id: process.env.RP_ID ?? 'localhost',
      nome: process.env.RP_NOME ?? 'GestorDeFinanças',
      origem: process.env.ORIGEM_WEB ?? 'http://localhost:5173',
    };
  }

  async estado(token?: string) {
    const [aparelhos, sessao] = await Promise.all([
      this.prisma.passkey.count(),
      token ? this.sessaoValida(token) : null,
    ]);
    return { logado: !!sessao, primeiroAcesso: aparelhos === 0 };
  }

  // ---------- cadastro de aparelho ----------

  // Primeiro aparelho: precisa do código do .env. Depois: só quem já está logado.
  async opcoesDeCadastro(logado: boolean, codigo?: string) {
    const existentes = await this.prisma.passkey.findMany({ select: { credentialId: true, transports: true } });

    if (existentes.length === 0) {
      if (!codigoConfere(codigo, process.env.CODIGO_CADASTRO)) throw new ForbiddenException('código de cadastro errado');
    } else if (!logado) {
      throw new UnauthorizedException('entre com um aparelho já cadastrado para adicionar outro');
    }

    const opcoes = await generateRegistrationOptions({
      rpName: this.rp.nome,
      rpID: this.rp.id,
      userName: 'dono',
      userDisplayName: 'Dono do GestorDeFinanças',
      userID: ID_DO_DONO,
      attestationType: 'none',
      excludeCredentials: existentes.map((p) => ({ id: p.credentialId, transports: p.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });

    return { opcoes, idDesafio: this.guardarDesafio(opcoes.challenge, 'cadastro') };
  }

  async concluirCadastro(idDesafio: string | undefined, resposta: RegistrationResponseJSON, aparelho: string) {
    const desafio = this.usarDesafio(idDesafio, 'cadastro');
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: resposta,
      expectedChallenge: desafio,
      expectedOrigin: this.rp.origem,
      expectedRPID: this.rp.id,
      requireUserVerification: true,
    }).catch(() => ({ verified: false, registrationInfo: undefined }));

    if (!verified || !registrationInfo) throw new UnauthorizedException('não foi possível confirmar o aparelho');

    const { credential } = registrationInfo;
    const passkey = await this.prisma.passkey.create({
      data: {
        credentialId: credential.id,
        chavePublica: Buffer.from(credential.publicKey),
        contador: credential.counter,
        transports: credential.transports ?? [],
        aparelho: aparelho.trim().slice(0, 40) || 'Aparelho',
      },
    });
    return passkey.id;
  }

  // ---------- entrar ----------

  async opcoesDeEntrada() {
    // sem allowCredentials: o próprio aparelho oferece a passkey que tiver (Face ID / Touch ID)
    const opcoes = await generateAuthenticationOptions({ rpID: this.rp.id, userVerification: 'required' });
    return { opcoes, idDesafio: this.guardarDesafio(opcoes.challenge, 'entrada') };
  }

  async concluirEntrada(idDesafio: string | undefined, resposta: AuthenticationResponseJSON) {
    const desafio = this.usarDesafio(idDesafio, 'entrada');
    const passkey = await this.prisma.passkey.findUnique({ where: { credentialId: resposta.id } });
    if (!passkey) throw new UnauthorizedException('aparelho não cadastrado');

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: resposta,
      expectedChallenge: desafio,
      expectedOrigin: this.rp.origem,
      expectedRPID: this.rp.id,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.chavePublica),
        counter: passkey.contador,
        transports: passkey.transports,
      },
    }).catch(() => ({ verified: false, authenticationInfo: undefined }));

    if (!verified || !authenticationInfo) throw new UnauthorizedException('Face ID não confirmado');

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { contador: authenticationInfo.newCounter, usadaEm: new Date() },
    });
    return passkey.id;
  }

  // ---------- sessões ----------

  async abrirSessao(passkeyId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
    await this.prisma.sessao.create({ data: { id: hashDoToken(token), passkeyId, expiraEm } });
    // aproveita para limpar sessões vencidas
    await this.prisma.sessao.deleteMany({ where: { expiraEm: { lt: new Date() } } });
    return { token, expiraEm };
  }

  async sessaoValida(token: string) {
    const sessao = await this.prisma.sessao.findUnique({ where: { id: hashDoToken(token) } });
    if (!sessao || sessao.expiraEm < new Date()) return null;
    return sessao;
  }

  async fecharSessao(token?: string) {
    if (token) await this.prisma.sessao.deleteMany({ where: { id: hashDoToken(token) } });
  }

  // ---------- aparelhos ----------

  aparelhos() {
    return this.prisma.passkey.findMany({
      select: { id: true, aparelho: true, criadaEm: true, usadaEm: true },
      orderBy: { criadaEm: 'asc' },
    });
  }

  async removerAparelho(id: string) {
    if ((await this.prisma.passkey.count()) <= 1) {
      throw new ForbiddenException('não dá para remover o único aparelho: você ficaria trancado para fora');
    }
    await this.prisma.passkey.delete({ where: { id } });
  }

  // ---------- desafios ----------

  private guardarDesafio(valor: string, tipo: Desafio['tipo']) {
    const agora = Date.now();
    for (const [id, d] of this.desafios) if (d.expiraEm < agora) this.desafios.delete(id);

    const id = randomBytes(16).toString('base64url');
    this.desafios.set(id, { valor, tipo, expiraEm: agora + DURACAO_DESAFIO_MS });
    return id;
  }

  // Cada desafio vale uma vez só.
  private usarDesafio(id: string | undefined, tipo: Desafio['tipo']) {
    const desafio = id ? this.desafios.get(id) : undefined;
    if (id) this.desafios.delete(id);
    if (!desafio || desafio.tipo !== tipo || desafio.expiraEm < Date.now()) {
      throw new UnauthorizedException('o pedido expirou, tente de novo');
    }
    return desafio.valor;
  }
}

function codigoConfere(digitado: string | undefined, esperado: string | undefined) {
  if (!digitado || !esperado) return false;
  const a = Buffer.from(digitado.trim().toUpperCase());
  const b = Buffer.from(esperado.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
