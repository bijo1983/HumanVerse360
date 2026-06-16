import { useRef, useState, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Loader2, ImagePlus, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Renders a centered square crop as the initial crop.
 */
function makeCenteredCrop(mediaWidth, mediaHeight, aspect) {
  if (aspect) {
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
      mediaWidth,
      mediaHeight
    );
  }
  // Free crop: start with a centered 80% square
  return centerCrop(
    { unit: '%', width: 80, height: 80 },
    mediaWidth,
    mediaHeight
  );
}

/**
 * Uses a canvas to extract the cropped pixels from an <img> element.
 * Returns a Blob.
 */
function getCroppedBlob(image, crop, outputSize = 800) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelX = crop.x * scaleX;
    const pixelY = crop.y * scaleY;
    const pixelW = crop.width * scaleX;
    const pixelH = crop.height * scaleY;

    // Keep aspect ratio, cap at outputSize
    const ratio = pixelW / pixelH;
    let cw = outputSize;
    let ch = Math.round(outputSize / ratio);
    if (ch > outputSize) { ch = outputSize; cw = Math.round(outputSize * ratio); }

    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, pixelX, pixelY, pixelW, pixelH, 0, 0, cw, ch);
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.9);
  });
}

/**
 * Props:
 *  value      – current image URL (string | null)
 *  onChange   – (url: string) => void  called after successful upload
 *  bucket     – Supabase storage bucket id
 *  storagePath – folder path, e.g. "company-logos/abc123"
 *  aspect     – crop aspect ratio (e.g. 1 for square, 4/3, undefined = free)
 *  shape      – 'round' | 'rect' (default 'rect')
 *  label      – button / placeholder label
 *  previewClass – extra classes on the preview element
 */
export default function ImageUploadCrop({
  value,
  onChange,
  bucket,
  storagePath,
  aspect,
  shape = 'rect',
  label = 'Upload Image',
  previewClass = '',
}) {
  const inputRef = useRef(null);
  const imgRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function openPicker() {
    setError('');
    inputRef.current?.click();
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setModalOpen(true);
    };
    reader.readAsDataURL(file);
  }

  const onImageLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCrop(makeCenteredCrop(w, h, aspect));
  }, [aspect]);

  async function handleApply() {
    if (!completedCrop || !imgRef.current) return;
    setUploading(true);
    setError('');
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const ext = 'jpg';
      const fileName = `${storagePath}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onChange(data.publicUrl);
      setModalOpen(false);
    } catch (e) {
      setError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleCancel() {
    setModalOpen(false);
    setImgSrc('');
  }

  const isRound = shape === 'round';

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Preview / trigger */}
      <button
        type="button"
        onClick={openPicker}
        className={`relative group flex-shrink-0 overflow-hidden border-2 border-dashed border-secondary-300 bg-secondary-50 hover:border-primary-400 hover:bg-primary-50 transition-all ${isRound ? 'rounded-full' : 'rounded-xl'} ${previewClass}`}
        title={label}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Preview"
              className={`w-full h-full object-cover ${isRound ? 'rounded-full' : 'rounded-xl'}`}
            />
            <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isRound ? 'rounded-full' : 'rounded-xl'}`}>
              <RotateCcw className="w-5 h-5 text-white mb-1" />
              <span className="text-white text-xs font-medium">Change</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-1.5 p-3">
            <ImagePlus className="w-6 h-6 text-secondary-400 group-hover:text-primary-500 transition-colors" />
            <span className="text-xs text-secondary-400 group-hover:text-primary-600 transition-colors text-center leading-tight">{label}</span>
          </div>
        )}
      </button>

      {/* Crop Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
              <h3 className="text-base font-semibold text-secondary-900">Crop Image</h3>
              <button type="button" onClick={handleCancel} className="text-secondary-400 hover:text-secondary-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Crop area */}
            <div className="p-5 flex items-center justify-center bg-secondary-900 min-h-[300px] max-h-[60vh] overflow-auto">
              {imgSrc && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, pct) => setCrop(pct)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  circularCrop={isRound}
                  minWidth={30}
                  minHeight={30}
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Crop source"
                    style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              )}
            </div>

            {/* Hint */}
            <div className="px-5 pt-3 pb-1">
              <p className="text-xs text-secondary-500">
                Drag the handles to adjust the crop area.{aspect ? ` Aspect ratio is locked.` : ' Free crop: resize freely.'}
              </p>
              {error && (
                <p className="text-xs text-error-600 mt-1 font-medium">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-secondary-100 gap-3">
              <button type="button" onClick={openPicker} className="btn-secondary text-sm flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Choose Different
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={handleCancel} className="btn-secondary text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={uploading || !completedCrop}
                  className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" />Apply & Save</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
