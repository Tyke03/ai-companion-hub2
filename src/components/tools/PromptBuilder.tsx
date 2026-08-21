import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Sparkles, Upload, Loader2, Wand2, WifiOff } from "lucide-react";
import { promptTemplates, type PromptTemplate } from "@/data/promptTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAiBackendStatus } from "@/hooks/useAiBackend";

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const PromptBuilder = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate>(promptTemplates[0]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [generatingVar, setGeneratingVar] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [showRawContext, setShowRawContext] = useState(false);
  const [rawContext, setRawContext] = useState("");
  const { toast } = useToast();
  const ai = useAiBackendStatus();
  const aiUnavailable = ai.status === "unavailable";

  const handleSelectTemplate = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setVariables({});
  };

  const getRenderedPrompt = () => {
    let result = selectedTemplate.template;
    for (const v of selectedTemplate.variables) {
      const value = variables[v.name] || v.placeholder;
      result = result.split(`{{${v.name}}}`).join(value);
    }
    return result;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getRenderedPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateVariable = async (varName: string) => {
    const varDef = selectedTemplate.variables.find((v) => v.name === varName);
    if (!supabase) {
      toast({ title: "Unavailable", description: "AI generation is unavailable because Supabase is not configured.", variant: "destructive" });
      return;
    }
    setGeneratingVar(varName);
    try {
      const { data, error } = await supabase.functions.invoke("venice-ai", {
        body: {
          action: "generate-prompt-variable",
          variableName: varName,
          variableDescription: varDef?.description || "",
          templateContext: selectedTemplate.template,
          existingVariables: variables,
          rawContext: rawContext.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.result) {
        setVariables((prev) => ({ ...prev, [varName]: data.result }));
      }
    } catch (err) {
      toast({ title: "Error", description: errMsg(err) || "Failed to generate.", variant: "destructive" });
    } finally {
      setGeneratingVar(null);
    }
  };

  const handleGenerateAll = async () => {
    if (!supabase) {
      toast({ title: "Unavailable", description: "AI generation is unavailable because Supabase is not configured.", variant: "destructive" });
      return;
    }
    setGeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("venice-ai", {
        body: {
          action: "generate-all-prompt-variables",
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          templateDescription: selectedTemplate.description,
          template: selectedTemplate.template,
          variables: selectedTemplate.variables.map((v) => ({
            name: v.name,
            description: v.description,
            placeholder: v.placeholder,
          })),
          existingVariables: variables,
          rawContext: rawContext.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.result && typeof data.result === "object") {
        setVariables((prev) => ({ ...prev, ...data.result }));
        toast({ title: "Generated", description: `Filled ${Object.keys(data.result).length} variables.` });
      }
    } catch (err) {
      toast({ title: "Error", description: errMsg(err) || "Failed to generate all.", variant: "destructive" });
    } finally {
      setGeneratingAll(false);
    }
  };

  const handlePopulateFromCard = () => {
    if (!importText.trim()) {
      toast({ title: "Empty", description: "Paste character card JSON to populate.", variant: "destructive" });
      return;
    }
    try {
      let parsed = JSON.parse(importText);
      if (parsed?.data) parsed = parsed.data;

      // Map character card fields to template variables
      const mapping: Record<string, string[]> = {
        character_name: ["name"],
        character_role: ["personality"],
        setting: ["scenario"],
        personality_traits: ["personality"],
        speaking_style: ["personality"],
        scenario_title: ["scenario"],
        setting_description: ["scenario"],
        context: ["scenario", "description"],
        action_description: ["first_mes"],
        greeting_dialogue: ["first_mes"],
        scene_description: ["scenario"],
        entry_name: ["name"],
        description: ["description"],
      };

      const newVars: Record<string, string> = {};
      for (const v of selectedTemplate.variables) {
        const sources = mapping[v.name];
        if (sources) {
          for (const src of sources) {
            if (parsed[src] && typeof parsed[src] === "string" && parsed[src].trim()) {
              newVars[v.name] = parsed[src].substring(0, 200);
              break;
            }
          }
        }
      }

      if (Object.keys(newVars).length > 0) {
        setVariables((prev) => ({ ...prev, ...newVars }));
        toast({ title: "Populated", description: `Filled ${Object.keys(newVars).length} variables from character card.` });
      } else {
        toast({ title: "No matches", description: "No fields could be mapped to this template's variables.", variant: "destructive" });
      }
      setShowImport(false);
      setImportText("");
    } catch {
      toast({ title: "Invalid JSON", description: "Could not parse the pasted data as JSON.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">
          Prompt Builder
        </h2>
        <p className="text-sm text-muted-foreground">
          Fill in template variables to generate roleplay system prompts, unrestricted prompts, character intros, scenarios, and lorebook entries. Use AI to generate any variable, or populate from a character card.
        </p>
      </div>

      {/* AI backend status banner */}
      {ai.status === "checking" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking AI backend...
        </div>
      )}
      {aiUnavailable && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <WifiOff className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-300">AI backend unavailable</p>
            <p className="text-muted-foreground">
              Manual template filling, populating from a character card, and copying prompts still work. AI generation is disabled until the backend is reachable again.
            </p>
            {ai.reason && <p className="mt-1 text-xs text-muted-foreground/80">{ai.reason}</p>}
          </div>
        </div>
      )}

      {/* Template selector */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Select Template</label>
        <div className="flex flex-wrap gap-2">
          {promptTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedTemplate.id === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{selectedTemplate.description}</p>
      </div>

      {/* Populate from card / Raw context */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
          <Upload className="h-4 w-4" />
          Populate from Card / JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowRawContext(!showRawContext)}>
          <Wand2 className="h-4 w-4" />
          Paste Raw Text as Context
        </Button>
      </div>

      {showImport && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste a character card JSON and matching fields will be auto-mapped to this template's variables.
          </p>
          <Textarea
            placeholder='Paste V2 JSON or character card data...'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="min-h-[100px] bg-secondary border-border font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePopulateFromCard}>
              <Upload className="h-4 w-4" />
              Populate
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowImport(false); setImportText(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showRawContext && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste any raw text (character description, lore, story notes, etc.). This will be sent as additional context when generating variables — AI will extract and distribute relevant info into the right fields.
          </p>
          <Textarea
            placeholder="Paste any text — character bios, world lore, story outlines, wiki entries, chat logs..."
            value={rawContext}
            onChange={(e) => setRawContext(e.target.value)}
            className="min-h-[120px] bg-secondary border-border font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowRawContext(false); setRawContext(""); }}>
              Clear & Close
            </Button>
            {rawContext.trim() && (
              <span className="text-xs text-muted-foreground self-center">
                ✓ Context will be included in all AI generations
              </span>
            )}
          </div>
        </div>
      )}

      {/* Variables */}
      <div className="space-y-3">
      <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Variables</h3>
          <div className="flex items-center gap-2">
            {rawContext.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/30 px-2 py-0.5 text-xs font-medium text-green-600">
                <Check className="h-3 w-3" /> Context active
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAll}
              disabled={generatingAll || generatingVar !== null || aiUnavailable}
            >
              {generatingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generatingAll ? "Generating..." : "Generate All"}
            </Button>
          </div>
        </div>
        {selectedTemplate.variables.map((v) => (
          <div key={v.name}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">
                {`{{${v.name}}}`} — {v.description}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGenerateVariable(v.name)}
                disabled={generatingVar === v.name || aiUnavailable}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
              >
                {generatingVar === v.name ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {generatingVar === v.name ? "..." : "AI"}
              </Button>
            </div>
            <Input
              placeholder={v.placeholder}
              value={variables[v.name] || ""}
              onChange={(e) => setVariables((prev) => ({ ...prev, [v.name]: e.target.value }))}
              className="bg-secondary border-border text-sm"
            />
          </div>
        ))}
      </div>

      {/* Output */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-semibold text-foreground">Generated Prompt</h3>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground overflow-auto max-h-[400px] whitespace-pre-wrap font-mono">
          {getRenderedPrompt()}
        </pre>
      </div>
    </div>
  );
};
