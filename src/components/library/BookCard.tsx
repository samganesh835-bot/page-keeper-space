import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Book {
  id: string;
  title: string;
  author: string | null;
  file_path: string;
  file_size: number;
  file_type: string | null;
  uploaded_at: string;
}

interface BookCardProps {
  book: Book;
  onDelete: (book: Book) => void;
}

export const BookCard = ({ book, onDelete }: BookCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    
    const { data, error } = await supabase.storage
      .from("books")
      .download(book.file_path);

    if (error) {
      toast.error("Failed to download book");
      setDownloading(false);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.title}.${book.file_path.split(".").pop()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Book downloaded successfully");
    setDownloading(false);
  };

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{book.title}</CardTitle>
              {book.author && (
                <p className="text-sm text-muted-foreground truncate mt-1">
                  by {book.author}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Size: {(book.file_size / (1024 * 1024)).toFixed(2)} MB</p>
            <p>Uploaded: {new Date(book.uploaded_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? "Downloading..." : "Read"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{book.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(book)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
