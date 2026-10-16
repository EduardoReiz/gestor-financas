const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const brl = (valor: number) => moeda.format(valor)

// "+ R$ 5.200,00" / "− R$ 3.947,85" (o sinal fica separado, como nas telas)
export const brlComSinal = (valor: number, sentido: 'ENTRADA' | 'SAIDA') =>
  `${sentido === 'ENTRADA' ? '+' : '−'} ${brl(Math.abs(valor))}`

// Datas "só dia" chegam como meia-noite UTC; sem timeZone UTC o Brasil
// mostraria o dia anterior.
export const diaMes = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

export const nomeDoMes = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number)
  const nome = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`
}

export const mesCurto = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')

export const diasAte = (iso: string) => {
  const hoje = new Date()
  const alvo = new Date(iso)
  const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((alvo.getTime() - inicioHoje) / 86_400_000)
}

export const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Bancos mandam tudo em maiúsculas ("SUPERMERCADO BRETAS"). Só para mostrar:
// o texto original continua salvo e é ele que as regras de categoria usam.
const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em'])
export const legivel = (texto: string) =>
  texto === texto.toUpperCase()
    ? texto
        .toLowerCase()
        .split(' ')
        .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join(' ')
    : texto

// O que a pessoa digita ("1.234,56", "99,90", "1234.56") vira número.
export const paraNumero = (texto: string) =>
  Number(
    texto
      .replace(/\s|R\$/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '') // ponto de milhar
      .replace(',', '.'),
  )

// O "lugar" de uma compra, sem o ruído que cada banco põe na descrição:
//   "CARTAO DEBITO|ELDORADO SABORES - BR"            -> "ELDORADO SABORES"
//   "PAGAMENTO PIX|71400502101 JOYCE MACHADO OLIVEI" -> "JOYCE MACHADO OLIVEI"
//   "AUTO POSTO AMERICA LTD"                          -> "AUTO POSTO AMERICA"
export const lugarDaCompra = (descricao: string) =>
  descricao
    .toUpperCase()
    .replace(/^[A-Z ]+\|\s*/, '') // "CARTAO DEBITO|", "PAGAMENTO PIX|"
    .replace(/^PIX (QR CODE \w+|ENVIADO) - DES\s+/, '')
    .replace(/^\d{6,}\s+/, '') // CPF/CNPJ na frente
    .replace(/\s+-\s+(DOCTO|BR)\b.*$/, '')
    .replace(/\s+\d{2}\/\d{2}.*$/, '') // data no fim
    .replace(/\b(LTDA?|S\/?A|ME|EIRELI)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
