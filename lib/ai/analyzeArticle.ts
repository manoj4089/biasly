import { generateText, Output } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

export const ANALYSIS_MODEL = "openai/gpt-oss-120b";

const analysisSchema = z
  .object({
    summary: z.string().min(1),
    sentiment_score: z.number().min(-1).max(1),
    sentiment_label: z.enum(["positive", "neutral", "negative"]),
    bias_label: z.enum(["left", "center", "right", "mixed", "unclear"]),
    left_percentage: z.number().int().min(0).max(100),
    center_percentage: z.number().int().min(0).max(100),
    right_percentage: z.number().int().min(0).max(100),
    confidence: z.number().min(0).max(1),
    framing_notes: z.string(),
    loaded_terms: z.array(z.string()),
    disclaimer: z.string().min(1),
  })
  .refine((data) => data.left_percentage + data.center_percentage + data.right_percentage === 100, {
    message: "left_percentage + center_percentage + right_percentage must equal 100",
  });

export type ArticleAnalysisOutput = z.infer<typeof analysisSchema>;

const INSTRUCTIONS = `You are a media analyst producing an AI-estimated, neutral analysis of a news article.

Base every judgment strictly on the article text provided. Do not infer political framing from the source's name or reputation.

Return:
- summary: a neutral 2-4 sentence summary of the article, stripped of any partisan framing.
- sentiment_score (-1 to 1) and sentiment_label: the overall tone of the article's language.
- left_percentage, center_percentage, right_percentage: integers 0-100 that sum to exactly 100, estimating how much the article's framing, word choice, and emphasis align with each perspective.
- bias_label: left, center, right, mixed, or unclear. It should match the strongest percentage unless the evidence is weak or the percentages are close, in which case prefer "mixed" or "unclear".
- confidence (0 to 1): how confident you are in the framing estimate. Use a low value when evidence is weak or the article reads as straight factual reporting with little framing to analyze — in that case also prefer bias_label "unclear".
- framing_notes: 1-3 sentences citing specific language or framing choices from the article that support your estimate.
- loaded_terms: specific words or phrases from the article that carry emotional or partisan weight (empty array if none).
- disclaimer: a short note that this is an AI-generated estimate, not an objective fact.`;

async function analyzeArticleWithGroq(title: string, rawText: string): Promise<ArticleAnalysisOutput> {
  const { output } = await generateText({
    model: groq(ANALYSIS_MODEL),
    instructions: INSTRUCTIONS,
    output: Output.object({ schema: analysisSchema }),
    prompt: `Article title: ${title}\n\nArticle text:\n${rawText}`,
  });

  return output;
}

function randomPlaceholderAnalysis(): ArticleAnalysisOutput {
  const cutA = Math.floor(Math.random() * 101);
  const cutB = Math.floor(Math.random() * 101);
  const [lo, hi] = cutA < cutB ? [cutA, cutB] : [cutB, cutA];
  const left_percentage = lo;
  const center_percentage = hi - lo;
  const right_percentage = 100 - hi;

  const percentages: Record<"left" | "center" | "right", number> = {
    left: left_percentage,
    center: center_percentage,
    right: right_percentage,
  };
  const sorted = (["left", "center", "right"] as const)
    .slice()
    .sort((a, b) => percentages[b] - percentages[a]);
  const bias_label: ArticleAnalysisOutput["bias_label"] =
    percentages[sorted[0]] - percentages[sorted[1]] <= 10 ? "mixed" : sorted[0];

  const sentiment_score = Math.round((Math.random() * 2 - 1) * 100) / 100;
  const sentiment_label: ArticleAnalysisOutput["sentiment_label"] =
    sentiment_score > 0.15 ? "positive" : sentiment_score < -0.15 ? "negative" : "neutral";

  const output: ArticleAnalysisOutput = {
    summary: "Placeholder summary — AI billing not yet configured; this is not a real analysis of the article.",
    sentiment_score,
    sentiment_label,
    bias_label,
    left_percentage,
    center_percentage,
    right_percentage,
    confidence: Math.round(Math.random() * 100) / 100,
    framing_notes: "Placeholder framing notes — no real article content was analyzed.",
    loaded_terms: [],
    disclaimer: "Placeholder analysis — AI billing not yet configured; this is not a real estimate.",
  };

  return analysisSchema.parse(output);
}

export async function analyzeArticle(title: string, rawText: string): Promise<ArticleAnalysisOutput> {
  return analyzeArticleWithGroq(title, rawText);
}
