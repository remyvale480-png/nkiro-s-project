import React, { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, ScanLine } from "lucide-react";

interface CameraSnapPanelProps {
  onRecognize: (imageBase64: string, mimeType: string) => Promise<void>;
  isRecognizing: boolean;
}

function compressImageElement(
  source: HTMLImageElement | HTMLVideoElement,
  naturalW: number,
  naturalH: number
): string {
  const maxDim = 1280;
  const scale = Math.min(maxDim / naturalW, maxDim / naturalH, 1);
  const targetW = Math.max(1, Math.round(naturalW * scale));
  const targetH = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", 0.78);
}

export const CameraSnapPanel: React.FC<CameraSnapPanelProps> = ({
  onRecognize,
  isRecognizing,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopCamera = () => {
    setStream((current) => {
      if (current) {
        current.getTracks().forEach((t) => t.stop());
      }
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setCameraError(null);
    setPreviewUrl(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream(media);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = media;
        }
      });
    } catch {
      setCameraError(
        "Camera preview is unavailable here. Upload a photo of your math problem instead."
      );
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const compressed = compressImageElement(video, video.videoWidth, video.videoHeight);
    stopCamera();
    setPreviewUrl(compressed);
    await onRecognize(compressed, "image/jpeg");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const compressed = compressImageElement(img, img.naturalWidth, img.naturalHeight);
        setPreviewUrl(compressed);
        await onRecognize(compressed, "image/jpeg");
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {stream ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-56 object-cover"
          />
          <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-teal-400/80 rounded-lg" />
          <div className="p-3 bg-slate-900/90 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={stopCamera}
              className="min-h-[44px] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={captureFrame}
              disabled={isRecognizing}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <ScanLine className="w-4 h-4" />
              Capture & Read
            </button>
          </div>
        </div>
      ) : previewUrl ? (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
          <img
            src={previewUrl}
            alt="Captured math problem"
            className="w-full max-h-56 object-contain"
          />
          <div className="p-3 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {isRecognizing ? "Reading math from photo…" : "Compressed & ready to edit below"}
            </span>
            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                fileInputRef.current?.click();
              }}
              className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-5 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Snap a printed or handwritten problem. Images are compressed before upload to save data.
          </p>
          {cameraError && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{cameraError}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={startCamera}
              disabled={isRecognizing}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Camera className="w-4 h-4" />
              Open Camera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecognizing}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ImagePlus className="w-4 h-4" />
              Upload Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
