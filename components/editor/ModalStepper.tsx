/**
 * ModalStepper - 4-step document creation wizard
 * Step 1: Theory - upload images and add comment
 * Step 2: Data Tables - add multiple tables with 3 images each
 * Step 3: Calculations - upload calculation images with comment
 * Step 4: Discussions - upload discussion images with comment
 */

'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2 } from 'lucide-react';
import { useDocumentState } from '@/app/editor/hooks/useDocumentState';
import { generateVariantsAction } from '@/app/editor/actions/generateVariantsAction';

interface ModalStepperProps {
  documentId: string;
  onComplete: () => void;
}

export default function ModalStepper({ documentId, onComplete }: ModalStepperProps) {
  const { updateInputs } = useDocumentState(documentId);
  const [step, setStep] = useState(1);

  const [theoryImages, setTheoryImages] = useState<File[]>([]);
  const [theoryComment, setTheoryComment] = useState('');

  const [tables, setTables] = useState<Array<{ name: string; images: File[] }>>([]);
  const [currentTableName, setCurrentTableName] = useState('');
  const [currentTableImages, setCurrentTableImages] = useState<File[]>([]);

  const [calcImages, setCalcImages] = useState<File[]>([]);
  const [calcComment, setCalcComment] = useState('');

  const [discImages, setDiscImages] = useState<File[]>([]);
  const [discComment, setDiscComment] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Helper: convert Files to Blobs for storage
  const fileToBlob = (file: File): Blob => new Blob([file], { type: file.type });

  const handleStep1Next = useCallback(async () => {
    if (theoryImages.length === 0) {
      alert('Please upload at least one image for the theory');
      return;
    }
    
    updateInputs('theory', [{
      images: theoryImages.map(fileToBlob),
      comment: theoryComment
    }]);
    
    setStep(2);
  }, [theoryImages, theoryComment, updateInputs]);

  const handleAddTable = useCallback(() => {
    if (!currentTableName.trim()) {
      alert('Please enter a table name');
      return;
    }
    
    if (currentTableImages.length !== 3) {
      alert('Please upload exactly 3 images for this table');
      return;
    }

    setTables(prev => [...prev, {
      name: currentTableName,
      images: currentTableImages
    }]);

    setCurrentTableName('');
    setCurrentTableImages([]);
  }, [currentTableName, currentTableImages]);

  const handleStep2Next = useCallback(async () => {
    if (tables.length === 0) {
      alert('Please add at least one table');
      return;
    }

    updateInputs('tables', tables.map(t => ({
      name: t.name,
      images: t.images.map(fileToBlob)
    })));

    setStep(3);
  }, [tables, updateInputs]);

  const handleStep3Next = useCallback(async () => {
    if (calcImages.length === 0) {
      alert('Please upload at least one calculation image');
      return;
    }

    updateInputs('calculations', {
      images: calcImages.map(fileToBlob),
      comment: calcComment
    });

    setStep(4);
  }, [calcImages, calcComment, updateInputs]);

  const handleStep4Finish = useCallback(async () => {
    if (discImages.length === 0) {
      alert('Please upload at least one discussion image');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    try {
      // Save discussion input
      updateInputs('discussions', {
        images: discImages.map(fileToBlob),
        comment: discComment
      });

      const formData = new FormData();
      formData.append('theoryComment', theoryComment);
      theoryImages.forEach((file) => formData.append('theoryImages', file, file.name));

      const tablesMeta = tables.map((table, index) => ({ name: table.name, key: `table_${index}` }));
      formData.append('tablesMeta', JSON.stringify(tablesMeta));
      tables.forEach((table, index) => {
        table.images.forEach((file) => {
          formData.append(`table_${index}Images`, file, file.name);
        });
      });

      formData.append('calcComment', calcComment);
      calcImages.forEach((file) => formData.append('calcImages', file, file.name));

      formData.append('discComment', discComment);
      discImages.forEach((file) => formData.append('discImages', file, file.name));

      const result = await generateVariantsAction(formData);
      if (!result.ok) {
        throw new Error(result.error);
      }

      // Save to document storage
      const doc = {
        aiOutput: result.aiOutput,
        editorContent: result.editorContent,
        selectedVariants: { theory: 0 as const, result_discussion: 0 as const },
      };

      // Update document with AI output
      updateInputs('_aiComplete', doc);

      setIsProcessing(false);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Failed to generate variants:', error);
      setProcessingError(message);
      setIsProcessing(false);
    }
  }, [theoryImages, theoryComment, tables, calcImages, calcComment, discImages, discComment, updateInputs, onComplete]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (files: File[]) => void, currentFiles: File[], maxCount?: number) => {
    const files = Array.from(e.target.files || []);
    const newFiles = [...currentFiles, ...files];
    
    if (maxCount && newFiles.length > maxCount) {
      alert(`Maximum ${maxCount} files allowed`);
      return;
    }
    
    setter(newFiles);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h1 className="text-2xl font-bold">Create Document</h1>
          <p className="text-blue-100 mt-1">Step {step} of 4</p>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div 
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${(step / 4) * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Step 1: Theory</h2>
                <p className="text-gray-600">Upload images that explain the theory</p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <label className="cursor-pointer">
                  <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileInput(e, setTheoryImages, theoryImages)}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
              </div>

              {theoryImages.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-gray-700">{theoryImages.length} image(s) selected</p>
                  <div className="flex flex-wrap gap-2">
                    {theoryImages.map((file, idx) => (
                      <div key={idx} className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-700">
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Comments (Optional)</label>
                <textarea
                  value={theoryComment}
                  onChange={(e) => setTheoryComment(e.target.value)}
                  placeholder="Add any notes or context about the theory images..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Step 2: Data Tables</h2>
                <p className="text-gray-600">Add tables with their corresponding images</p>
              </div>

              {tables.length > 0 && (
                <div className="space-y-3">
                  <p className="font-medium text-gray-700">{tables.length} table(s) added</p>
                  {tables.map((table, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <div>
                        <p className="font-medium text-gray-900">{table.name}</p>
                        <p className="text-sm text-gray-500">{table.images.length} images</p>
                      </div>
                      <button
                        onClick={() => setTables(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-6">
                <h3 className="font-bold text-gray-900 mb-4">Add New Table</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Table Name</label>
                    <input
                      type="text"
                      value={currentTableName}
                      onChange={(e) => setCurrentTableName(e.target.value)}
                      placeholder="e.g., Experiment Results"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Images ({currentTableImages.length}/3)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                      <label className="cursor-pointer">
                        <span className="text-blue-600 font-medium">Click to upload</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileInput(e, setCurrentTableImages, currentTableImages, 3)}
                          className="hidden"
                        />
                      </label>
                      <p className="text-sm text-gray-500 mt-2">Exactly 3 images required</p>
                    </div>
                  </div>

                  <button
                    onClick={handleAddTable}
                    disabled={!currentTableName.trim() || currentTableImages.length !== 3}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Add Table
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Step 3: Calculations</h2>
                <p className="text-gray-600">Upload images showing your calculation methods</p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <label className="cursor-pointer">
                  <span className="text-blue-600 font-medium">Click to upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileInput(e, setCalcImages, calcImages)}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
              </div>

              {calcImages.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-gray-700">{calcImages.length} image(s) selected</p>
                  <div className="flex flex-wrap gap-2">
                    {calcImages.map((file, idx) => (
                      <div key={idx} className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-700">
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
                <textarea
                  value={calcComment}
                  onChange={(e) => setCalcComment(e.target.value)}
                  placeholder="Explain the calculation method..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Step 4: Discussions</h2>
                <p className="text-gray-600">Upload discussion or inspiration images</p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <label className="cursor-pointer">
                  <span className="text-blue-600 font-medium">Click to upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileInput(e, setDiscImages, discImages)}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
              </div>

              {discImages.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-gray-700">{discImages.length} image(s) selected</p>
                  <div className="flex flex-wrap gap-2">
                    {discImages.map((file, idx) => (
                      <div key={idx} className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-700">
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
                <textarea
                  value={discComment}
                  onChange={(e) => setDiscComment(e.target.value)}
                  placeholder="Add discussion notes or context..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>

              {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-blue-700">Generating your document with AI...</span>
                </div>
              )}

              {processingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 font-medium">Error generating document</p>
                  <p className="text-red-600 text-sm mt-1">{processingError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-8 py-4 flex justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <button
            onClick={() => {
              if (step === 1) handleStep1Next();
              else if (step === 2) handleStep2Next();
              else if (step === 3) handleStep3Next();
              else if (step === 4) handleStep4Finish();
            }}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {step === 4 ? 'Finish' : 'Next'}
            {step < 4 && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
