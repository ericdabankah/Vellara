import { useEffect, useMemo, useRef, useState } from "react";
import "./property-media.css";
import { Archive, Check, CloudUpload, Eye, Image as ImageIcon, Info, Layers3, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";

type Category = "exterior" | "interior" | "amenity" | "view" | "floor_plan" | "other";
type DraftAsset = {
  id: string;
  file: File;
  previewUrl: string;
  category: Category;
  altText: string;
  caption: string;
  isCover: boolean;
};

const categories: { value: Category; label: string }[] = [
  { value: "exterior", label: "Exterior" },
  { value: "interior", label: "Interior" },
  { value: "amenity", label: "Amenity" },
  { value: "view", label: "View" },
  { value: "floor_plan", label: "Floor plan" },
  { value: "other", label: "Other" },
];
const accepted = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxBytes = 20 * 1024 * 1024;

export default function PropertyMediaWorkspace({ propertyName, propertyStatus }: { propertyName: string; propertyStatus: string }) {
  const [assets, setAssets] = useState<DraftAsset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0] ?? null;
  const readyCount = useMemo(() => assets.length, [assets]);

  useEffect(() => () => assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl)), []);

  function addFiles(fileList: FileList | File[]) {
    setFileError("");
    const incoming = Array.from(fileList);
    const acceptedFiles: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!accepted.has(file.type)) rejected.push(file.name + ": unsupported image format");
      else if (file.size > maxBytes) rejected.push(file.name + ": exceeds 20 MiB");
      else acceptedFiles.push(file);
    }
    if (rejected.length) setFileError(rejected.slice(0, 3).join(" · ") + (rejected.length > 3 ? " · and " + (rejected.length - 3) + " more" : ""));
    const next = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      category: "other" as Category,
      altText: "",
      caption: "",
      isCover: false,
    }));
    if (next.length) {
      setAssets((current) => [...current, ...next]);
      setSelectedId(next[0].id);
    }
  }

  function updateSelected(patch: Partial<DraftAsset>) {
    if (!selected) return;
    setAssets((current) => current.map((asset) => asset.id === selected.id ? { ...asset, ...patch } : patch.isCover ? { ...asset, isCover: false } : asset));
  }

  function removeAsset(id: string) {
    setAssets((current) => {
      const removed = current.find((asset) => asset.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = current.filter((asset) => asset.id !== id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  }

  return <div className="property-media">
    <section className="media-intro surface">
      <div className="media-intro-copy">
        <span className="eyebrow">PROPERTY MEDIA LIBRARY</span>
        <h2>Show guests what makes {propertyName} worth visiting.</h2>
        <p>Prepare the images that will appear on this property's public mini-website. Uploading and publishing will be enabled when the secure media API is approved.</p>
      </div>
      <div className="media-intro-status"><ShieldCheck size={17} /><span><b>Private by default</b><small>Nothing is public from this screen yet</small></span></div>
    </section>

    <div className="media-summary-grid">
      <article className="metric-card"><div className="metric-top"><span>Selected files</span><i><ImageIcon /></i></div><strong>{readyCount}</strong><small>Local preview queue only</small></article>
      <article className="metric-card"><div className="metric-top"><span>Published</span><i><Eye /></i></div><strong>0</strong><small>Publication API not connected</small></article>
      <article className="metric-card"><div className="metric-top"><span>Storage</span><i><Layers3 /></i></div><strong>Pending</strong><small>Private bucket not provisioned</small></article>
    </div>

    {propertyStatus !== "active" && <div className="inline-alert alert-error" role="status"><Info size={15} />This property is {propertyStatus}. Media management will remain unavailable until the property is active.</div>}

    <section className="surface media-upload-panel">
      <div className="media-section-heading"><div><h3>Add property images</h3><p>JPEG, PNG, WebP or AVIF. Maximum 20 MiB per image.</p></div><span className="media-private-tag"><ShieldCheck size={13} />Private draft</span></div>
      <button type="button" className={"media-dropzone" + (dragging ? " media-dropzone-active" : "")} disabled={propertyStatus !== "active"} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
        <span className="media-upload-icon"><CloudUpload size={23} /></span>
        <b>Drag images here or browse files</b>
        <small>Choose multiple images. Files are only previewed in this browser until backend upload is connected.</small>
        <span className="secondary-button"><Plus size={14} />Choose images</span>
      </button>
      <input ref={inputRef} className="media-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
      {fileError && <div className="inline-alert alert-error" role="alert"><Info size={14} />{fileError}<button type="button" onClick={() => setFileError("")} aria-label="Dismiss"><X size={13} /></button></div>}
    </section>

    <section className="surface media-library-panel">
      <div className="media-section-heading"><div><h3>Image library</h3><p>{assets.length ? assets.length + " image" + (assets.length === 1 ? "" : "s") + " in this local draft" : "Your property images will appear here."}</p></div><span className="table-meta">Not uploaded</span></div>
      {assets.length === 0 ? <div className="media-empty"><span><ImageIcon size={25} /></span><b>No images added yet</b><p>Add exterior, interior, amenities and view photos to prepare the public property page.</p></div> : <div className="media-editor-layout">
        <div className="media-grid">{assets.map((asset) => <button type="button" key={asset.id} className={"media-thumb" + (selected?.id === asset.id ? " media-thumb-selected" : "")} onClick={() => setSelectedId(asset.id)}><img src={asset.previewUrl} alt={asset.altText || asset.file.name} /><span>{asset.isCover ? "Cover image" : categories.find((item) => item.value === asset.category)?.label}</span></button>)}</div>
        {selected && <aside className="media-inspector">
          <div className="media-inspector-image"><img src={selected.previewUrl} alt={selected.altText || selected.file.name} /></div>
          <div className="media-inspector-heading"><div><b>Image details</b><small>{selected.file.name}</small></div><button type="button" className="icon-button" aria-label="Remove image" onClick={() => removeAsset(selected.id)}><Trash2 size={15} /></button></div>
          <label className="field"><span>Image category</span><select value={selected.category} onChange={(event) => updateSelected({ category: event.target.value as Category })}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field"><span>Alt text</span><input value={selected.altText} maxLength={180} placeholder="Describe what this image shows" onChange={(event) => updateSelected({ altText: event.target.value })} /></label>
          <label className="field"><span>Caption (optional)</span><textarea rows={2} value={selected.caption} maxLength={240} placeholder="A short customer-facing caption" onChange={(event) => updateSelected({ caption: event.target.value })} /></label>
          <label className="media-cover-toggle"><input type="checkbox" checked={selected.isCover} onChange={(event) => updateSelected({ isCover: event.target.checked })} />Use as property cover image</label>
          <div className="media-file-facts"><span>File size <b>{(selected.file.size / (1024 * 1024)).toFixed(2)} MiB</b></span><span>Format <b>{selected.file.type.split("/")[1]?.toUpperCase()}</b></span></div>
        </aside>}
      </div>}
    </section>

    <section className="media-publish-note"><ShieldCheck size={17} /><div><b>Publishing is intentionally locked for now</b><p>These previews are not saved to VELLARA and cannot appear on a public mini-website. Once the backend contract is approved, this interface will connect to signed uploads, server-side image verification, metadata saving and explicit publication controls.</p></div></section>
  </div>;
}
