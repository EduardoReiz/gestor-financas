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
import { Papel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const DURACAO_DESAFIO_MS = 5 * 60 * 1000;
// O app tem um dono só: todas as passkeys pertencem ao mesmo "usuário" WebAuthn.
const ID_DO_DONO = new TextEncoder().encode('gestor-financas-dono');

interface Desafio {
  valor: string;
  tipo: 'cadastro' | 'entrada';
  expiraEm: number;
  conviteId?: string; // cadastro pelo convite (acesso só de envio)
}

export interface Usuario {
  passkeyId: string;
  papel: Papel;
  pessoa: string | null;
}

const DURACAO_CONVITE_MS = 48 * 60 * 60 * 1000;

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
    const [aparelhos, usuario] = await Promise.all([
      this.prisma.passkey.count(),
      token ? this.usuarioDaSessao(token) : null,
    ]);
    return { logado: !!usuario, primeiroAcesso: aparelhos === 0, papel: usuario?.papel ?? null, pessoa: usuario?.pessoa ?? null };
  }

  // ---------- cadastro de aparelho ----------

  // Três jeitos de cadastrar um aparelho:
  //  - primeiro de todos: com o código do .env (vira DONO);
  //  - outro aparelho seu: só com sessão de DONO aberta;
  //  - pelo convite: a pessoa convidada, com o papel do convite (ENVIO).
  async opcoesDeCadastro(usuario: Usuario | null, codigo?: string, convite?: string) {
    const existentes = await this.prisma.passkey.findMany({ select: { credentialId: true, transports: true } });
    let conviteId: string | undefined;
    let pessoa = 'dono';

    if (convite) {
      const achado = await this.conviteValido(convite);
      conviteId = achado.id;
      pessoa = achado.pessoa;
    } else if (existentes.length === 0) {
      if (!codigoConfere(codigo, process.env.CODIGO_CADASTRO)) throw new ForbiddenException('código de cadastro errado');
    } else if (usuario?.papel !== 'DONO') {
      throw new UnauthorizedException('entre com um aparelho seu já cadastrado para adicionar outro');
    }

    const opcoes = await generateRegistrationOptions({
      rpName: this.rp.nome,
      rpID: this.rp.id,
      userName: pessoa,
      userDisplayName: conviteId ? `${pessoa} (envio de boletos)` : 'Dono do GestorDeFinanças',
      // cada pessoa tem o seu "usuário": a passkey da pessoa convidada não se mistura com a sua
      userID: conviteId ? new TextEncoder().encode(`gestor-financas-${conviteId}`) : ID_DO_DONO,
      attestationType: 'none',
      excludeCredentials: existentes.map((p) => ({ id: p.credentialId, transports: p.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });

    return { opcoes, idDesafio: this.guardarDesafio(opcoes.challenge, 'cadastro', conviteId) };
  }

  async concluirCadastro(idDesafio: string | undefined, resposta: RegistrationResponseJSON, aparelho: string) {
    const { valor: desafio, conviteId } = this.usarDesafio(idDesafio, 'cadastro');
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: resposta,
      expectedChallenge: desafio,
      expectedOrigin: this.rp.origem,
      expectedRPID: this.rp.id,
      requireUserVerification: true,
    }).catch(() => ({ verified: false, registrationInfo: undefined }));

    if (!verified || !registrationInfo) throw new UnauthorizedException('não foi possível confirmar o aparelho');

    const { credential } = registrationInfo;
    const dados = {
      credentialId: credential.id,
      chavePublica: Buffer.from(credential.publicKey),
      contador: credential.counter,
      transports: credential.transports ?? [],
      aparelho: aparelho.trim().slice(0, 40) || 'Aparelho',
    };
    if (!conviteId) return (await this.prisma.passkey.create({ data: dados })).id;

    // convite: marca como usado na mesma transação (ninguém usa duas vezes)
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.convite.updateMany({
        where: { id: conviteId, usadoEm: null, expiraEm: { gt: new Date() } },
        data: { usadoEm: new Date() },
      });
      if (count === 0) throw new ForbiddenException('o convite já foi usado ou expirou');
      const convite = await tx.convite.findUniqueOrThrow({ where: { id: conviteId } });
      return (await tx.passkey.create({ data: { ...dados, papel: convite.papel, pessoa: convite.pessoa } })).id;
    });
  }

  // ---------- entrar ----------

  async opcoesDeEntrada() {
    // sem allowCredentials: o próprio aparelho oferece a passkey que tiver (Face ID / Touch ID)
    const opcoes = await generateAuthenticationOptions({ rpID: this.rp.id, userVerification: 'required' });
    return { opcoes, idDesafio: this.guardarDesafio(opcoes.challenge, 'entrada') };
  }

  async concluirEntrada(idDesafio: string | undefined, resposta: AuthenticationResponseJSON) {
    const { valor: desafio } = this.usarDesafio(idDesafio, 'entrada');
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

  async usuarioDaSessao(token: string): Promise<Usuario | null> {
    const sessao = await this.prisma.sessao.findUnique({
      where: { id: hashDoToken(token) },
      include: { passkey: { select: { id: true, papel: true, pessoa: true } } },
    });
    if (!sessao || sessao.expiraEm < new Date()) return null;
    return { passkeyId: sessao.passkey.id, papel: sessao.passkey.papel, pessoa: sessao.passkey.pessoa };
  }

  // ---------- convites ----------

  async criarConvite(pessoa: string) {
    // 8 letras e números sem os que confundem (0/O, 1/I)
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codigo = Array.from(randomBytes(8), (b) => alfabeto[b % alfabeto.length]).join('');
    await this.prisma.convite.create({
      data: { codigoHash: hashDoToken(codigo), pessoa: pessoa.trim(), expiraEm: new Date(Date.now() + DURACAO_CONVITE_MS) },
    });
    return { codigo, validoAte: new Date(Date.now() + DURACAO_CONVITE_MS) };
  }

  convitesAbertos() {
    return this.prisma.convite.findMany({
      where: { usadoEm: null, expiraEm: { gt: new Date() } },
      select: { id: true, pessoa: true, expiraEm: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async cancelarConvite(id: string) {
    await this.prisma.convite.deleteMany({ where: { id, usadoEm: null } });
  }

  private async conviteValido(codigo: string) {
    const convite = await this.prisma.convite.findUnique({ where: { codigoHash: hashDoToken(codigo.trim().toUpperCase()) } });
    if (!convite || convite.usadoEm || convite.expiraEm < new Date()) throw new ForbiddenException('convite inválido, usado ou vencido');
    return convite;
  }

  async fecharSessao(token?: string) {
    if (token) await this.prisma.sessao.deleteMany({ where: { id: hashDoToken(token) } });
  }

  // ---------- aparelhos ----------

  aparelhos() {
    return this.prisma.passkey.findMany({
      select: { id: true, aparelho: true, papel: true, pessoa: true, criadaEm: true, usadaEm: true },
      orderBy: { criadaEm: 'asc' },
    });
  }

  async removerAparelho(id: string) {
    const alvo = await this.prisma.passkey.findUnique({ where: { id } });
    if (alvo?.papel === 'DONO' && (await this.prisma.passkey.count({ where: { papel: 'DONO' } })) <= 1) {
      throw new ForbiddenException('não dá para remover o seu único aparelho: você ficaria trancado para fora');
    }
    await this.prisma.passkey.delete({ where: { id } });
  }

  // ---------- desafios ----------

  private guardarDesafio(valor: string, tipo: Desafio['tipo'], conviteId?: string) {
    const agora = Date.now();
    for (const [id, d] of this.desafios) if (d.expiraEm < agora) this.desafios.delete(id);

    const id = randomBytes(16).toString('base64url');
    this.desafios.set(id, { valor, tipo, conviteId, expiraEm: agora + DURACAO_DESAFIO_MS });
    return id;
  }

  // Cada desafio vale uma vez só.
  private usarDesafio(id: string | undefined, tipo: Desafio['tipo']) {
    const desafio = id ? this.desafios.get(id) : undefined;
    if (id) this.desafios.delete(id);
    if (!desafio || desafio.tipo !== tipo || desafio.expiraEm < Date.now()) {
      throw new UnauthorizedException('o pedido expirou, tente de novo');
    }
    return desafio;
  }
}

function codigoConfere(digitado: string | undefined, esperado: string | undefined) {
  if (!digitado || !esperado) return false;
  const a = Buffer.from(digitado.trim().toUpperCase());
  const b = Buffer.from(esperado.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
