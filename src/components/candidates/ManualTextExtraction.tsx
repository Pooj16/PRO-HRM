import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  email: string;
  status?: string;
  resume_url?: string;
  resume_text?: string;
  created_at: string;
}

interface ManualTextExtractionProps {
  candidates: Candidate[];
  onRefresh: () => void;
}

interface ExtractionResult {
  candidateId: string;
  name: string;
  status: 'success' | 'failed' | 'skipped' | 'processing';
  reason?: string;
  textLength?: number;
  error?: string;
}

export const ManualTextExtraction: React.FC<ManualTextExtractionProps> = ({ candidates, onRefresh }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  // Filter candidates that need text extraction
  const candidatesNeedingExtraction = candidates.filter(candidate =>
    candidate.status === 'uploaded' ||
    candidate.status === 'extraction_failed' ||
    (candidate.status === 'text_extracted' && (!candidate.resume_text || candidate.resume_text.length < 100))
  );

  const selectAllCandidates = () => {
    setSelectedCandidates(candidatesNeedingExtraction.map(c => c.id));
  };

  const clearSelection = () => {
    setSelectedCandidates([]);
  };

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidates(prev =>
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const processSelectedCandidates = async () => {
    if (selectedCandidates.length === 0) {
      toast.error('Please select at least one candidate');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      console.log('🚀 Starting manual text extraction for candidates:', selectedCandidates);

      const { data, error } = await supabase.functions.invoke('trigger-text-extraction', {
        body: { candidateIds: selectedCandidates }
      });

      if (error) throw error;

      toast.success(`Extraction triggered for ${selectedCandidates.length} candidates! Check status in a few seconds.`);
      setTimeout(() => onRefresh(), 3000);
      setIsOpen(false);

    } catch (error: any) {
      console.error('❌ Failed to trigger extraction:', error);
      toast.error(`Failed to trigger extraction: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const testSingleCandidate = async (candidateId: string, resumeUrl: string) => {
    try {
      console.log('🧪 Testing single candidate extraction:', candidateId);

      const pdfRes = await fetch(resumeUrl);
      if (!pdfRes.ok) throw new Error(`PDF Fetch failed: ${pdfRes.status}`);

      const arrayBuffer = await pdfRes.arrayBuffer();
      const base64String = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const ocrRes = await fetch('http://localhost:5002/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64_data: base64String,
          content_type: 'application/pdf'
        })
      });

      if (!ocrRes.ok) throw new Error(`OCR Service failed: ${ocrRes.status}`);
      const data = await ocrRes.json();

      if (data && data.success) {
        toast.success(`Test extraction successful! Text length: ${data.extracted_text.length} characters`);
        await supabase.from('candidates').update({
          resume_text: data.extracted_text,
          status: 'text_extracted'
        }).eq('id', candidateId);
        onRefresh();
      } else {
        toast.error(`Test extraction failed: ${data?.error || 'Unknown error'}`);
      }

    } catch (error: any) {
      console.error('❌ Test extraction failed:', error);
      toast.error(`Test extraction failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Manual Text Extraction ({candidatesNeedingExtraction.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manual Resume Text Extraction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {candidatesNeedingExtraction.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">All candidates have extracted text!</p>
              <p className="text-muted-foreground">No candidates need text extraction at this time.</p>
            </div>
          ) : (
            <>
              {/* Selection Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllCandidates}
                  disabled={isProcessing}
                >
                  Select All ({candidatesNeedingExtraction.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={isProcessing}
                >
                  Clear Selection
                </Button>
                <Badge variant="secondary">
                  {selectedCandidates.length} selected
                </Badge>
              </div>

              {/* Candidates List */}
              <ScrollArea className="max-h-60 border rounded-md">
                <div className="p-4 space-y-2">
                  {candidatesNeedingExtraction.map((candidate) => (
                    <div
                      key={candidate.id}
                      className={`flex items-center justify-between p-3 rounded border ${selectedCandidates.includes(candidate.id)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted/30'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.includes(candidate.id)}
                          onChange={() => toggleCandidate(candidate.id)}
                          disabled={isProcessing}
                          className="rounded"
                        />
                        <div>
                          <p className="font-medium">{candidate.name}</p>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={candidate.status === 'uploaded' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {candidate.status}
                            </Badge>
                            {candidate.resume_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => testSingleCandidate(candidate.id, candidate.resume_url!)}
                                disabled={isProcessing}
                                className="text-xs h-6"
                              >
                                Test Extract
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Process Button */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={processSelectedCandidates}
                  disabled={isProcessing || selectedCandidates.length === 0}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Extract Text for Selected ({selectedCandidates.length})
                    </>
                  )}
                </Button>
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    Processing candidates... This may take a few minutes.
                  </p>
                </div>
              )}

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Extraction Results:</h4>
                  <ScrollArea className="max-h-40 border rounded-md">
                    <div className="p-4 space-y-2">
                      {results.map((result, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="font-medium">{result.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.status === 'success' && result.textLength && (
                              <span>{result.textLength} chars</span>
                            )}
                            {result.status === 'failed' && result.error && (
                              <span className="text-red-500">{result.error}</span>
                            )}
                            {result.status === 'skipped' && result.reason && (
                              <span>{result.reason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};