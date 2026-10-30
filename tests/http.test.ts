import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { descreverErro, ErroHttp, fetchComRetry } from "@/ingest/http";
import { baixarArquivo } from "@/ingest/util";

// Erro que o fetch do Node lança quando o servidor não aceita conexão (visto na Câmara em 29/10/2026).
function falhaDeConexao() {
  const causa = Object.assign(new Error("Connect Timeout Error"), {
    name: "ConnectTimeoutError",
    code: "UND_ERR_CONNECT_TIMEOUT",
  });
  return new TypeError("fetch failed", { cause: causa });
}

describe("fetchComRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("baixarArquivo espera minutos entre tentativas e devolve o arquivo quando a fonte volta", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(falhaDeConexao())
      .mockRejectedValueOnce(falhaDeConexao())
      .mockResolvedValueOnce(new Response("a;b\n1;2\n"));
    vi.stubGlobal("fetch", fetch);

    let resultado: Buffer | undefined;
    void baixarArquivo("https://www.camara.leg.br/cotas/Ano-2026.csv.zip").then((b) => (resultado = b));

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(119_999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(resultado?.toString()).toBe("a;b\n1;2\n");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("UND_ERR_CONNECT_TIMEOUT"));
  });

  it("chamadas de API mantêm as esperas curtas e desistem depois de 4 tentativas", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetch);

    const promessa = fetchComRetry("https://legis.senado.leg.br/dadosabertos/senador/1/comissoes.json");
    const rejeitada = expect(promessa).rejects.toThrow("HTTP 503");
    await vi.advanceTimersByTimeAsync(2_000 + 4_000 + 8_000);
    await rejeitada;
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("não tenta de novo em 404", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchComRetry("https://exemplo.gov.br/x")).rejects.toBeInstanceOf(ErroHttp);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("descreverErro", () => {
  it("inclui as causas encadeadas e o código", () => {
    expect(descreverErro(falhaDeConexao())).toBe(
      "TypeError: fetch failed ← causa: ConnectTimeoutError: Connect Timeout Error [UND_ERR_CONNECT_TIMEOUT]",
    );
  });

  it("aceita valores que não são Error", () => {
    expect(descreverErro("falhou")).toBe("falhou");
  });
});
