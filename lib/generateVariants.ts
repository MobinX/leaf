import { generateText } from 'ai';
import { createAiGateway } from 'ai-gateway-provider';
import { createUnified } from 'ai-gateway-provider/providers/unified';
import { z } from 'zod';

export interface VariantGenerationInput {
  theoryImages: string[];
  theoryComment: string;
  tables: Array<{
    name: string;
    images: string[];
  }>;
  calcImages: string[];
  calcComment: string;
  discImages: string[];
  discComment: string;
}

const VariantOutputSchema = z.object({
  theory: z.array(z.string()).length(3),
  common: z.string(),
  results_discussion: z.array(z.string()).length(3),
}); 

export type VariantOutput = z.infer<typeof VariantOutputSchema>;

export async function generateVariants(input: VariantGenerationInput): Promise<VariantOutput> {
  const token = "";
  if (!token) {
    throw new Error('CF_AIG_TOKEN environment variable not set');
  }

  const aigateway = createAiGateway({
    accountId: '9ada87e1043c02fee3a42cf500922832',
    gateway: 'master',
    apiKey: token,
  });
  const unified = createUnified();

  const systemPrompt = `You are a scientific document generator.
Return ONLY valid JSON with this exact shape:
{
  "theory": ["html1","html2","html3"],
  "common": "html",
  "results_discussion": ["html1","html2","html3"]
}

Rules:
1) theory/results_discussion must each contain exactly 3 variants.
2) Output HTML only (no markdown wrappers).
3) Use <math>...</math> for equations and <chart ...></chart> where relevant.
4) "common" must include tables/calculation content without variants.

CHART TAG FORMAT (Multi-dataset support):
<chart data-datasets='[{"id":"ds1","xData":[x1,x2,...],"yData":[y1,y2,...],"model":"linear","label":"Label"}]' data-x-label="X axis" data-y-label="Y axis"></chart>

CHART RULES:
- Each dataset: {id (unique), xData (array), yData (array), model (one of: linear, linear_y_mx, exponential, logarithmic, sine, cosine, tangent, power, logistic, polynomial, gaussian), label (optional)}
- All datasets share same x/y labels
- Can combine 1-N datasets in single chart
- Chart auto-fits curves using least squares
- Keep JSON valid and parseable`;


  const prompt = buildPromptText(input);

  const { text } = await generateText({
    model: aigateway(unified('google-ai-studio/gemini-2.5-flash')),
    system: systemPrompt,
    prompt,
  });

  const parsed = parseJsonFromText(text);
  return VariantOutputSchema.parse(parsed);
}

function buildPromptText(input: VariantGenerationInput): string {
  const lines: string[] = [];

  lines.push('## Theory');
  lines.push(`Comment: ${input.theoryComment || '(no additional comment)'}`);
  input.theoryImages.forEach((img, index) => lines.push(`TheoryImage${index + 1}: ${img}`));

  lines.push('## Data Tables');
  input.tables.forEach((table, tableIndex) => {
    lines.push(`TableName${tableIndex + 1}: ${table.name}`);
    table.images.forEach((img, i) => lines.push(`Table${tableIndex + 1}Image${i + 1}: ${img}`));
  });

  lines.push('## Calculations');
  lines.push(`Comment: ${input.calcComment || '(no additional comment)'}`);
  input.calcImages.forEach((img, index) => lines.push(`CalcImage${index + 1}: ${img}`));

  lines.push('## Discussion');
  lines.push(`Comment: ${input.discComment || '(no additional comment)'}`);
  input.discImages.forEach((img, index) => lines.push(`DiscussionImage${index + 1}: ${img}`));

  lines.push('Generate the final JSON now.');
  return lines.join('\n');
}

function parseJsonFromText(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }

  return JSON.parse(text);
}

export async function generateVariantsFromBlobs(input: {
  theoryImages: Blob[];
  theoryComment: string;
  tables: Array<{ name: string; images: Blob[] }>;
  calcImages: Blob[];
  calcComment: string;
  discImages: Blob[];
  discComment: string;
}): Promise<VariantOutput> {
  const base64Input: VariantGenerationInput = {
    theoryImages: await Promise.all(input.theoryImages.map(blobToDataUrl)),
    theoryComment: input.theoryComment,
    tables: await Promise.all(
      input.tables.map(async (table) => ({
        name: table.name,
        images: await Promise.all(table.images.map(blobToDataUrl)),
      }))
    ),
    calcImages: await Promise.all(input.calcImages.map(blobToDataUrl)),
    calcComment: input.calcComment,
    discImages: await Promise.all(input.discImages.map(blobToDataUrl)),
    discComment: input.discComment,
  };

  return generateVariants(base64Input);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mime = blob.type || 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

