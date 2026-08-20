import { Layout } from "@/components/Layout";
import { chatbots, categoryLabels, contentLevelLabels, type Chatbot } from "@/data/chatbots";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";

const Compare = () => {
  const [params] = useSearchParams();
  const selectedSlugs = (params.get("platforms") || "").split(",").filter(Boolean).slice(0, 5);
  const selected = chatbots.filter((bot) => selectedSlugs.includes(bot.slug));

  const rows: { label: string; value: (bot: Chatbot) => string }[] = [
    { label: "Hosting type", value: (bot) => `${categoryLabels[bot.category]} · ${bot.type}` },
    { label: "Content level", value: (bot) => `${contentLevelLabels[bot.contentLevel]} (level ${bot.contentLevel}/5)` },
    { label: "Context length limits", value: (bot) => bot.contextWindow || "Not disclosed" },
    { label: "Memory / lorebook", value: (bot) => bot.memory || "Not disclosed" },
    { label: "Supported APIs", value: (bot) => bot.apiAccess === "open" ? "Open / BYOK" : bot.apiAccess === "subscription" ? "Subscription / platform API" : "No public API" },
    { label: "Card import / export", value: (bot) => bot.cardFormat || "Platform native" },
    { label: "Pricing model", value: (bot) => bot.pricing || "Not disclosed" },
    { label: "Privacy / logging policy", value: (bot) => bot.category === "local" ? "Local-first; verify backend logging" : bot.category === "providers" ? "Provider-dependent; review provider policy" : "Hosted; review platform policy" },
    { label: "Image generation", value: (bot) => bot.hasImageGen ? "Supported" : "Not listed" },
    { label: "Voice / TTS", value: (bot) => bot.hasVoice ? "Supported" : "Not listed" },
    { label: "Last verified", value: (bot) => bot.lastVerified },
  ];

  return (
    <Layout>
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ArrowLeft className="h-4 w-4" /> Directory</Link>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-5xl glow-text">Compare Platforms</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">A side-by-side matrix for hosting, context, memory, APIs, card compatibility, pricing, and privacy signals.</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {selected.length < 2 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="font-display text-xl font-semibold text-foreground">Select two to five platforms first</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use the Add to Compare button on directory cards, then open the comparison tray.</p>
            <Link to="/" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Browse directory</Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="sticky left-0 z-10 w-48 bg-secondary/80 px-4 py-4 text-left text-xs uppercase tracking-wide text-muted-foreground">Attribute</th>
                  {selected.map((bot) => <th key={bot.slug} className="px-4 py-4 text-left font-display text-base text-foreground">{bot.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/70 last:border-0">
                    <th className="sticky left-0 z-10 bg-background px-4 py-3 text-left text-xs font-medium text-muted-foreground">{row.label}</th>
                    {selected.map((bot) => (
                      <td key={bot.slug} className="px-4 py-3 align-top text-xs leading-relaxed text-foreground/90">
                        {row.value(bot)}
                        {(row.label === "Image generation" || row.label === "Voice / TTS") && (row.value(bot) === "Supported" ? <Check className="ml-1 inline h-3.5 w-3.5 text-green-400" /> : <X className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Layout>
  );
};

export default Compare;
