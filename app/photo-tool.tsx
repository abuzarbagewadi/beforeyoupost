'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  FileImage,
  LockKeyhole,
  MapPinOff,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Scan = {
  file: File;
  url: string;
  hasMetadata: boolean;
  metadataKinds: string[];
};

const MAX_EXPORT_EDGE = 4096;
const MAX_EXPORT_PIXELS = 16_000_000;

function inspectBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(bytes.slice(0, 256_000));
  const kinds: string[] = [];
  if (text.toLowerCase().includes('exif\u0000\u0000'))
    kinds.push('EXIF metadata');
  if (/<\?xpacket|xmpmeta|XMP /i.test(text)) kinds.push('XMP edit data');
  if (/GPSLatitude|GPSLongitude|GPSInfo/i.test(text))
    kinds.push('Location fields');
  if (/DateTimeOriginal|CreateDate|ModifyDate/i.test(text))
    kinds.push('Capture time');
  if (
    ['make\u0000', 'model\u0000', 'software\u0000'].some((field) =>
      text.toLowerCase().includes(field),
    )
  )
    kinds.push('Device details');
  if (/tEXt|iTXt|zTXt/.test(text) && bytes[0] === 0x89 && bytes[1] === 0x50)
    kinds.push('PNG text fields');
  return [...new Set(kinds)];
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState('');
  const [exportNote, setExportNote] = useState('');

  useEffect(() => {
    type ModelContext = {
      registerTool: (
        tool: unknown,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'start_photo_privacy_check',
          title: 'Choose a photo to check',
          description:
            'Open the local photo chooser so the user can select an image for an on-device privacy check.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => {
            inputRef.current?.click();
            return { status: 'photo_picker_opened', processing: 'on-device' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const handleFile = useCallback(async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError('That image is over the 40 MB limit.');
      return;
    }
    setError('');
    setExportNote('');
    const kinds = inspectBytes(await file.arrayBuffer());
    setScan((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return {
        file,
        url: URL.createObjectURL(file),
        hasMetadata: kinds.length > 0,
        metadataKinds: kinds,
      };
    });
  }, []);

  const cleanAndDownload = async () => {
    if (!scan) return;
    setCleaning(true);
    setError('');
    setExportNote('');

    try {
      const image = new Image();
      image.src = scan.url;
      await image.decode();

      const pixelScale = Math.sqrt(
        MAX_EXPORT_PIXELS / (image.naturalWidth * image.naturalHeight),
      );
      const edgeScale =
        MAX_EXPORT_EDGE / Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, pixelScale, edgeScale);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const outputType =
        scan.file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, 0.94),
      );
      if (!blob) throw new Error('Image export failed');

      const stem = scan.file.name.replace(/\.[^.]+$/, '');
      const fileName = `${stem}-safe.${outputType === 'image/png' ? 'png' : 'jpg'}`;
      const cleanFile = new File([blob], fileName, { type: outputType });
      const shareData: ShareData = { files: [cleanFile], title: 'Clean photo' };

      if (navigator.share && navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          setExportNote(
            scale < 1
              ? 'Shared successfully. The large photo was resized for mobile stability.'
              : 'Shared successfully.',
          );
          return;
        } catch (shareError) {
          if (
            shareError instanceof DOMException &&
            shareError.name === 'AbortError'
          )
            return;
        }
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
      setExportNote(
        scale < 1
          ? 'Saved a clean copy. The large photo was resized for mobile stability.'
          : 'Saved a clean copy.',
      );
    } catch {
      setError('This device could not export that photo. Try a smaller image.');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-clip bg-background text-foreground"
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <a
          href="#top"
          className="flex min-w-0 shrink items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(17,94,89,.22)]">
            <ShieldCheck className="size-5" />
          </span>
          <span className="truncate">beforeyoupost</span>
        </a>
        <Badge
          variant="outline"
          className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800"
        >
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span className="sm:hidden">On-device</span>
          <span className="hidden sm:inline">100% on-device</span>
        </Badge>
      </nav>

      <section className="mx-auto grid min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] items-start gap-10 px-5 pb-16 pt-7 sm:gap-12 sm:px-8 sm:pb-20 sm:pt-8 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:gap-16 lg:pt-16">
        <div className="min-w-0 pt-3 lg:sticky lg:top-8">
          <Badge className="mb-6 bg-amber-100 text-amber-950 hover:bg-amber-100">
            <Sparkles /> A privacy check for your photos
          </Badge>
          <h1 className="max-w-xl text-balance text-[2.65rem] font-semibold leading-[.98] tracking-[-.05em] min-[390px]:text-5xl sm:text-6xl sm:leading-[.96] sm:tracking-[-.055em]">
            Check it before you post it.
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
            Find hidden photo data, remove it, and export a clean copy—without
            your image ever leaving this device.
          </p>
          <div className="mt-9 grid max-w-lg gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              [MapPinOff, 'Location', 'Strip GPS tags'],
              [FileImage, 'Metadata', 'Spot hidden data'],
              [LockKeyhole, 'Private', 'Nothing uploads'],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof MapPinOff;
              return (
                <div key={String(title)} className="feature-card">
                  <FeatureIcon className="size-5 text-primary" />
                  <strong>{String(title)}</strong>
                  <span>{String(copy)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tool-shell min-w-0">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-7">
            <div>
              <p className="text-sm font-semibold">Photo privacy check</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                JPEG, PNG or WebP · up to 40 MB
              </p>
            </div>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-primary sm:flex">
              <LockKeyhole className="size-3.5" /> Local only
            </span>
          </div>

          {!scan ? (
            <button
              type="button"
              className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void handleFile(event.dataTransfer.files[0]);
              }}
            >
              <span className="upload-mark">
                <Upload className="size-7" />
              </span>
              <span className="mt-5 text-xl font-semibold tracking-tight">
                Drop a photo here
              </span>
              <span className="mt-2 text-sm text-muted-foreground">
                or click to choose from your device
              </span>
              {error ? (
                <span
                  className="mt-3 text-sm font-medium text-red-700"
                  role="alert"
                >
                  {error}
                </span>
              ) : null}
              <span className="mt-8 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                <ShieldCheck className="size-3.5 text-primary" /> Your photo
                never gets uploaded
              </span>
            </button>
          ) : (
            <div className="grid gap-5 p-5 sm:p-7">
              <div className="overflow-hidden rounded-2xl bg-[#102421] p-3">
                {/* oxlint-disable-next-line next/no-img-element -- previews use a local blob URL */}
                <img
                  src={scan.url}
                  alt="Selected preview"
                  className="mx-auto max-h-[360px] w-auto rounded-xl object-contain"
                />
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Scan complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scan.hasMetadata
                        ? 'Hidden data was detected in this file.'
                        : 'No common metadata signatures were detected.'}
                    </p>
                  </div>
                  <span
                    className={`status-dot ${scan.hasMetadata ? 'warning' : 'safe'}`}
                  >
                    {scan.hasMetadata ? 'Review' : 'Looks clean'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(scan.metadataKinds.length
                    ? scan.metadataKinds
                    : ['No GPS found', 'No EXIF found']
                  ).map((item) => (
                    <span key={item} className="finding">
                      <Check className="size-3.5" /> {item}
                    </span>
                  ))}
                </div>
              </div>
              {error ? (
                <p className="text-sm font-medium text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              {exportNote ? (
                <output className="text-sm font-medium text-primary">
                  {exportNote}
                </output>
              ) : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    URL.revokeObjectURL(scan.url);
                    setScan(null);
                    setError('');
                    setExportNote('');
                  }}
                >
                  Choose another
                </Button>
                <Button
                  size="lg"
                  className="bg-primary px-5 shadow-[0_8px_20px_rgba(17,94,89,.2)]"
                  onClick={() => void cleanAndDownload()}
                  disabled={cleaning}
                >
                  {cleaning ? (
                    'Cleaning…'
                  ) : (
                    <>
                      <span className="sm:hidden">Save clean copy</span>
                      <span className="hidden sm:inline">
                        Download clean copy
                      </span>
                    </>
                  )}{' '}
                  <ArrowRight />
                </Button>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </section>
      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        Private by design. Processing happens entirely in your browser.
      </footer>
    </main>
  );
}
