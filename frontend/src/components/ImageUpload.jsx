import React, { useRef, useState } from "react";
import api, { fileUrl, apiError } from "@/lib/api";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function ImageUpload({ value, onChange, label = "Gambar", testid = "image-upload", className = "" }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Gambar berhasil diunggah");
    } catch (err) { toast.error(apiError(err)); }
    finally { setUploading(false); }
  };

  return (
    <div className={className}>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" data-testid={`${testid}-input`} />
      {value ? (
        <div className="relative inline-block">
          <img src={fileUrl(value)} alt="preview" className="w-28 h-28 rounded-xl object-cover border border-border" />
          <button type="button" onClick={() => onChange("")} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1" data-testid={`${testid}-remove`}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading} data-testid={`${testid}-btn`}
          className="w-28 h-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-accent tap bg-white">
          {uploading ? <Loader2 className="animate-spin" /> : <><Upload size={22} /><span className="text-xs mt-1">Unggah</span></>}
        </button>
      )}
    </div>
  );
}
