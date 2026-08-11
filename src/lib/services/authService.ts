// Camada de serviço — autenticação, conta anônima e cadastro com gate de idade.
//
// Dois pontos de produto vivem aqui:
//   · core, 17 — a conta anônima é criada no primeiro segundo de jogo, então
//     nunca existe progresso fora do sistema seguro, nem antes do cadastro.
//   · core, 18 — cadastrar ADICIONA credenciais à conta anônima existente
//     (`updateUser`). Não há migração, não há reimportação, não nasce um
//     segundo usuário: o `user.id` é o mesmo antes e depois.
//
// O gate de 18+ é validado aqui E no banco (trigger `validar_idade_minima`).
// A checagem do formulário existe para dar mensagem boa; a que vale é a do
// banco (memory/restrictions.md, CRÍTICA).

import { validarDataNascimento } from '../../features/cadastro/idade'
import { deErroSupabase, falha, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'

export interface Sessao {
  userId: string
  temCadastro: boolean
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export const TAMANHO_MINIMO_SENHA = 8

/**
 * Garante uma sessão. Se já existe (anônima ou cadastrada), reaproveita; se
 * não, cria uma conta anônima real e silenciosa — sem tela, sem clique.
 */
export async function garantirSessao(): Promise<Envelope<Sessao>> {
  const supabase = obterSupabase()

  const { data: existente } = await supabase.auth.getSession()
  if (existente.session?.user) {
    const usuario = existente.session.user
    return ok({ userId: usuario.id, temCadastro: Boolean(usuario.email) })
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) {
    return deErroSupabase<Sessao>(error, 'SESSAO_ANONIMA_FALHOU')
  }
  return ok({ userId: data.user.id, temCadastro: false })
}

export interface DadosCadastro {
  email: string
  senha: string
  dataNascimento: string
}

/**
 * Acrescenta e-mail/senha à conta anônima em curso e grava a data de
 * nascimento no perfil. O progresso não é tocado porque ele nunca esteve fora
 * desta conta.
 */
export async function cadastrar(dados: DadosCadastro): Promise<Envelope<Sessao>> {
  if (!emailValido(dados.email)) return falha<Sessao>('EMAIL_INVALIDO', 'E-mail inválido.')
  if (dados.senha.length < TAMANHO_MINIMO_SENHA) {
    return falha<Sessao>('SENHA_CURTA', 'Senha curta demais.')
  }

  const idade = validarDataNascimento(dados.dataNascimento)
  if (idade !== 'ok') return falha<Sessao>(idade, 'Data de nascimento reprovada no gate de idade.')

  const supabase = obterSupabase()
  const { data: sessaoAtual } = await supabase.auth.getSession()
  const usuarioAnonimo = sessaoAtual.session?.user
  if (!usuarioAnonimo) return falha<Sessao>('SEM_SESSAO', 'Nenhuma sessão em curso.')

  // A data de nascimento vai PRIMEIRO: se o trigger do banco reprovar a idade,
  // a conta anônima segue anônima e nenhuma credencial foi criada.
  const { error: erroPerfil } = await supabase
    .from('jogador')
    .update({ data_nascimento: dados.dataNascimento })
    .eq('id', usuarioAnonimo.id)

  if (erroPerfil) return deErroSupabase<Sessao>(erroPerfil, 'CADASTRO_FALHOU')

  const { data, error } = await supabase.auth.updateUser({
    email: dados.email.trim(),
    password: dados.senha,
  })

  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message ?? '')
    return falha<Sessao>(jaExiste ? 'EMAIL_EM_USO' : 'CADASTRO_FALHOU', error.message ?? '')
  }

  return ok({ userId: data.user?.id ?? usuarioAnonimo.id, temCadastro: true })
}

/**
 * Grava o idioma escolhido no perfil.
 *
 * Fire-and-forget: preferência de idioma não pode bloquear nem derrubar o
 * jogo se a rede falhar — o `localStorage` já segurou a escolha localmente.
 */
export async function registrarIdioma(idioma: 'pt' | 'en'): Promise<Envelope<null>> {
  const supabase = obterSupabase()
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) return falha<null>('SEM_SESSAO', 'Nenhuma sessão em curso.')

  const { error } = await supabase.from('jogador').update({ idioma }).eq('id', userId)
  if (error) return deErroSupabase<null>(error, 'IDIOMA_NAO_SALVO')
  return ok(null)
}

export async function sair(): Promise<Envelope<null>> {
  const { error } = await obterSupabase().auth.signOut()
  if (error) return deErroSupabase<null>(error, 'LOGOUT_FALHOU')
  return ok(null)
}
