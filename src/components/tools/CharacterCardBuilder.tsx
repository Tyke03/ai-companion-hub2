import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Download, Sparkles, Upload, Loader2, Image, Trash2, Plus, AlertTriangle, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { embedCardInPng, extractCardFromPng } from "@/lib/pngChunk";
import { useAiBackendStatus } from "@/hooks/useAiBackend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface CharacterCardData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string;
  creator: string;
  nickname: string;
  creator_notes_multilingual: string;
  /** List-edited fields */
  source: string[];
  group_only_greetings: string[];
  alternate_greetings: string[];
  character_version: string;
}

const defaultCard: CharacterCardData = {
  name: "", description: "", personality: "", scenario: "", first_mes: "",
  mes_example: "", creator_notes: "", system_prompt: "", post_history_instructions: "",
  tags: "", creator: "", nickname: "", creator_notes_multilingual: "", source: [],
  group_only_greetings: [], alternate_greetings: [], character_version: "1.0",
};

/** Fields whose value is an array of strings (rendered with list editors) */
const ARRAY_FIELDS = new Set(["source", "group_only_greetings", "alternate_greetings"]);

const fieldDescriptions: Record<string, string> = {
  name: "A memorable character name",
  description: "Appearance, background, abilities, and key traits (2-4 paragraphs)",
  personality: "Core personality traits, behavioral patterns, and quirks",
  scenario: "The setting/situation where the user meets this character",
  first_mes: "The character's opening message with actions and dialogue",
  mes_example: "Example dialogue exchanges showing the character's voice",
  creator_notes: "Notes for users about how to best use this character",
  system_prompt: "Instructions for the AI on how to roleplay this character",
  post_history_instructions: "Brief reminder inserted after chat history",
  tags: "Comma-separated tags for categorization",
  creator: "Creator name or handle",
  nickname: "Alternative name or alias for the character",
  creator_notes_multilingual: "Creator notes in other languages (JSON: {\"lang\": \"notes\"})",
  source: "Source URLs or IDs",
  group_only_greetings: "Greetings only used in group chats",
  alternate_greetings: "Alternate opening messages (V2 spec field)",
  character_version: "Version of this character card",
};

const recommendedMax: Record<string, number> = {
  description: 2000, personality: 1000, scenario: 1000, first_mes: 2000, mes_example: 5000,
};

function CharCountIndicator({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? current / max : 0;
  const color = pct > 1 ? "text-destructive" : pct > 0.8 ? "text-yellow-500" : "text-muted-foreground";
  return (
    <span className={`text-xs ${color}`}>
      {current}/{max}
    </span>
  );
}

type SpecVersion = "v2" | "v3";

function ListEditor({
  items, onChange, placeholder, addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const update = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">No items yet.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea
            placeholder={placeholder}
            value={item}
            onChange={(e) => update(i, e.target.value)}
            className="min-h-[64px] flex-1 bg-secondary border-border text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
            className="h-8 px-2 text-muted-foreground hover:text-destructive"
            aria-label={`Remove item ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}

/** Splits an AI/import string value into a list (commas or newlines). */
function toList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const CharacterCardBuilder = () => {
  const [card, setCard] = useState<CharacterCardData>(defaultCard);
  const [specVersion, setSpecVersion] = useState<SpecVersion>("v2");
  const [copied, setCopied] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [converting, setConverting] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pngFile, setPngFile] = useState<File | null>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const aiStatus = useAiBackendStatus();
  const aiUnavailable = aiStatus === "unavailable";

  const pngPreviewUrl = useMemo(() => pngFile ? URL.createObjectURL(pngFile) : null, [pngFile]);

  const multilingual = useMemo(() => {
    const text = card.creator_notes_multilingual;
    if (!text.trim()) return { valid: true, value: undefined as Record<string, string> | undefined, error: null as string | null };
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { valid: true, value: parsed as Record<string, string>, error: null };
      }
      return { valid: false, value: undefined, error: "Must be a JSON object, e.g. {\"es\": \"...\"}" };
    } catch (e) {
      return { valid: false, value: undefined, error: errMsg(e) || "Invalid JSON" };
    }
  }, [card.creator_notes_multilingual]);

  const updateField = (field: keyof CharacterCardData, value: string) => {
    setCard((prev) => ({ ...prev, [field]: value }));
  };

  const updateList = (field: keyof CharacterCardData, items: string[]) => {
    setCard((prev) => ({ ...prev, [field]: items }));
  };

  const generateV2Json = () => ({
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: card.name, description: card.description, personality: card.personality,
      scenario: card.scenario, first_mes: card.first_mes, mes_example: card.mes_example,
      creator_notes: card.creator_notes, system_prompt: card.system_prompt,
      post_history_instructions: card.post_history_instructions,
      alternate_greetings: card.alternate_greetings.filter((g) => g.trim()),
      tags: card.tags.split(",").map((t) => t.trim()).filter(Boolean),
      creator: card.creator, character_version: card.character_version.trim() || "1.0", extensions: {},
    },
  });

  const generateV3Json = () => ({
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: card.name, description: card.description, personality: card.personality,
      scenario: card.scenario, first_mes: card.first_mes, mes_example: card.mes_example,
      creator_notes: card.creator_notes, system_prompt: card.system_prompt,
      post_history_instructions: card.post_history_instructions,
      alternate_greetings: card.alternate_greetings.filter((g) => g.trim()),
      tags: card.tags.split(",").map((t) => t.trim()).filter(Boolean),
      creator: card.creator, character_version: card.character_version.trim() || "1.0", extensions: {},
      nickname: card.nickname || undefined,
      creation_date: Math.floor(Date.now() / 1000),
      modification_date: Math.floor(Date.now() / 1000),
      group_only_greetings: card.group_only_greetings.filter((g) => g.trim()),
      source: card.source.filter((s) => s.trim()),
      creator_notes_multilingual: multilingual.valid ? multilingual.value : undefined,
      assets: [],
    },
  });

  const getCardJson = () => (specVersion === "v3" ? generateV3Json() : generateV2Json());

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(getCardJson(), null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(getCardJson(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${card.name || "character"}_${specVersion}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `Character card ${specVersion.toUpperCase()} JSON downloaded.` });
  };

  const handleDownloadPng = async () => {
    if (!pngFile) {
      toast({ title: "No image", description: "Upload a PNG image first to embed the card.", variant: "destructive" });
      return;
    }
    try {
      const chunkName = specVersion === "v3" ? "ccv3" : "chara";
      const cardJson = getCardJson();
      const blob = await embedCardInPng(pngFile, cardJson, chunkName as "chara" | "ccv3");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${card.name || "character"}_${specVersion}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `Card embedded in PNG as ${chunkName} chunk.` });
    } catch (err) {
      toast({ title: "Error", description: errMsg(err) || "Failed to embed card in PNG.", variant: "destructive" });
    }
  };

  const handleGenerateField = async (fieldName: keyof CharacterCardData) => {
    setGeneratingField(fieldName);
    try {
      const { data, error } = await supabase.functions.invoke("venice-ai", {
        body: { action: "generate-field", fieldName, fieldDescription: fieldDescriptions[fieldName], existingFields: card, keywords: Array.isArray(card[fieldName]) ? (card[fieldName] as string[]).join(", ") : card[fieldName] || undefined },
      });
      if (error) throw error;
      if (data?.result) {
        if (ARRAY_FIELDS.has(fieldName)) {
          updateList(fieldName, toList(data.result));
        } else {
          updateField(fieldName, data.result);
        }
      }
    } catch (err) {
      toast({ title: "Error", description: errMsg(err) || "Failed to generate field.", variant: "destructive" });
    } finally {
      setGeneratingField(null);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("venice-ai", {
        body: { action: "generate-all", existingFields: card },
      });
      if (error) throw error;
      if (data?.result && typeof data.result === "object" && !data.parseError) {
        setCard((prev) => {
          const updated = { ...prev };
          for (const [key, value] of Object.entries(data.result)) {
            if (key in updated) {
              const record = updated as Record<string, unknown>;
              if (ARRAY_FIELDS.has(key) && typeof value === "string") {
                record[key] = toList(value);
              } else if (typeof value === "string") {
                record[key] = value;
              } else if (Array.isArray(value)) {
                record[key] = value.map(String);
              }
            }
          }
          return updated;
        });
        toast({ title: "Generated", description: "All fields have been generated/enhanced by AI." });
      } else if (data?.parseError) {
        toast({ title: "Partial result", description: "AI response couldn't be parsed. Try generating individual fields.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: errMsg(err) || "Failed to generate.", variant: "destructive" });
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "image/png") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const extracted = extractCardFromPng(bytes);
      if (extracted) {
        const parsed = extracted.data?.data || extracted.data;
        applyParsedCard(parsed);
        toast({ title: "Imported", description: `Extracted ${extracted.chunkName} card from PNG.` });
        setPngFile(file);
      } else {
        toast({ title: "No card found", description: "This PNG doesn't contain an embedded character card.", variant: "destructive" });
      }
    } else {
      const text = await file.text();
      setImportText(text);
      setShowImport(true);
    }
    if (fileImportRef.current) fileImportRef.current.value = "";
  };

  const applyParsedCard = (parsed: Record<string, unknown> | null | undefined) => {
    if (!parsed) return;
    setCard((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(defaultCard)) {
        const value = parsed[key];
        if (value === undefined) continue;
        const record = updated as Record<string, unknown>;
        if (ARRAY_FIELDS.has(key)) {
          if (Array.isArray(value)) record[key] = value.map((v) => String(v).trim()).filter(Boolean);
          else if (typeof value === "string") record[key] = toList(value);
        } else if (typeof value === "string") {
          record[key] = value;
        } else if (typeof value === "number" && key === "character_version") {
          record[key] = String(value);
        }
      }
      return updated;
    });
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast({ title: "Empty", description: "Paste character data to import.", variant: "destructive" });
      return;
    }
    setConverting(true);
    try {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(importText);
        if (parsed?.spec === "chara_card_v3" && parsed?.data) {
          applyParsedCard(parsed.data);
          setSpecVersion("v3");
          toast({ title: "Imported", description: "V3 character card loaded." });
          setShowImport(false); setImportText(""); return;
        }
        if (parsed?.data) parsed = parsed.data;
        if (parsed?.name || parsed?.description || parsed?.personality) {
          applyParsedCard(parsed);
          toast({ title: "Imported", description: "Character data loaded from JSON." });
          setShowImport(false); setImportText(""); return;
        }
      } catch { /* Not JSON — send to AI */ }

      const { data, error } = await supabase.functions.invoke("venice-ai", {
        body: { action: "convert-character", inputText: importText },
      });
      if (error) throw error;
      if (data?.result && typeof data.result === "object" && !data.parseError) {
        applyParsedCard(data.result);
        toast({ title: "Converted", description: "Character data imported and converted." });
        setShowImport(false); setImportText("");
      } else {
        toast({ title: "Error", description: "Could not parse the conversion result.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: errMsg(err) || "Failed to convert.", variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  const handleClearAll = () => {
    setCard(defaultCard);
    setPngFile(null);
    toast({ title: "Cleared", description: "All fields have been reset." });
  };

  const v2Fields: { key: keyof CharacterCardData; label: string; multiline?: boolean; placeholder: string }[] = [
    { key: "name", label: "Character Name", placeholder: "Luna Starweaver" },
    { key: "creator", label: "Creator", placeholder: "Your name or handle" },
    { key: "character_version", label: "Character Version", placeholder: "1.0" },
    { key: "description", label: "Description", multiline: true, placeholder: "A mysterious sorceress who dwells in the ancient tower..." },
    { key: "personality", label: "Personality", multiline: true, placeholder: "Confident, seductive, witty, caring, slightly mischievous..." },
    { key: "scenario", label: "Scenario", multiline: true, placeholder: "{{user}} has stumbled upon {{char}}'s tower while seeking shelter..." },
    { key: "first_mes", label: "First Message", multiline: true, placeholder: "*Luna looks up from her ancient tome* \"Well, well...\"" },
    { key: "mes_example", label: "Example Dialogue", multiline: true, placeholder: "<START>\n{{user}}: What are you reading?\n{{char}}: *She tilts the book*..." },
    { key: "system_prompt", label: "System Prompt", multiline: true, placeholder: "Write {{char}}'s next reply in a roleplay with {{user}}..." },
    { key: "post_history_instructions", label: "Post History Instructions", multiline: true, placeholder: "End each response with an action or question..." },
    { key: "creator_notes", label: "Creator Notes", multiline: true, placeholder: "This character works best with creative/roleplay models..." },
    { key: "tags", label: "Tags (comma-separated)", placeholder: "fantasy, romance, nsfw, sorceress, original character" },
  ];

  const v3ExtraFields: { key: keyof CharacterCardData; label: string; multiline?: boolean; placeholder: string }[] = [
    { key: "nickname", label: "Nickname", placeholder: "Luna, Star" },
  ];

  const fields = specVersion === "v3" ? [...v2Fields, ...v3ExtraFields] : v2Fields;
  const generatableFields = new Set(Object.keys(defaultCard).filter((k) => k !== "creator" && k !== "character_version"));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">Character Card Builder</h2>
        <p className="text-sm text-muted-foreground">
          Create V2/V3 character cards, import from any format, export as JSON or PNG with embedded data, and use AI to generate or enhance fields.
        </p>
      </div>

      {/* AI backend status banner */}
      {aiStatus === "checking" && (
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
              Manual editing, import, JSON export, and PNG embedding still work. AI generation buttons are disabled until the backend is reachable again.
            </p>
          </div>
        </div>
      )}

      {/* Spec version toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <span className={`text-sm font-medium ${specVersion === "v2" ? "text-foreground" : "text-muted-foreground"}`}>V2</span>
        <Switch checked={specVersion === "v3"} onCheckedChange={(checked) => setSpecVersion(checked ? "v3" : "v2")} />
        <span className={`text-sm font-medium ${specVersion === "v3" ? "text-foreground" : "text-muted-foreground"}`}>V3</span>
        <span className="text-xs text-muted-foreground ml-2">
          {specVersion === "v3" ? "chara_card_v3 — includes nickname, source, assets, multilingual notes" : "chara_card_v2 — universal compatibility"}
        </span>
      </div>

      {/* Top action bar */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setShowImport(!showImport)}>
          <Upload className="h-4 w-4" /> Import (Text)
        </Button>
        <div>
          <input ref={fileImportRef} type="file" accept=".json,.png,.txt,.yaml,.yml" className="hidden" onChange={handleFileImport} />
          <Button variant="outline" onClick={() => fileImportRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import (File/PNG)
          </Button>
        </div>
        <Button onClick={handleGenerateAll} disabled={generatingAll || aiUnavailable}>
          {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generatingAll ? "Generating..." : "Generate All Fields"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This clears all fields and removes the uploaded PNG. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll}>Clear All Fields</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste character data in <strong>any format</strong> — JSON, V2, V3, Character.AI, W++, SBF, Pygmalion, YAML, or plain text. AI will parse and map everything.
          </p>
          <Textarea placeholder="Paste character data here..." value={importText} onChange={(e) => setImportText(e.target.value)} className="min-h-[150px] bg-secondary border-border font-mono text-sm" />
          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={converting || aiUnavailable}>
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {converting ? "Converting..." : "Import & Convert"}
            </Button>
            <Button variant="ghost" onClick={() => { setShowImport(false); setImportText(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">{field.label}</label>
              <div className="flex items-center gap-2">
                {recommendedMax[field.key] && (
                  <CharCountIndicator current={String(card[field.key]).length} max={recommendedMax[field.key]} />
                )}
                {generatableFields.has(field.key) && (
                  <Button variant="ghost" size="sm" onClick={() => handleGenerateField(field.key)} disabled={generatingField === field.key || aiUnavailable} className="h-7 px-2 text-xs text-muted-foreground hover:text-primary">
                    {generatingField === field.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {generatingField === field.key ? "Generating..." : "AI Generate"}
                  </Button>
                )}
              </div>
            </div>
            {field.multiline ? (
              <Textarea placeholder={field.placeholder} value={String(card[field.key])} onChange={(e) => updateField(field.key, e.target.value)} className="min-h-[100px] bg-secondary border-border text-sm" />
            ) : (
              <Input placeholder={field.placeholder} value={String(card[field.key])} onChange={(e) => updateField(field.key, e.target.value)} className="bg-secondary border-border" />
            )}
          </div>
        ))}

        {/* Alternate greetings list editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-foreground">Alternate Greetings</label>
            <span className="text-xs text-muted-foreground">Multiple opening scenarios for the same character</span>
          </div>
          <ListEditor
            items={card.alternate_greetings}
            onChange={(items) => updateList("alternate_greetings", items)}
            placeholder={'*A different opening message* "An alternate way to start..."'}
            addLabel="Add alternate greeting"
          />
        </div>

        {/* V3-only list fields */}
        {specVersion === "v3" && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">Source</label>
                <span className="text-xs text-muted-foreground">URLs or IDs where this card originated</span>
              </div>
              <ListEditor
                items={card.source}
                onChange={(items) => updateList("source", items)}
                placeholder="https://chub.ai/characters/..."
                addLabel="Add source"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">Group-Only Greetings</label>
                <span className="text-xs text-muted-foreground">Greetings used only in group chats</span>
              </div>
              <ListEditor
                items={card.group_only_greetings}
                onChange={(items) => updateList("group_only_greetings", items)}
                placeholder="*A greeting that acknowledges the other characters in the room*"
                addLabel="Add group greeting"
              />
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground mb-1">Assets (V3)</p>
              <p className="text-xs text-muted-foreground">
                The V3 spec's <code className="text-primary">assets</code> array holds files referenced by extensions (images, expression packs, audio). This builder exports an empty array — populate it later if your frontend supports assets.
              </p>
            </div>
          </>
        )}

        {/* Multilingual JSON validation indicator */}
        {specVersion === "v3" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">Creator Notes (Multilingual JSON)</label>
              {card.creator_notes_multilingual.trim() && (
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                  multilingual.valid
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}>
                  {multilingual.valid ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {multilingual.valid ? "Valid JSON" : "Invalid JSON"}
                </span>
              )}
            </div>
            <Textarea
              placeholder='{"es": "Notas en español", "ja": "日本語のノート"}'
              value={card.creator_notes_multilingual}
              onChange={(e) => updateField("creator_notes_multilingual", e.target.value)}
              className="min-h-[80px] bg-secondary border-border font-mono text-sm"
            />
            {!multilingual.valid && (
              <p className="mt-1 text-xs text-destructive">
                {multilingual.error} — this field will be excluded from the exported card.
              </p>
            )}
            {multilingual.valid && multilingual.value && (
              <p className="mt-1 text-xs text-green-400">
                ✓ Parsed {Object.keys(multilingual.value).length} language(s): {Object.keys(multilingual.value).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* PNG image for embedding */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">PNG Image for Card Embedding</p>
        <p className="text-xs text-muted-foreground">
          Upload a character portrait PNG to export as an embedded card (used by SillyTavern, RisuAI, etc.)
        </p>
        <input ref={pngInputRef} type="file" accept="image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPngFile(f); }} />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => pngInputRef.current?.click()}>
            <Image className="h-4 w-4" />
            {pngFile ? pngFile.name : "Choose PNG"}
          </Button>
          {pngFile && <span className="text-xs text-muted-foreground">{(pngFile.size / 1024).toFixed(0)} KB</span>}
        </div>
        {pngPreviewUrl && (
          <div className="mt-2">
            <img src={pngPreviewUrl} alt="Card preview" className="max-h-48 rounded-md border border-border object-contain" />
          </div>
        )}
      </div>

      {/* Export actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleCopyJson}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : `Copy ${specVersion.toUpperCase()} JSON`}
        </Button>
        <Button variant="outline" onClick={handleDownloadJson}>
          <Download className="h-4 w-4" /> Download JSON
        </Button>
        <Button variant="outline" onClick={handleDownloadPng} disabled={!pngFile}>
          <Image className="h-4 w-4" /> Export as PNG
        </Button>
      </div>

      {/* Preview */}
      {card.name && (
        <div>
          <h3 className="font-display font-semibold text-foreground mb-2">Preview ({specVersion.toUpperCase()})</h3>
          <pre className="rounded-lg border border-border bg-secondary/50 p-4 text-xs text-muted-foreground overflow-auto max-h-[400px] whitespace-pre-wrap font-mono">
            {JSON.stringify(getCardJson(), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
