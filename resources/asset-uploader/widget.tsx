import {
  McpUseProvider,
  useFiles,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useCallback, useRef, useState } from "react";
import "../styles.css";
import { propSchema, type AssetUploaderProps } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description: "Upload images and files for use in slide decks",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: true,
    invoking: "Opening uploader...",
    invoked: "Uploader ready",
  },
};

type UploadedAsset = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
};

const AssetUploader: React.FC = () => {
  const { props, isPending, mcp_url, sendFollowUpMessage } =
    useWidget<AssetUploaderProps>();
  const { upload, isSupported } = useFiles();

  const [uploads, setUploads] = useState<UploadedAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allAssets: UploadedAsset[] = [
    ...(props?.assets ?? []),
    ...uploads.filter((u) => !props?.assets?.some((a) => a.id === u.id)),
  ];

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const serverUrl = mcp_url || "";
        const res = await fetch(`${serverUrl}/api/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data: base64,
          }),
        });

        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const { id, url } = await res.json();

        if (isSupported) {
          try {
            await upload(file);
          } catch {
            // non-critical — file is already on the server
          }
        }

        setUploads((prev) => [
          ...prev,
          { id, name: file.name, mimeType: file.type, url },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [mcp_url, isSupported, upload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const copyUrl = useCallback((id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Opening uploader...
            </span>
          </div>
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse h-32" />
        </div>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider autoSize>
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Asset Uploader
        </h3>

        {/* Drop zone */}
        <label
          className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
              : "border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5"
          } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/*,video/*,audio/*,.pdf,.svg"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Uploading...
              </span>
            </>
          ) : (
            <>
              <svg
                className="h-8 w-8 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop a file or click to upload
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Images, videos, PDFs, SVGs
              </span>
            </>
          )}
        </label>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        {/* Asset list */}
        {allAssets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Uploaded Assets ({allAssets.length})
            </h4>
            {allAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2.5"
              >
                {asset.mimeType?.startsWith("image/") && (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
                    {asset.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono">
                    {asset.url}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => copyUrl(asset.id, asset.url)}
                    className="px-2 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {copiedId === asset.id ? "Copied!" : "Copy URL"}
                  </button>
                  <button
                    onClick={() =>
                      sendFollowUpMessage(
                        `Add this image to the next slide: ${asset.url}`
                      )
                    }
                    className="px-2 py-1 text-xs font-medium rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                  >
                    Use in slides
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {allAssets.length === 0 && !isUploading && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-2">
            No assets uploaded yet
          </p>
        )}
      </div>
    </McpUseProvider>
  );
};

export default AssetUploader;
