
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText } from 'lucide-react';

interface ResumeViewerProps {
  resumeUrl: string;
  candidateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ResumeViewer = ({ resumeUrl, candidateName, open, onOpenChange }: ResumeViewerProps) => {
  const isPDF = resumeUrl.toLowerCase().includes('.pdf');
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {candidateName}'s Resume
          </DialogTitle>
          <DialogDescription>
            Resume document viewer
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-[600px] relative">
          {isPDF ? (
            <iframe
              src={resumeUrl}
              className="w-full h-[600px] border rounded-lg"
              title={`${candidateName}'s Resume`}
              style={{ minHeight: '600px' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-[600px] bg-gray-50 rounded-lg">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">Document preview not available for this file type</p>
              <Button 
                onClick={() => window.open(resumeUrl, '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center pt-4">
          <Button 
            variant="outline" 
            onClick={() => window.open(resumeUrl, '_blank')}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Original
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResumeViewer;
