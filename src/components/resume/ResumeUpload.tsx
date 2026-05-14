
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResumeUploadProps {
  candidateId?: string;
  onUploadComplete?: (fileUrl: string, fileName: string) => void;
}

const ResumeUpload = ({ candidateId, onUploadComplete }: ResumeUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or Word document",
          variant: "destructive"
        });
        return;
      }

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const uploadResume = async () => {
    if (!selectedFile) return;

    setUploading(true);
    
    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `resumes/${fileName}`;

      console.log('Uploading file to storage...');
      
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('File uploaded successfully, path:', filePath);

      // If we have a candidateId, update the candidate record
      if (candidateId) {
        const { error: updateError } = await supabase
          .from('candidates')
          .update({
            resume_url: filePath,  // Store ONLY the path, not the full URL
            status: 'uploaded'
          })
          .eq('id', candidateId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }

        console.log('Candidate updated, resume processing will happen automatically');
      }

      if (onUploadComplete) {
        onUploadComplete(filePath, selectedFile.name);  // Pass the path, not the URL
      }

      toast({
        title: "Resume uploaded successfully!",
        description: "Text extraction will happen automatically in the background.",
      });

      setSelectedFile(null);
      
    } catch (error) {
      console.error('Upload process error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload resume",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Resume
        </CardTitle>
        <CardDescription>
          Upload a PDF or Word document (max 5MB). Text extraction and processing will happen automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="resume-file">Select Resume File</Label>
          <Input
            id="resume-file"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="mt-1"
            disabled={uploading}
          />
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <FileText className="h-4 w-4 text-cyan-600" />
            <span className="text-sm font-medium">{selectedFile.name}</span>
            <span className="text-xs text-gray-500">
              ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        )}

        <Button 
          onClick={uploadResume} 
          disabled={!selectedFile || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Resume
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ResumeUpload;
