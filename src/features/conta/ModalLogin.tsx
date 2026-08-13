import { useState, type FormEvent } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { entrar } from '../../lib/services/authService'
import './ModalLogin.css'

// O botão de login que faltava (`specs/mapas-instanciados-combate-e-hud.md`, 7).
//
// O jogo nasceu sem ele porque a conta é anônima e criada sozinha no primeiro
// segundo (core, 17): não havia tela de entrada porque não havia entrada a
// fazer. O buraco só aparece do outro lado — quem cadastrou e abriu o jogo em
// outro navegador (ou limpou o site) caía numa conta anônima nova, olhando para
// o nível 1, sem nenhum caminho de volta.
//
// O AVISO VEM ANTES DO CLIQUE. Entrar em outra conta abandona o progresso do
// convidado atual, e isso é irreversível para quem não cadastrou. Prevenção de
// erro > mensagem de erro (CLAUDE.md) — a linha existe justamente para o
// jogador não descobrir depois.

const CHAVE_DO_ERRO: Record<string, ChaveI18n> = {
  EMAIL_INVALIDO: 'cadastro.erro.EMAIL_INVALIDO',
  SENHA_OBRIGATORIA: 'login.erro.SENHA_OBRIGATORIA',
  LOGIN_INVALIDO: 'login.erro.LOGIN_INVALIDO',
}

interface Props {
  aoFechar: () => void
  aoEntrar: () => void
  /** Leva para o cadastro — quem clicou em "entrar" sem ter conta veio parar aqui. */
  aoPedirCadastro: () => void
}

export function ModalLogin({ aoFechar, aoEntrar, aoPedirCadastro }: Props) {
  const { t, snapshot } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<ChaveI18n | null>(null)

  const convidado = !(snapshot?.jogador.identidadeVerificada ?? false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const resposta = await entrar(email, senha)
      if (resposta.error) {
        setErro(CHAVE_DO_ERRO[resposta.error.codigo] ?? 'login.erro.LOGIN_INVALIDO')
        return
      }
      aoEntrar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login" role="dialog" aria-modal="true" aria-labelledby="login-titulo">
      <form className="login__cartao" onSubmit={(e) => void enviar(e)}>
        <h2 className="login__titulo" id="login-titulo">
          {t('login.titulo')}
        </h2>
        <p className="login__explicacao">{t('login.explicacao')}</p>

        <label className="login__campo">
          <span>{t('cadastro.email')}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="login__campo">
          <span>{t('cadastro.senha')}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        {/* Só quem ainda é convidado tem o que perder. Para quem já cadastrou,
            este aviso seria ruído. */}
        {convidado ? <p className="login__aviso">{t('login.avisoConvidado')}</p> : null}

        {erro ? (
          <p className="login__erro" role="alert">
            {t(erro)}
          </p>
        ) : null}

        <div className="login__acoes">
          <Botao type="submit" disabled={enviando}>
            {enviando ? t('login.entrando') : t('login.entrar')}
          </Botao>
          <Botao type="button" variante="discreta" onClick={aoPedirCadastro} disabled={enviando}>
            {t('login.naoTenhoConta')}
          </Botao>
          <Botao type="button" variante="discreta" onClick={aoFechar} disabled={enviando}>
            {t('config.fechar')}
          </Botao>
        </div>
      </form>
    </div>
  )
}
