import { Controller, Get, Module, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { PluggyClient } from './pluggy.client';
import { SincronizacaoService, itensConfigurados } from './sincronizacao.service';

@Controller('sincronizacao')
class SincronizacaoController {
  constructor(
    private readonly sincronizacao: SincronizacaoService,
    private readonly pluggy: PluggyClient,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async estado() {
    const ultima = await this.prisma.sincronizacao.findFirst({ orderBy: { iniciadaEm: 'desc' } });
    return {
      configurado: this.pluggy.configurado && itensConfigurados().length > 0,
      bancos: itensConfigurados().map((i) => i.banco),
      ultima: ultima && {
        quando: ultima.terminadaEm ?? ultima.iniciadaEm,
        sucesso: ultima.sucesso,
        erro: ultima.erro,
        novos: ultima.novos,
      },
    };
  }

  // botão "sincronizar agora"
  @Post()
  sincronizar() {
    return this.sincronizacao.sincronizar();
  }

  // botão "pedir dados novos aos bancos": o Pluggy busca no banco e depois sincroniza
  @Post('atualizar-bancos')
  atualizarBancos() {
    return this.sincronizacao.atualizarBancos();
  }
}

@Module({
  controllers: [SincronizacaoController],
  providers: [PluggyClient, SincronizacaoService],
  exports: [SincronizacaoService],
})
export class PluggyModule {}
