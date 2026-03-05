"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { PipelineRecord } from "@/types/pipeline";

export interface DeletePipelineDialogProps {
  pipeline: PipelineRecord | null;
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeletePipelineDialog({
  pipeline,
  isOpen,
  isDeleting,
  onConfirm,
  onCancel,
}: DeletePipelineDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen || !pipeline) return null;

  return (
    // Full-screen backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => { if (!isDeleting) onCancel(); }}
    >
      {/* Modal card — stop propagation so backdrop click doesn't fire inside */}
      <div
        className="relative mx-4 w-full max-w-[440px] rounded-2xl ring-1 ring-white/10 bg-zinc-900 shadow-2xl shadow-black/50 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-400"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-center text-lg font-semibold text-white">
          Delete Pipeline
        </h2>

        {/* Body */}
        <p className="mt-3 text-center text-sm text-zinc-400 leading-relaxed">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-white">{pipeline.name}</span>?
          <br />
          This will permanently remove the pipeline and all of its run history,
          agent messages, and execution logs. This action cannot be undone.
        </p>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-xl ring-1 ring-white/10 bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-200 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-900/30 transition-all duration-200 disabled:opacity-40"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Pipeline"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
