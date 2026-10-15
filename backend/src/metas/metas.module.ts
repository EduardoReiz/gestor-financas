import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';

class NovaMeta {
  @IsString() @MaxLength(60) nome!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valorAlvo!: number;
  @IsDateString() prazo!: string; // AAAA-MM-DD
}

class NovoAporte {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valor!: number;
}

const MES_MS = 30.44 * 86_400_000;
const centavos = (v: number) => Math.round(v * 100) / 100;

@Injectable()
class MetasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    const metas = await this.prisma.meta.findMany({
      where: { arquivada: false },
      include: { aportes: { orderBy: { data: 'asc' } } },
      orderBy: { prazo: 'asc' },
    });
    const agora = Date.now();
    const inicioDoMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const lista = metas.map((m) => {
      const alvo = m.valorAlvo.toNumber();
      const guardado = centavos(m.aportes.reduce((s, a) => s + a.valor.toNumber(), 0));
      const guardadoNoMes = centavos(
        m.aportes.filter((a) => a.data >= inicioDoMes).reduce((s, a) => s + a.valor.toNumber(), 0),
      );
      const falta = Math.max(0, alvo - guardado);
      const mesesRestantes = Math.max(1, Math.ceil((m.prazo.getTime() - agora) / MES_MS));

      // "No ritmo" compara com a linha reta entre o começo da meta e o prazo:
      // assim o dia 1 do mês não marca atraso só porque ainda não deu tempo.
      const comeco = Math.min(m.criadaEm.getTime(), m.aportes[0]?.data.getTime() ?? Infinity);
      const fracaoDoTempo = Math.min(1, Math.max(0, (agora - comeco) / (m.prazo.getTime() - comeco)));
      const esperadoAteHoje = alvo * fracaoDoTempo;

      let situacao: 'concluida' | 'no-ritmo' | 'atrasada' = 'no-ritmo';
      if (guardado >= alvo) situacao = 'concluida';
      else if (guardado < esperadoAteHoje * 0.95) situacao = 'atrasada';

      return {
        id: m.id,
        nome: m.nome,
        alvo,
        guardado,
        guardadoNoMes,
        prazo: m.prazo,
        porMes: centavos(falta / mesesRestantes),
        mesesRestantes,
        situacao,
      };
    });

    return {
      guardadoNoMes: centavos(lista.reduce((s, m) => s + m.guardadoNoMes, 0)),
      metas: lista,
    };
  }

  criar(dados: NovaMeta) {
    return this.prisma.meta.create({
      data: { nome: dados.nome, valorAlvo: dados.valorAlvo, prazo: new Date(`${dados.prazo.slice(0, 10)}T00:00:00Z`) },
    });
  }

  async guardar(metaId: string, valor: number) {
    await this.existe(metaId);
    return this.prisma.aporte.create({ data: { metaId, valor, data: new Date() } });
  }

  async arquivar(id: string) {
    await this.existe(id);
    await this.prisma.meta.update({ where: { id }, data: { arquivada: true } });
  }

  private async existe(id: string) {
    if (!(await this.prisma.meta.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('meta não encontrada');
    }
  }
}

@Controller('metas')
class MetasController {
  constructor(private readonly metas: MetasService) {}

  @Get()
  listar() {
    return this.metas.listar();
  }

  @Post()
  criar(@Body() dados: NovaMeta) {
    return this.metas.criar(dados);
  }

  @Post(':id/aportes')
  guardar(@Param('id') id: string, @Body() dados: NovoAporte) {
    return this.metas.guardar(id, dados.valor);
  }

  @Patch(':id/arquivar')
  arquivar(@Param('id') id: string) {
    return this.metas.arquivar(id);
  }
}

@Module({
  controllers: [MetasController],
  providers: [MetasService],
})
export class MetasModule {}
