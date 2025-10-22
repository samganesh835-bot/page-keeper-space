import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface UploadBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookUploaded: () => void;
  storageUsed: number;
  storageLimit: number;
}

export const UploadBookDialog = ({
  open,
  onOpenChange,
  onBookUploaded,
  storageUsed,
  storageLimit,
}: UploadBookDialogProps) => {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (storageUsed + selectedFile.size > storageLimit) {
        toast.error("This file would exceed your storage limit of 200MB");
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to upload books");
      setUploading(false);
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("books")
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Failed to upload file");
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("books").insert({
      user_id: user.id,
      title,
      author: author || null,
      file_path: fileName,
      file_size: file.size,
      file_type: file.type,
    });

    if (dbError) {
      await supabase.storage.from("books").remove([fileName]);
      toast.error("Failed to save book information");
      setUploading(false);
      return;
    }

    toast.success("Book uploaded successfully!");
    setTitle("");
    setAuthor("");
    setFile(null);
    setUploading(false);
    onBookUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Book Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Author (Optional)</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Book File (PDF, EPUB, etc.)</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.epub,.mobi,.txt,.doc,.docx"
              required
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                File size: {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
