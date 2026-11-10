// Nep-Claude voor tests en de lokale ontwikkelserver (DEV_AI_STUB=1): geeft een vaste uitleg terug en onthoudt de verzoeken.
const NL = {
  summary: "Dit is een testuitleg. Je maakte deze periode een klein verlies, maar de verdeling van je trades laat zien waar de winst weglekte.",
  strengths: [{ title: "Rustige trades werken", detail: "Als je rustig was, was je gemiddelde resultaat positief. Dat is een patroon om te herhalen." }],
  leaks: [{ title: "Verliezen groeien", detail: "Je gemiddelde verlies was groter dan je gemiddelde winst, waardoor je een hogere winrate nodig hebt om quitte te spelen." }],
  patterns: [{ title: "Emotie en resultaat", detail: "Trades na frustratie leverden gemiddeld verlies op." }],
  plan: [
    { action: "Pauzeer 15 minuten na elk verlies.", why: "Zo breek je de reeks na frustratie." },
    { action: "Log bij elke trade je emotie.", why: "Zonder emotie zie je het patroon niet." },
    { action: "Houd je positiegrootte binnen één contract verschil.", why: "Consistente grootte maakt je cijfers vergelijkbaar." },
  ],
  caution: "Het is een kleine steekproef, dus zie dit als een eerste indruk.",
};
const EN = {
  summary: "This is a test explanation. You made a small loss this period, but the spread of your trades shows where the profit leaked.",
  strengths: [{ title: "Calm trades work", detail: "When you were calm, your average result was positive. That is a pattern to repeat." }],
  leaks: [{ title: "Losses grow", detail: "Your average loss was bigger than your average win, so you need a higher win rate to break even." }],
  patterns: [{ title: "Emotion and result", detail: "Trades after frustration lost money on average." }],
  plan: [
    { action: "Pause 15 minutes after every loss.", why: "That breaks the run after frustration." },
    { action: "Log your emotion on every trade.", why: "Without emotion you cannot see the pattern." },
    { action: "Keep your size within one contract of difference.", why: "Consistent size makes your figures comparable." },
  ],
  caution: "This is a small sample, so treat it as a first impression.",
};

export function createAiStub() {
  const calls = [];
  let next = null;
  const client = {
    beta: {
      messages: {
        async create(req) {
          calls.push(req);
          if (next) {
            const n = next;
            next = null;
            if (n.throw) throw n.throw;
            return n.response;
          }
          const english = /Language: English/.test(req.messages[0].content);
          return { stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(english ? EN : NL) }] };
        },
      },
    },
  };
  return { client, calls, queue: (n) => (next = n) };
}
