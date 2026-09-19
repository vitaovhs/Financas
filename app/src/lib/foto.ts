// Preparação de fotos no aparelho (Decisão 26): JPEG, lado maior até 2.048 px, qualidade 0,80,
// miniatura de 400 px, orientação corrigida e metadados (inclusive GPS) removidos ao redesenhar.
import type { FotoPreparada } from '../data/types'

export const FOTO = {
  ladoMaximo: 2048,
  qualidade: 0.8,
  teto: 1024 * 1024,        // acima disso: qualidade 0,70 e, se precisar, 1.600 px
  qualidadeTeto: 0.7,
  ladoTeto: 1600,
  miniatura: 400,
  qualidadeMiniatura: 0.72,
  originalMaximo: 20 * 1024 * 1024,
}

async function decodificar(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    // Safari antigo ou formato sem suporte no createImageBitmap
    const url = URL.createObjectURL(arquivo)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return img
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}

function desenhar(fonte: ImageBitmap | HTMLImageElement, lado: number, qualidade: number): Promise<{ blob: Blob; w: number; h: number }> {
  const w0 = 'naturalWidth' in fonte ? fonte.naturalWidth : fonte.width
  const h0 = 'naturalHeight' in fonte ? fonte.naturalHeight : fonte.height
  const escala = Math.min(1, lado / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * escala))
  const h = Math.max(1, Math.round(h0 * escala))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, w, h)
  return new Promise((ok, falha) => canvas.toBlob(b => b ? ok({ blob: b, w, h }) : falha(new Error('Não foi possível processar a imagem')), 'image/jpeg', qualidade))
}

export async function prepararFoto(arquivo: File): Promise<FotoPreparada> {
  if (arquivo.size > FOTO.originalMaximo) throw new Error('A imagem é grande demais (máximo de 20 MB).')
  if (arquivo.type && !arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  let fonte: ImageBitmap | HTMLImageElement
  try {
    fonte = await decodificar(arquivo)
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Tente outra foto.')
  }
  let r = await desenhar(fonte, FOTO.ladoMaximo, FOTO.qualidade)
  if (r.blob.size > FOTO.teto) {
    r = await desenhar(fonte, FOTO.ladoMaximo, FOTO.qualidadeTeto)
    if (r.blob.size > FOTO.teto) r = await desenhar(fonte, FOTO.ladoTeto, FOTO.qualidadeTeto)
  }
  const t = await desenhar(fonte, FOTO.miniatura, FOTO.qualidadeMiniatura)
  if ('close' in fonte) fonte.close()
  return { full: r.blob, thumb: t.blob, width: r.w, height: r.h }
}
