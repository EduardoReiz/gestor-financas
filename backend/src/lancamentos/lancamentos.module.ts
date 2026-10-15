import { Body, Controller, Get, HttpCode, Module, Param, Patch, Query } from '@nestjs/common';
import { LancamentosService } from './lancamentos.service';
import { FiltroLancamentos, TrocarCategoria } from './lancamentos.dto';

@Controller()
class LancamentosController {
  constructor(private readonly lancamentos: LancamentosService) {}

  @Get('lancamentos')
  listar(@Query() filtro: FiltroLancamentos) {
    return this.lancamentos.listar(filtro);
  }

  @Patch('lancamentos/:id/confirmar')
  @HttpCode(204)
  confirmar(@Param('id') id: string) {
    return this.lancamentos.confirmarCategoria(id);
  }

  @Patch('lancamentos/:id/categoria')
  trocarCategoria(@Param('id') id: string, @Body() dados: TrocarCategoria) {
    return this.lancamentos.trocarCategoria(id, dados);
  }

  @Get('categorias')
  categorias() {
    return this.lancamentos.categorias();
  }
}

@Module({
  controllers: [LancamentosController],
  providers: [LancamentosService],
})
export class LancamentosModule {}
