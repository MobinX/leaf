/**
 * Document and related types for AI-powered document system
 */

export type ChartModel = 'linear' | 'exponential' | 'logarithmic' | 'sine' | 'cos' | 'tan' | 'power' | 'logistic' | 'polynomial' | 'gaussian';

export interface DocumentInput {
  theory: Array<{
    images: Blob[];
    comment: string;
  }>;
  tables: Array<{
    name: string;
    images: Blob[];
  }>;
  calculations: {
    images: Blob[];
    comment: string;
  };
  discussions: {
    images: Blob[];
    comment: string;
  };
}

export interface VariantContent {
  theory: string[]; // exactly 3 HTML variants
  common: string; // HTML with data tables and calculations
  results_discussion: string[]; // exactly 3 HTML variants
}

export interface Tab {
  id: string;
  name: string;
  content: string;
}

export interface Document {
  id: string; // document name
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  
  tabs: Tab[];
  activeTabId: string;

  inputs: Partial<DocumentInput>; // may be incomplete during creation
  
  aiOutput?: VariantContent;
  
  selectedVariants: {
    theory: 0 | 1 | 2;
    result_discussion: 0 | 1 | 2;
  };
  
  editorContent?: string; // final Tiptap content (JSON or HTML)
  isGenerating?: boolean;
}

export interface DocumentMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * For localStorage key format:
 * "document_${id}" -> full Document JSON
 * "documents" -> DocumentMetadata[]
 * "currentDocument" -> { id: string }
 */
