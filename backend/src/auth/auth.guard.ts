import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export const COOKIE_SESSAO = 'gf_sessao';
export const COOKIE_DESAFIO = 'gf_desafio';

// Rotas marcadas com @Publico() não pedem login (só as de entrar).
const PUBLICO = 'rota-publica';
export const Publico = () => SetMetadata(PUBLICO, true);

// Guarda global: toda rota da API exige uma sessão válida, salvo as @Publico().
@Injectable()
export class SessaoGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [contexto.getHandler(), contexto.getClass()]);
    if (publico) return true;

    const pedido = contexto.switchToHttp().getRequest<Request>();
    const token = pedido.cookies?.[COOKIE_SESSAO] as string | undefined;
    if (!token || !(await this.auth.sessaoValida(token))) throw new UnauthorizedException();
    return true;
  }
}
