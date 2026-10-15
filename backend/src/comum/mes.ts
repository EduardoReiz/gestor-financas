import { BadRequestException } from '@nestjs/common';

export interface IntervaloMes {
  inicio: Date;
  fim: Date; // exclusivo: primeiro instante do mês seguinte
}

// "2026-10" -> [01/10/2026, 01/11/2026). Sem parâmetro, usa o mês atual.
export function intervaloDoMes(mes?: string): IntervaloMes {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let indice = hoje.getMonth();

  if (mes) {
    const achado = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes);
    if (!achado) throw new BadRequestException('mes deve ser AAAA-MM');
    ano = Number(achado[1]);
    indice = Number(achado[2]) - 1;
  }

  return { inicio: new Date(ano, indice, 1), fim: new Date(ano, indice + 1, 1) };
}

export function mesesAntes(intervalo: IntervaloMes, quantos: number): Date {
  const d = new Date(intervalo.inicio);
  d.setMonth(d.getMonth() - quantos);
  return d;
}
