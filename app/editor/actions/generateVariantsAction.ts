'use server';

import { generateVariantsFromBlobs } from '@/lib/generateVariants';
import { buildEditorContent, parseVariants } from '@/lib/parseVariants';

type ActionSuccess = {
  ok: true;
  aiOutput: {
    theory: string[];
    common: string;
    results_discussion: string[];
  };
  editorContent: string;
};

type ActionFailure = {
  ok: false;
  error: string;
};

export async function generateVariantsAction(formData: FormData): Promise<ActionSuccess | ActionFailure> {
  try {
    const theoryImages = getBlobList(formData, 'theoryImages');
    const calcImages = getBlobList(formData, 'calcImages');
    const discImages = getBlobList(formData, 'discImages');

    const theoryComment = String(formData.get('theoryComment') ?? '');
    const calcComment = String(formData.get('calcComment') ?? '');
    const discComment = String(formData.get('discComment') ?? '');

    const tablesMetaRaw = String(formData.get('tablesMeta') ?? '[]');
    const tablesMeta = JSON.parse(tablesMetaRaw) as Array<{ name: string; key: string }>;
    const tables = tablesMeta.map((table) => ({
      name: table.name,
      images: getBlobList(formData, `${table.key}Images`),
    }));

    const variants = await generateVariantsFromBlobs({
      theoryImages,
      theoryComment,
      tables,
      calcImages,
      calcComment,
      discImages,
      discComment,
    });

    const aiOutput = parseVariants(variants);
    const editorContent = buildEditorContent(aiOutput, 0, 0);

    return {
      ok: true,
      aiOutput,
      editorContent,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to generate variants',
    };
  }
}

function getBlobList(formData: FormData, key: string): Blob[] {
  return formData.getAll(key).filter((value) => typeof value === 'object') as Blob[];
}

