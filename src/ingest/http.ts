// As APIs oficiais são lentas e falham com frequência: timeout + retentativas com backoff.
// `esperasMs` é a pausa antes de cada nova tentativa (o número de tentativas é esse tamanho + 1). O padrão, curto,
// serve às chamadas de API, que são muitas; downloads grandes passam esperas de minutos (ESPERAS_DOWNLOAD).
export async function fetchComRetry(
  url: string,
  {
    esperasMs = [2_000, 4_000, 8_000],
    timeoutMs = 60_000,
    accept = "application/json",
    headers = {} as Record<string, string>,
  } = {},
): Promise<Response> {
  let ultimoErro: unknown;
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: accept, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      // 4xx (exceto 429) não melhora tentando de novo.
      if (res.status < 500 && res.status !== 429) throw new ErroHttp(url, res.status, false);
      ultimoErro = new ErroHttp(url, res.status, true);
    } catch (e) {
      if (e instanceof ErroHttp && !e.retentavel) throw e;
      ultimoErro = e;
    }
    if (i >= esperasMs.length) throw ultimoErro;
    // Fica no log mesmo quando a tentativa seguinte passa: mostra quando a fonte anda instável.
    console.warn(
      `↻ ${url}: ${descreverErro(ultimoErro)}; nova tentativa (${i + 2}/${esperasMs.length + 1}) em ${esperasMs[i] / 1000}s`,
    );
    await new Promise((r) => setTimeout(r, esperasMs[i]));
  }
}

/**
 * Quedas das fontes costumam durar minutos (servidor da Câmara sem aceitar conexão, 503 do Senado). Para arquivos
 * grandes, baixados uma vez por tarefa, vale esperar até ~7 min no total antes de desistir.
 */
export const ESPERAS_DOWNLOAD = [30_000, 120_000, 300_000];

export async function getJson<T>(url: string, opts?: Parameters<typeof fetchComRetry>[1]): Promise<T> {
  return (await fetchComRetry(url, opts)).json() as Promise<T>;
}

/** Mensagem do erro com as causas encadeadas: "fetch failed" sozinho não diz que foi timeout de conexão. */
export function descreverErro(e: unknown): string {
  const partes: string[] = [];
  for (let atual = e, n = 0; atual != null && n < 5; n++) {
    if (atual instanceof Error) {
      const codigo = (atual as { code?: unknown }).code;
      partes.push(`${atual.name}: ${atual.message}${typeof codigo === "string" ? ` [${codigo}]` : ""}`);
      atual = atual.cause;
    } else {
      partes.push(String(atual));
      break;
    }
  }
  return partes.join(" ← causa: ");
}

export class ErroHttp extends Error {
  constructor(
    public url: string,
    public status: number,
    public retentavel: boolean,
  ) {
    super(`HTTP ${status} em ${url}`);
  }
}
