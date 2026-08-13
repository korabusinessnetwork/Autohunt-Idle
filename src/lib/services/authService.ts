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

/**
 * Entra numa conta que já tem e-mail e senha.
 *
 * Faltava a porta de volta (`specs/mapas-instanciados-combate-e-hud.md`, 7):
 * quem cadastrava e depois abria o jogo em outro navegador caía numa conta
 * anônima nova, sem nenhum caminho para a própria.
 *
 * ATENÇÃO ao que este `signInWithPassword` faz com a sessão em curso: ele a
 * SUBSTITUI. Se a sessão atual era uma conta anônima com progresso, esse
 * progresso continua existindo no banco, mas fica sem ninguém para reivindicá-lo
 * — a conta anônima só era alcançável pela sessão daquele navegador. Por isso a
 * tela avisa ANTES do clique, e não depois (prevenção de erro, CLAUDE.md).
 */
export async function entrar(email: string, senha: string): Promise<Envelope<Sessao>> {
  if (!emailValido(email)) return falha<Sessao>('EMAIL_INVALIDO', 'E-mail inválido.')
  if (!senha) return falha<Sessao>('SENHA_OBRIGATORIA', 'Senha vazia.')

  const supabase = obterSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  })

  if (error || !data.user) {
    // Credencial errada e conta inexistente devolvem a MESMA resposta, de
    // propósito: distinguir as duas conta para qualquer um de fora quais
    // e-mails têm conta neste jogo.
    return falha<Sessao>('LOGIN_INVALIDO', 'E-mail ou senha não conferem.')
  }

  return ok({ userId: data.user.id, temCadastro: Boolean(data.user.email) })
}

export interface DadosCadastro {
  email: string
  senha: string
  dataNascimento: string
}

export interface ResultadoCadastro extends Sessao {
  /** E-mail informado, para a tela dizer PARA ONDE o link foi. */
  email: string
  /**
   * O e-mail ainda não vale: o projeto Supabase está com "Confirm email"
   * ligado e mandou um link. Enquanto o jogador não abrir esse link, a conta
   * continua sem e-mail — e sem farm offline.
   */
  confirmacaoPendente: boolean
}

/**
 * Acrescenta e-mail/senha à conta anônima em curso e grava a data de
 * nascimento no perfil. O progresso não é tocado porque ele nunca esteve fora
 * desta conta.
 *
 * SOBRE A CONFIRMAÇÃO DE E-MAIL (bug de 2026-08-13, "me cadastro e não
 * acontece nada, vai pra uma página que não carrega"):
 *
 * Com "Confirm email" ligado no projeto, `updateUser` NÃO grava o e-mail na
 * hora — ele guarda como pendente e manda um link. A resposta vem sem `error`,
 * então a versão anterior fechava o modal como se tivesse dado certo: daí o
 * "não acontece nada". E o link ia para a Site URL padrão do Supabase
 * (`http://localhost:3000`), que em desenvolvimento não é onde o jogo roda:
 * daí a "página que não carrega".
 *
 * As duas pontas são tratadas aqui: `emailRedirectTo` manda o link de volta
 * para a origem REAL de quem está jogando, e o resultado diz se ficou pendente
 * para a tela poder avisar em vez de fechar calada.
 */
export async function cadastrar(dados: DadosCadastro): Promise<Envelope<ResultadoCadastro>> {
  const email = dados.email.trim()
  if (!emailValido(email)) return falha<ResultadoCadastro>('EMAIL_INVALIDO', 'E-mail inválido.')
  if (dados.senha.length < TAMANHO_MINIMO_SENHA) {
    return falha<ResultadoCadastro>('SENHA_CURTA', 'Senha curta demais.')
  }

  const idade = validarDataNascimento(dados.dataNascimento)
  if (idade !== 'ok') {
    return falha<ResultadoCadastro>(idade, 'Data de nascimento reprovada no gate de idade.')
  }

  const supabase = obterSupabase()
  const { data: sessaoAtual } = await supabase.auth.getSession()
  const usuarioAnonimo = sessaoAtual.session?.user
  if (!usuarioAnonimo) return falha<ResultadoCadastro>('SEM_SESSAO', 'Nenhuma sessão em curso.')

  // A data de nascimento vai PRIMEIRO: se o trigger do banco reprovar a idade,
  // a conta anônima segue anônima e nenhuma credencial foi criada.
  const { error: erroPerfil } = await supabase
    .from('jogador')
    .update({ data_nascimento: dados.dataNascimento })
    .eq('id', usuarioAnonimo.id)

  if (erroPerfil) return deErroSupabase<ResultadoCadastro>(erroPerfil, 'CADASTRO_FALHOU')

  const { data, error } = await supabase.auth.updateUser(
    { email, password: dados.senha },
    // Origem real de quem está jogando — nunca URL fixa no código (CLAUDE.md).
    // Cobre localhost:5173, o preview da Vercel e o domínio de produção sem
    // ninguém precisar lembrar de trocar nada.
    { emailRedirectTo: typeof window === 'undefined' ? undefined : window.location.origin },
  )

  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message ?? '')
    return falha<ResultadoCadastro>(
      jaExiste ? 'EMAIL_EM_USO' : 'CADASTRO_FALHOU',
      error.message ?? '',
    )
  }

  // Se o e-mail já veio gravado no usuário, a confirmação está desligada e o
  // cadastro terminou aqui mesmo. Se não veio, ficou pendente de link.
  const confirmado = (data.user?.email ?? '').toLowerCase() === email.toLowerCase()

  return ok({
    userId: data.user?.id ?? usuarioAnonimo.id,
    temCadastro: confirmado,
    email,
    confirmacaoPendente: !confirmado,
  })
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
