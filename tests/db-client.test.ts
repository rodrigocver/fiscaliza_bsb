import { describe, expect, it, vi } from "vitest";

vi.stubEnv("DATABASE_URL", "postgres://x:y@localhost:5432/teste");
const { enderecoParaServerless } = await import("@/db/client");

const sessao = "postgresql://postgres.abc:Senha123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

describe("enderecoParaServerless", () => {
  it("na Vercel, troca o Session pooler do Supabase (5432) pelo Transaction pooler (6543)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(enderecoParaServerless(sessao, true)).toBe(
      "postgresql://postgres.abc:Senha123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    );
  });

  it("fora da Vercel (GitHub Actions, computador) e em outros endereços, não mexe", () => {
    expect(enderecoParaServerless(sessao, false)).toBe(sessao);
    expect(enderecoParaServerless("postgres://f:f@localhost:5432/fiscaliza", true)).toBe(
      "postgres://f:f@localhost:5432/fiscaliza",
    );
  });
});
