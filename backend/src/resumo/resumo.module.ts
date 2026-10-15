import { Controller, Get, Module, Query } from '@nestjs/common';
import { ResumoService } from './resumo.service';
import { SugestoesModule } from '../sugestoes/sugestoes.module';

@Controller('resumo')
class ResumoController {
  constructor(private readonly resumo: ResumoService) {}

  // GET /api/resumo?mes=2026-10 -> tudo que a tela Início precisa
  @Get()
  doMes(@Query('mes') mes?: string) {
    return this.resumo.doMes(mes);
  }
}

@Module({
  imports: [SugestoesModule],
  controllers: [ResumoController],
  providers: [ResumoService],
})
export class ResumoModule {}
