import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { COOKIE_DESAFIO, COOKIE_SESSAO, PermiteEnvio, Publico, SessaoGuard } from './auth.guard';

class PedidoCadastro {
  @IsOptional() @IsString() @MaxLength(40) codigo?: string;
  @IsOptional() @IsString() @MaxLength(20) convite?: string;
}

class NovoConvite {
  @IsString() @MaxLength(40) pessoa!: string;
}

class RespostaCadastro {
  @IsObject() resposta!: RegistrationResponseJSON;
  @IsString() @MaxLength(40) aparelho!: string;
}

class RespostaEntrada {
  @IsObject() resposta!: AuthenticationResponseJSON;
}

const cookieBase: CookieOptions = {
  httpOnly: true, // o JavaScript da página não lê
  sameSite: 'strict', // outro site não consegue usar o cookie
  secure: process.env.NODE_ENV === 'production', // só HTTPS no servidor
  path: '/',
};

// Tentativas de entrar ou cadastrar: no máximo 10 por minuto.
const Tentativas = () => Throttle({ default: { limit: 10, ttl: 60_000 } });

@Controller('auth')
@UseGuards(ThrottlerGuard) // o resto das rotas fica no limite geral (120/min)
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Get('estado')
  estado(@Req() req: Request) {
    return this.auth.estado(req.cookies?.[COOKIE_SESSAO]);
  }

  @Publico()
  @Post('cadastro/opcoes')
  @Tentativas()
  async opcoesCadastro(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() corpo: PedidoCadastro) {
    const token = req.cookies?.[COOKIE_SESSAO];
    const usuario = token ? await this.auth.usuarioDaSessao(token) : null;
    const { opcoes, idDesafio } = await this.auth.opcoesDeCadastro(usuario, corpo.codigo, corpo.convite);
    res.cookie(COOKIE_DESAFIO, idDesafio, { ...cookieBase, maxAge: 5 * 60_000 });
    return opcoes;
  }

  @Publico()
  @Post('cadastro/verificar')
  @Tentativas()
  async verificarCadastro(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() corpo: RespostaCadastro) {
    const passkeyId = await this.auth.concluirCadastro(req.cookies?.[COOKIE_DESAFIO], corpo.resposta, corpo.aparelho);
    res.clearCookie(COOKIE_DESAFIO, cookieBase);
    // no primeiro acesso já sai logado; nos seguintes a sessão atual continua
    if (!(await this.auth.estado(req.cookies?.[COOKIE_SESSAO])).logado) await this.entrarCom(passkeyId, res);
    return { ok: true };
  }

  @Publico()
  @Post('entrar/opcoes')
  @Tentativas()
  async opcoesEntrada(@Res({ passthrough: true }) res: Response) {
    const { opcoes, idDesafio } = await this.auth.opcoesDeEntrada();
    res.cookie(COOKIE_DESAFIO, idDesafio, { ...cookieBase, maxAge: 5 * 60_000 });
    return opcoes;
  }

  @Publico()
  @Post('entrar/verificar')
  @Tentativas()
  async verificarEntrada(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() corpo: RespostaEntrada) {
    const passkeyId = await this.auth.concluirEntrada(req.cookies?.[COOKIE_DESAFIO], corpo.resposta);
    res.clearCookie(COOKIE_DESAFIO, cookieBase);
    await this.entrarCom(passkeyId, res);
    return { ok: true };
  }

  @Post('sair')
  @PermiteEnvio()
  @HttpCode(204)
  async sair(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.fecharSessao(req.cookies?.[COOKIE_SESSAO]);
    res.clearCookie(COOKIE_SESSAO, cookieBase);
  }

  // convite para alguém só enviar boletos (só o dono cria)
  @Post('convites')
  criarConvite(@Body() corpo: NovoConvite) {
    return this.auth.criarConvite(corpo.pessoa);
  }

  @Get('convites')
  convites() {
    return this.auth.convitesAbertos();
  }

  @Delete('convites/:id')
  @HttpCode(204)
  cancelarConvite(@Param('id') id: string) {
    return this.auth.cancelarConvite(id);
  }

  @Get('aparelhos')
  aparelhos() {
    return this.auth.aparelhos();
  }

  @Delete('aparelhos/:id')
  @HttpCode(204)
  removerAparelho(@Param('id') id: string) {
    return this.auth.removerAparelho(id);
  }

  private async entrarCom(passkeyId: string, res: Response) {
    const { token, expiraEm } = await this.auth.abrirSessao(passkeyId);
    res.cookie(COOKIE_SESSAO, token, { ...cookieBase, expires: expiraEm });
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: SessaoGuard }],
})
export class AuthModule {}
