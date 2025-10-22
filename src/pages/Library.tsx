import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { BookOpen, Upload, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { UploadBookDialog } from "@/components/library/UploadBookDialog";
import { BookCard } from "@/components/library/BookCard";

interface Book {
  id: string;
  title: string;
  author: string | null;
  file_path: string;
  file_size: number;
  file_type: string | null;
  cover_url: string | null;
  uploaded_at: string;
}

const STORAGE_LIMIT = 200 * 1024 * 1024; // 200MB in bytes

const Library = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchBooks();
      fetchStorageUsed();
    }
  }, [user]);

  const fetchBooks = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      toast.error("Failed to load books");
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  const fetchStorageUsed = async () => {
    if (!user) return;

    const { data, error } = await supabase.rpc("get_user_storage_used", {
      user_uuid: user.id,
    });

    if (!error && data !== null) {
      setStorageUsed(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDeleteBook = async (book: Book) => {
    if (!user) return;

    const { error: dbError } = await supabase
      .from("books")
      .delete()
      .eq("id", book.id);

    if (dbError) {
      toast.error("Failed to delete book");
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("books")
      .remove([book.file_path]);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
    }

    toast.success("Book deleted successfully");
    fetchBooks();
    fetchStorageUsed();
  };

  const handleBookUploaded = () => {
    fetchBooks();
    fetchStorageUsed();
    setUploadDialogOpen(false);
  };

  const storagePercentage = (storageUsed / STORAGE_LIMIT) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">My Library</h1>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={storagePercentage} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {(storageUsed / (1024 * 1024)).toFixed(2)} MB / 200 MB used
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Your Books</h2>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Book
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your books...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No books yet. Upload your first book!</p>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Book
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onDelete={handleDeleteBook}
              />
            ))}
          </div>
        )}
      </main>

      <UploadBookDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onBookUploaded={handleBookUploaded}
        storageUsed={storageUsed}
        storageLimit={STORAGE_LIMIT}
      />
    </div>
  );
};

export default Library;
