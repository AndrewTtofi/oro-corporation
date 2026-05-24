import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenSanctionsProvider } from "../screening.opensanctions";

const ok = (json: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) } as Response);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("OpenSanctionsProvider", () => {
  it("returns 'clear' when API returns no results above threshold", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() =>
      ok({ responses: { q1: { results: [] } } }),
    );
    const p = new OpenSanctionsProvider({ threshold: 0.7 });
    const r = await p.match({ schema: "Person", name: "Jane Smith" });
    expect(r.outcome).toBe("clear");
    expect(r.hits).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("filters by threshold and returns hits", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      ok({
        responses: {
          q1: {
            results: [
              { id: "NK-100", score: 0.9, caption: "John Doe", schema: "Person", properties: { topics: ["sanction"] }, datasets: ["us_ofac_sdn"] },
              { id: "NK-101", score: 0.5, caption: "Jonny D",  schema: "Person", properties: { topics: ["role.pep"] }, datasets: [] },
            ],
          },
        },
      }),
    );
    const p = new OpenSanctionsProvider({ threshold: 0.7 });
    const r = await p.match({ schema: "Person", name: "John Doe" });
    expect(r.outcome).toBe("hits");
    expect(r.hits.map((h) => h.externalId)).toEqual(["NK-100"]);
    expect(r.hits[0].matchedTopics).toEqual(["sanction"]);
  });

  it("retries on 429 then succeeds", async () => {
    let calls = 0;
    vi.spyOn(global, "fetch").mockImplementation(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ok: false, status: 429 } as Response);
      return ok({ responses: { q1: { results: [] } } });
    });
    const p = new OpenSanctionsProvider({ threshold: 0.7, retryDelayMs: 1 });
    const r = await p.match({ schema: "Person", name: "Anyone" });
    expect(r.outcome).toBe("clear");
    expect(calls).toBe(2);
  });

  it("returns 'error' after exhausting retries", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500 } as Response);
    const p = new OpenSanctionsProvider({ threshold: 0.7, retryDelayMs: 1 });
    const r = await p.match({ schema: "Person", name: "X" });
    expect(r.outcome).toBe("error");
    expect(r.errorMessage).toMatch(/500/);
  });

  it("sends API key header when configured", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() =>
      ok({ responses: { q1: { results: [] } } }),
    );
    const p = new OpenSanctionsProvider({ threshold: 0.7, apiKey: "secret123" });
    await p.match({ schema: "Person", name: "X" });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("ApiKey secret123");
  });
});
