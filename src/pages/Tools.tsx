import { Layout } from "@/components/Layout";
import { Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocConsolidator } from "@/components/tools/DocConsolidator";
import { CharacterCardBuilder } from "@/components/tools/CharacterCardBuilder";
import { PromptBuilder } from "@/components/tools/PromptBuilder";

const Tools = () => {
  return (
    <Layout>
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">
              Tools
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-5xl glow-text mb-3">
            AI Chatbot Tools
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Documentation consolidator, character card builder, and prompt template builder — powered by AI.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="consolidator" className="w-full">
          <TabsList className="w-full justify-start bg-secondary border border-border rounded-lg p-1 mb-8 overflow-x-auto">
            <TabsTrigger value="consolidator" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 py-2 text-sm font-medium">
              📄 Doc Consolidator
            </TabsTrigger>
            <TabsTrigger value="character" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 py-2 text-sm font-medium">
              🎭 Character Builder
            </TabsTrigger>
            <TabsTrigger value="prompts" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 py-2 text-sm font-medium">
              ✍️ Prompt Builder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consolidator">
            <DocConsolidator />
          </TabsContent>
          <TabsContent value="character">
            <CharacterCardBuilder />
          </TabsContent>
          <TabsContent value="prompts">
            <PromptBuilder />
          </TabsContent>
        </Tabs>
      </main>
    </Layout>
  );
};

export default Tools;
