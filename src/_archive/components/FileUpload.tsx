import { useCallback } from "react";
import { Upload, FileText, Image, X, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "@/types/lr";

export type DocumentCategory = "INVOICE" | "PACKING_LIST" | "LC" | "EWAY_BILL";

interface CategoryConfig {
  id: DocumentCategory;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const categories: CategoryConfig[] = [
  {
    id: "INVOICE",
    label: "Invoice",
    description: "Commercial invoice with consignor, consignee, and goods details",
    colorClass: "text-primary",
    bgClass: "bg-primary-soft hover:bg-primary/10",
    borderClass: "border-primary/30 hover:border-primary/50",
  },
  {
    id: "PACKING_LIST",
    label: "Packing list",
    description: "Package count, weights, and dimensions (optional)",
    colorClass: "text-foreground",
    bgClass: "bg-secondary hover:bg-secondary/70",
    borderClass: "border-border hover:border-primary/40",
  },
  {
    id: "LC",
    label: "LC / Letter of Credit",
    description: "Payment and banking details (optional)",
    colorClass: "text-warning",
    bgClass: "bg-warning-soft hover:bg-warning/10",
    borderClass: "border-warning/30 hover:border-warning/50",
  },
  {
    id: "EWAY_BILL",
    label: "E-Way bill",
    description: "Vehicle and transport details (optional)",
    colorClass: "text-success",
    bgClass: "bg-success-soft hover:bg-success/10",
    borderClass: "border-success/30 hover:border-success/50",
  },
];

interface FileUploadProps {
  files: Record<DocumentCategory, UploadedFile[]>;
  onFilesAdd: (category: DocumentCategory, files: File[]) => void;
  onFileRemove: (category: DocumentCategory, id: string) => void;
  disabled?: boolean;
}

export function FileUpload({ files, onFilesAdd, onFileRemove, disabled }: FileUploadProps) {
  const handleDrop = useCallback(
    (category: DocumentCategory) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) =>
          file.type === "application/pdf" || file.type.startsWith("image/")
      );
      if (droppedFiles.length > 0) {
        onFilesAdd(category, droppedFiles);
      }
    },
    [onFilesAdd, disabled]
  );

  const handleFileInput = useCallback(
    (category: DocumentCategory) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        onFilesAdd(category, Array.from(selectedFiles));
      }
      e.target.value = "";
    },
    [onFilesAdd]
  );

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "done":
        return <Check className="h-4 w-4 text-success" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const totalFiles = Object.values(files).flat().length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${cat.colorClass}`}>{cat.label}</span>
              {cat.id !== "INVOICE" && (
                <span className="text-xs text-muted-foreground">(optional)</span>
              )}
            </div>
            
            <div
              onDrop={handleDrop(cat.id)}
              onDragOver={(e) => e.preventDefault()}
              className={`
                relative border-2 border-dashed rounded-lg p-4
                transition-all duration-200
                ${disabled 
                  ? "border-muted bg-muted/30 cursor-not-allowed" 
                  : `${cat.borderClass} ${cat.bgClass} cursor-pointer`
                }
              `}
            >
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleFileInput(cat.id)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                disabled={disabled}
              />
              <div className="flex items-center gap-3 pointer-events-none">
                <div className={`p-2 rounded-full ${cat.bgClass}`}>
                  <Upload className={`h-5 w-5 ${cat.colorClass}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Drop {cat.label.toLowerCase()} here or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>
            </div>

            {files[cat.id]?.length > 0 && (
              <div className="grid gap-1.5 pl-2">
                {files[cat.id].map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 bg-card border border-border rounded-md animate-fade-in"
                  >
                    <div className="flex-shrink-0">
                      {file.file.type === "application/pdf" ? (
                        <FileText className={`h-4 w-4 ${cat.colorClass}`} />
                      ) : (
                        <Image className={`h-4 w-4 ${cat.colorClass}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{file.file.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(file.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => onFileRemove(cat.id, file.id)}
                        disabled={file.status === "processing"}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalFiles > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {totalFiles} file{totalFiles > 1 ? "s" : ""} ready for extraction
        </p>
      )}
    </div>
  );
}
