import jsQR from 'jsqr'

// Acha códigos de pagamento num arquivo, tudo no próprio aparelho:
//  - imagem (print do QR): lê o QR code;
//  - PDF do boleto: procura a linha digitável / Pix no texto e o QR nas páginas.
// O servidor confere cada código depois (dígitos e CRC).

const PIX = /000201[\s\S]*?6304[0-9A-Fa-f]{4}/g
// linha digitável com ou sem pontos e espaços
const BOLETO = /\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14}/g
const CONCESSIONARIA = /8\d{10}[-\s]?\d\s*\d{11}[-\s]?\d\s*\d{11}[-\s]?\d\s*\d{11}[-\s]?\d/g

export function codigosNoTexto(texto: string) {
  const achados = new Set<string>()
  for (const m of texto.match(PIX) ?? []) achados.add(m.replace(/\n/g, ''))
  for (const m of texto.match(BOLETO) ?? []) achados.add(m.replace(/\D/g, ''))
  for (const m of texto.match(CONCESSIONARIA) ?? []) achados.add(m.replace(/\D/g, ''))
  return [...achados]
}

export async function codigosNoArquivo(arquivo: File): Promise<string[]> {
  if (arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf')) return codigosNoPdf(arquivo)
  if (arquivo.type.startsWith('image/')) {
    const imagem = await createImageBitmap(arquivo)
    const qr = lerQr(imagem, imagem.width, imagem.height)
    return qr ? [qr] : []
  }
  throw new Error('Envie um PDF ou uma imagem (print do QR code).')
}

function lerQr(fonte: CanvasImageSource, largura: number, altura: number) {
  // QR pequeno num print grande: reduz para no máximo 1600px, que o jsQR lê bem
  const escala = Math.min(1, 1600 / Math.max(largura, altura))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(largura * escala)
  canvas.height = Math.round(altura * escala)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(data, width, height)?.data ?? null
}

async function codigosNoPdf(arquivo: File) {
  // o leitor de PDF é grande: só carrega quando alguém manda um PDF
  const pdfjs = await import('pdfjs-dist')
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker

  const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
  const achados = new Set<string>()

  for (let n = 1; n <= Math.min(pdf.numPages, 5); n++) {
    const pagina = await pdf.getPage(n)
    const conteudo = await pagina.getTextContent()
    const texto = conteudo.items.map((i) => ('str' in i ? i.str : '')).join(' ')
    // o Pix costuma vir quebrado em várias linhas: tenta também com tudo junto
    for (const c of [...codigosNoTexto(texto), ...codigosNoTexto(texto.replace(/\s+/g, ''))]) achados.add(c)

    if (achados.size === 0) {
      // sem texto: desenha a página e procura um QR code
      const vista = pagina.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = vista.width
      canvas.height = vista.height
      await pagina.render({ canvas, viewport: vista }).promise
      const qr = lerQr(canvas, canvas.width, canvas.height)
      if (qr) achados.add(qr)
    }
  }
  return [...achados]
}
