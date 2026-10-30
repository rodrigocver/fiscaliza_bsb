import { createHash } from "node:crypto";
import { parse } from "csv-parse";
import { unzipSync } from "fflate";
import { ESPERAS_DOWNLOAD, fetchComRetry } from "./http";

/** Divide em lotes para não estourar o limite de parâmetros do Postgres. */
export function* lotes<T>(itens: T[], tamanho = 1000): Generator<T[]> {
  for (let i = 0; i < itens.length; i += tamanho) yield itens.slice(i, i + tamanho);
}

export function hash(...partes: unknown[]): string {
  return createHash("sha1")
    .update(partes.map((p) => String(p ?? "")).join("|"))
    .digest("hex");
}

/** Anos de `desde` até o ano corrente. */
export function anosDesde(desde: number, ate = new Date().getFullYear()): number[] {
  return Array.from({ length: ate - desde + 1 }, (_, i) => desde + i);
}

/**
 * Baixa um arquivo grande inteiro. Transferências às vezes terminam no meio sem erro,
 * então conferimos o tamanho com o Content-Length e tentamos de novo se faltar algo. Se a fonte não responde,
 * esperamos minutos entre as tentativas (ESPERAS_DOWNLOAD), pois as quedas costumam passar nesse prazo.
 */
export async function baixarArquivo(
  url: string,
  { tentativas = 4, esperasMs = ESPERAS_DOWNLOAD } = {},
): Promise<Buffer> {
  for (let i = 1; ; i++) {
    const res = await fetchComRetry(url, { timeoutMs: 900_000, accept: "*/*", esperasMs });
    const esperado = Number(res.headers.get("content-length")) || null;
    try {
      const buf = Buffer.from(await res.arrayBuffer());
      if (esperado == null || buf.length === esperado) return buf;
      if (i >= tentativas) throw new Error(`Download incompleto de ${url}: ${buf.length} de ${esperado} bytes`);
    } catch (e) {
      if (i >= tentativas) throw e;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
}

/**
 * A Câmara regenera os arquivos de madrugada; quem baixa durante a escrita recebe um JSON cortado.
 * Nesse caso esperamos e baixamos de novo.
 */
export async function baixarJson<T>(url: string, tentativas = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return JSON.parse((await baixarArquivo(url)).toString("utf8")) as T;
    } catch (e) {
      if (!(e instanceof SyntaxError) || i >= tentativas) throw new Error(`JSON inválido em ${url}: ${e}`);
      await new Promise((r) => setTimeout(r, 60_000 * i));
    }
  }
}

/** Baixa um CSV (opcionalmente dentro de um .zip) separado por ";" e devolve as linhas como objetos. */
export async function baixarCsv(url: string, { zip = false } = {}): Promise<Record<string, string>[]> {
  let buf = await baixarArquivo(url);
  if (zip) {
    const arquivos = unzipSync(buf);
    const nome = Object.keys(arquivos).find((n) => n.endsWith(".csv"));
    if (!nome) throw new Error(`Nenhum CSV dentro de ${url}`);
    buf = Buffer.from(arquivos[nome]);
  }
  const linhas: Record<string, string>[] = [];
  const parser = parse(buf, { delimiter: ";", columns: true, bom: true, relax_quotes: true, relax_column_count: true });
  for await (const linha of parser) linhas.push(linha);
  return linhas;
}

/**
 * Lê os argumentos do `npm run ingest`: nomes de tarefas e `--desde ANO` opcional.
 * Sem `--desde`, só o ano corrente.
 */
export function lerArgumentosIngestao(args: string[], anoAtual = new Date().getFullYear()) {
  const tarefas: string[] = [];
  let desde = anoAtual;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--desde") {
      desde = Number(args[++i]);
      if (!Number.isInteger(desde) || desde < 2000 || desde > anoAtual)
        throw new Error(`--desde inválido: ${args[i]} (use um ano entre 2000 e ${anoAtual})`);
    } else if (args[i].startsWith("--")) {
      throw new Error(`Opção desconhecida: ${args[i]}`);
    } else {
      tarefas.push(args[i]);
    }
  }
  return { tarefas, anos: anosDesde(desde, anoAtual) };
}
