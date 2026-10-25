import { Injectable, Logger } from '@nestjs/common';

// Só os campos que o app usa. Formatos conferidos na API real (out/2026).
export interface PluggyItem {
  id: string;
  status: string; // UPDATED, UPDATING, LOGIN_ERROR, OUTDATED...
  lastUpdatedAt: string | null;
  connector: { id: number; name: string };
}

export interface PluggyConta {
  id: string;
  type: 'BANK' | 'CREDIT';
  subtype: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD';
  name: string;
  marketingName: string | null;
  number: string | null;
  balance: number;
  creditData: {
    creditLimit: number | null;
    availableCreditLimit: number | null;
    balanceCloseDate: string | null; // AAAA-MM-DD
    balanceDueDate: string | null;
  } | null;
}

export interface PluggyLancamento {
  id: string;
  date: string;
  description: string;
  // O sinal do amount NÃO é confiável: no cartão real a compra vem positiva
  // (no sandbox, negativa). O type é: DEBIT = saiu dinheiro, CREDIT = entrou.
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  categoryId: string | null;
  status: 'POSTED' | 'PENDING';
  creditCardMetadata: {
    installmentNumber?: number;
    totalInstallments?: number;
    billId?: string;
    cardNumber?: string;
    payeeMCC?: number;
  } | null;
}

export interface PluggyFatura {
  id: string;
  dueDate: string;
  totalAmount: number;
}

export interface PluggyInvestimento {
  id: string;
  name: string;
  type: string;
  balance: number;
  dueDate: string | null;
}

const BASE = 'https://api.pluggy.ai';

@Injectable()
export class PluggyClient {
  private readonly log = new Logger('Pluggy');
  private chave?: { valor: string; validaAte: number };

  get configurado() {
    return !!process.env.PLUGGY_CLIENT_ID && !!process.env.PLUGGY_CLIENT_SECRET;
  }

  item(id: string) {
    return this.pedir<PluggyItem>(`/items/${id}`);
  }

  // Pede ao Pluggy para buscar dados novos no banco agora (PATCH /items/{id}).
  // O Pluggy limita a 1 atualização por hora por banco e recusa quando o banco
  // pede senha ou código de novo; a recusa chega aqui como erro com o motivo.
  atualizarItem(id: string) {
    return this.pedir<PluggyItem>(`/items/${id}`, 1, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' });
  }

  async contas(itemId: string) {
    return (await this.pedir<{ results: PluggyConta[] }>(`/accounts?itemId=${itemId}`)).results;
  }

  async faturas(contaId: string) {
    return (await this.pedir<{ results: PluggyFatura[] }>(`/bills?accountId=${contaId}`)).results;
  }

  async investimentos(itemId: string) {
    return (await this.pedir<{ results: PluggyInvestimento[] }>(`/investments?itemId=${itemId}`)).results;
  }

  // O /transactions antigo responde 410. O /v2 pagina por cursor: cada resposta
  // traz "next" (nulo na última página). Relatos divergem sobre o formato do
  // "next" (URL inteira, query pronta ou só o cursor), então aceita os três.
  async lancamentos(contaId: string) {
    const todos: PluggyLancamento[] = [];
    let caminho: string | null = `/v2/transactions?accountId=${contaId}`;

    for (let pagina = 0; caminho && pagina < 200; pagina++) {
      const resposta: { results: PluggyLancamento[]; next: string | null } = await this.pedir(caminho);
      todos.push(...resposta.results);
      caminho = proximaPagina(contaId, resposta.next);
    }
    return todos;
  }

  private async pedir<T>(caminho: string, tentativa = 1, opcoes: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<T> {
    const url = caminho.startsWith('http') ? caminho : `${BASE}${caminho}`;
    const resposta = await fetch(url, { ...opcoes, headers: { ...opcoes.headers, 'X-API-KEY': await this.apiKey() } });

    if (resposta.status === 401 && tentativa === 1) {
      this.chave = undefined; // chave venceu antes do esperado: pede outra
      return this.pedir(caminho, 2, opcoes);
    }
    // 429 em atualização (PATCH) é o limite de 1 por hora: não adianta tentar de novo
    if (resposta.status === 429 && tentativa <= 3 && !opcoes.method) {
      await new Promise((r) => setTimeout(r, 2000 * tentativa));
      return this.pedir(caminho, tentativa + 1, opcoes);
    }
    if (!resposta.ok) {
      const corpo = await resposta.text();
      throw new Error(`Pluggy ${resposta.status} em ${caminho.split('?')[0]}: ${corpo.slice(0, 200)}`);
    }
    return resposta.json() as Promise<T>;
  }

  // A API key do Pluggy dura 2 horas; renova com folga.
  private async apiKey() {
    if (this.chave && this.chave.validaAte > Date.now()) return this.chave.valor;

    const resposta = await fetch(`${BASE}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET,
      }),
    });
    if (!resposta.ok) throw new Error(`Pluggy recusou as chaves (${resposta.status}). Confira o .env.`);

    const { apiKey } = (await resposta.json()) as { apiKey: string };
    this.chave = { valor: apiKey, validaAte: Date.now() + 100 * 60_000 };
    this.log.log('nova API key obtida');
    return apiKey;
  }
}

function proximaPagina(contaId: string, next: string | null): string | null {
  if (!next) return null;
  if (next.startsWith('http')) return next;
  if (next.startsWith('/')) return next;
  if (next.startsWith('?')) return `/v2/transactions${next}`;
  if (next.includes('=')) return `/v2/transactions?${next}`;
  return `/v2/transactions?accountId=${contaId}&after=${next}`;
}
