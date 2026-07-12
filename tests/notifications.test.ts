import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeTelegramUsername, sendTelegramMessage } from "@/lib/services/notifications";

const ORIGINAL_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = ORIGINAL_TOKEN;
});

describe("normalizeTelegramUsername", () => {
  it("strips a leading @, trims whitespace, and lowercases", () => {
    expect(normalizeTelegramUsername("  @SomeTrader  ")).toBe("sometrader");
  });
});

describe("sendTelegramMessage", () => {
  it("fails without hitting the network when TELEGRAM_BOT_TOKEN is unset", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendTelegramMessage("123", "merhaba");

    expect(result).toEqual({ ok: false, error: "TELEGRAM_BOT_TOKEN tanımlı değil" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the bot's sendMessage endpoint with the chat id and HTML body", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendTelegramMessage("456", "<b>fırsat</b>");

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toMatchObject({ chat_id: "456", text: "<b>fırsat</b>", parse_mode: "HTML" });
  });

  it("surfaces Telegram's own error description when the API rejects the message", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 }),
      ),
    );

    const result = await sendTelegramMessage("789", "merhaba");

    expect(result).toEqual({ ok: false, error: "chat not found" });
  });

  it("falls back to an HTTP-status error when the response body isn't valid JSON", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 502 })));

    const result = await sendTelegramMessage("789", "merhaba");

    expect(result).toEqual({ ok: false, error: "Telegram HTTP 502" });
  });
});
