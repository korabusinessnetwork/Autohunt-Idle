import { useState, type FormEvent } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { cadastrar } from '../../lib/services/authService'
import { dataMaximaPermitida } from './idade'
import './ModalCadastro.css'

// Cadastro tardio (core, 18): só aparece quando o jogador tenta ativar o farm
// offline — nunca na abertura do jogo, que precisa ir direto pro mundo aberto
// (core, 17 e Princípio nº1).
//
// O que acontece aqui é `updateUser`, não `signUp`: as credenciais são
// ACRESCENTADAS à conta anônima que já existe. Não há migração de progresso
// porque nunca houve progresso fora dessa conta.

// Mapa explícito, não template string: assim o TypeScript confere cada chave
// contra `ChaveI18n`, e um código de erro sem tradução não passa despercebido.
const CHAVE_DO_ERRO: Record<string, ChaveI18n> = {
  IDADE_MINIMA_NAO_ATINGIDA: 'cadastro.erro.IDADE_MINIMA_NAO_ATINGIDA',
  DATA_NASCIMENTO_INVALIDA: 'cadastro.erro.DATA_NASCIMENTO_INVALIDA',
  DATA_NASCIMENTO_IMUTAVEL: 'cadastro.erro.DATA_NASCIMENTO_INVALIDA',
  DATA_NASCIMENTO_OBRIGATORIA: 'cadastro.erro.DATA_NASCIMENTO_OBRIGATORIA',
  EMAIL_INVALIDO: 'cadastro.erro.EMAIL_INVALIDO',
  SENHA_CURTA: 'cadastro.erro.SENHA_CURTA',
  EMAIL_EM_USO: 'cadastro.erro.EMAIL_EM_USO',
  CADASTRO_FALHOU: 'cadastro.erro.CADASTRO_FALHOU',
}

function chaveDoErro(codigo: string): ChaveI18n {
  return CHAVE_DO_ERRO[codigo] ?? 'cadastro.erro.CADASTRO_FALHOU'
}

interface Props {
  aoFechar: () => void
  aoConcluir: () => void
}

export function ModalCadastro({ aoFechar, aoConcluir }: Props) {
  const { t } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<ChaveI18n | null>(null)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (!dataNascimento) {
      setErro(chaveDoErro('DATA_NASCIMENTO_OBRIGATORIA'))
      return
    }

    setEnviando(true)
    try {
      const resposta = await cadastrar({ email, senha, dataNascimento })
      if (resposta.error) {
        setErro(chaveDoErro(resposta.error.codigo))
        return
      }
      aoConcluir()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="cadastro" role="dialog" aria-modal="true" aria-labelledby="cadastro-titulo">
      <form className="cadastro__cartao" onSubmit={(e) => void aoEnviar(e)}>
        <h2 className="cadastro__titulo" id="cadastro-titulo">
          {t('cadastro.titulo')}
        </h2>
        <p className="cadastro__explicacao">{t('cadastro.explicacao')}</p>

        <label className="cadastro__campo">
          <span>{t('cadastro.email')}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="cadastro__campo">
          <span>{t('cadastro.senha')}</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        <label className="cadastro__campo">
          <span>{t('cadastro.dataNascimento')}</span>
          {/*
            `max` já impede escolher uma data que seria recusada: prevenção de
            erro vale mais que mensagem de erro (CLAUDE.md). O bloqueio de
            verdade continua no trigger do banco.
          */}
          <input
            type="date"
            required
            max={dataMaximaPermitida()}
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
          />
        </label>

        <p className="cadastro__aviso">{t('cadastro.avisoIdade')}</p>

        {erro ? (
          <p className="cadastro__erro" role="alert">
            {t(erro)}
          </p>
        ) : null}

        <div className="cadastro__acoes">
          <Botao type="submit" disabled={enviando}>
            {enviando ? t('cadastro.enviando') : t('cadastro.enviar')}
          </Botao>
          <Botao type="button" variante="discreta" onClick={aoFechar} disabled={enviando}>
            {t('cadastro.agoraNao')}
          </Botao>
        </div>
      </form>
    </div>
  )
}
