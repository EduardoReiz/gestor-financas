import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService, type Usuario } from './auth.service';

export const COOKIE_SESSAO = 'gf_sessao';
export const COOKIE_DESAFIO = 'gf_desafio';

// Rotas marcadas com @Publico() não pedem login (só as de entrar).
const PUBLICO = 'rota-publica';
export const Publico = () => SetMetadata(PUBLICO, true);

// O acesso de ENVIO (a pessoa convidada) só passa pelas rotas marcadas com @PermiteEnvio().
// Tudo o que não tiver a marca é negado para ele: esquecer a marca fecha, não abre.
const PERMITE_ENVIO = 'permite-envio';
export const PermiteEnvio = () => SetMetadata(PERMITE_ENVIO, true);

// Quem está logado, para usar dentro das rotas: @UsuarioAtual() usuario: Usuario
export const UsuarioAtual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext) => contexto.switchToHttp().getRequest<Request & { usuario?: Usuario }>().usuario,
);

// Guarda global: toda rota da API exige uma sessão válida, salvo as @Publico().
@Injectable()
export class SessaoGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext) {
    const alvos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const pedido = contexto.switchToHttp().getRequest<Request & { usuario?: Usuario }>();
    const token = pedido.cookies?.[COOKIE_SESSAO] as string | undefined;
    const usuario = token ? await this.auth.usuarioDaSessao(token) : null;
    if (!usuario) throw new UnauthorizedException();

    if (usuario.papel !== 'DONO' && !this.reflector.getAllAndOverride<boolean>(PERMITE_ENVIO, alvos)) {
      throw new ForbiddenException('este acesso é só para enviar boletos');
    }
    pedido.usuario = usuario;
    return true;
  }
}
