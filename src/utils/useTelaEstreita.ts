import { useEffect, useState } from 'react'

// "A tela é estreita?" em JavaScript, para as poucas decisões que o CSS não
// consegue tomar sozinho.
//
// Existe por causa da regra de que nenhum menu rola: no celular em pé, a soma
// de slots + fortificação + duas listas não cabe de jeito nenhum na mochila, e
// a saída foi recolher a fortificação num `<details>`. Só que CSS não abre nem
// fecha um `<details>` — o atributo `open` é marcação, não estilo.
//
// "Estreita" aqui quer dizer POUCO ESPAÇO, em qualquer eixo: celular em pé
// (largura curta) e celular deitado (altura curta) sofrem do mesmo problema por
// motivos opostos. A consulta é a mesma que `AbaEquipamento.css` usa para
// compactar — se uma mudar, a outra tem de mudar junto.

export const TELA_ESTREITA = '(max-width: 48rem), (max-height: 34rem)'

export function useTelaEstreita(consulta = TELA_ESTREITA): boolean {
  const [estreita, setEstreita] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(consulta).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(consulta)
    const aoMudar = () => setEstreita(media.matches)
    aoMudar()
    media.addEventListener('change', aoMudar)
    return () => media.removeEventListener('change', aoMudar)
  }, [consulta])

  return estreita
}
