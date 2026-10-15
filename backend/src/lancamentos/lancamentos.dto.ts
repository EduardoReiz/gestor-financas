import { Sentido } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class FiltroLancamentos {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) mes?: string;
  @IsOptional() @IsString() contaId?: string;
  @IsOptional() @IsString() categoriaId?: string; // "nenhuma" = sem categoria
  @IsOptional() @IsEnum(Sentido) sentido?: Sentido;
  @IsOptional() @IsString() @MaxLength(80) busca?: string;
}

export class TrocarCategoria {
  @IsString() categoriaId!: string;
  @IsOptional() @IsString() @MaxLength(80) apelido?: string;
  @IsOptional() @IsBoolean() aplicarAosProximos?: boolean;
  @IsOptional() @IsString() @MaxLength(60) contem?: string;
}
