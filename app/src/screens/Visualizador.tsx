import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { repo } from '../data'
import { Icone } from '../components/ui'

/** Foto em tela cheia com zoom (toque duplo / clique / pinça do navegador). */
export function Visualizador({ fonte, aoFechar, aoSubstituir, aoRemover }: {
  fonte: { url: string } | { path: string }
  aoFechar: () => void; aoSubstituir?: () => void; aoRemover?: () => void
}) {
  const path = 'path' in fonte ? fonte.path : null
  const q = useQuery({ queryKey: ['foto', path], queryFn: () => repo.urlFoto(path!), enabled: !!path, staleTime: 8 * 60_000 })
  const url = 'url' in fonte ? fonte.url : q.data
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); aoFechar() } }
    document.addEventListener('keydown', k, true)
    return () => document.removeEventListener('keydown', k, true)
  }, [aoFechar])
  return (
    <div className="visualizador" role="dialog" aria-modal="true" aria-label="Foto do comprovante">
      <div className="topo">
        <button type="button" className="btn-icone" aria-label="Fechar" onClick={aoFechar} autoFocus><Icone n="close" /></button>
        <span className="t-corpo-forte" style={{ flex: 1 }}>Comprovante</span>
        <button type="button" className="btn-icone" aria-label={zoom > 1 ? 'Diminuir zoom' : 'Aumentar zoom'} onClick={() => setZoom(z => z > 1 ? 1 : 2.5)}>
          <Icone n={zoom > 1 ? 'zoom_out' : 'zoom_in'} />
        </button>
      </div>
      <div className="palco" onWheel={e => { if (e.ctrlKey || e.metaKey) return; setZoom(z => Math.min(4, Math.max(1, z - e.deltaY * 0.002))) }}>
        {url ? <img src={url} alt="Foto do comprovante" onDoubleClick={() => setZoom(z => z > 1 ? 1 : 2.5)}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center top', cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }} />
          : q.isError ? <span>Não foi possível carregar a foto.</span> : <span className="spinner" />}
      </div>
      {(aoSubstituir || aoRemover) && (
        <div className="base">
          {aoSubstituir && <button type="button" className="btn-v" onClick={aoSubstituir}><Icone n="swap_horiz" s={20} />Substituir</button>}
          {aoRemover && <button type="button" className="btn-v" onClick={aoRemover}><Icone n="delete" s={20} />Remover</button>}
        </div>
      )}
    </div>
  )
}
