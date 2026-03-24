import {
  McpUseProvider,
  ModelContext,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useCallback, useEffect, useState } from "react";
import "../styles.css";
import { propSchema, type Slide, type SlideViewerProps } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description:
    "Presentation slide viewer with navigation and fullscreen mode",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: true,
    invoking: "Building slides...",
    invoked: "Presentation ready",
  },
};

const SlideContent: React.FC<{
  slide: Slide;
  layout?: string;
  isFullscreen: boolean;
}> = ({ slide, layout = "center", isFullscreen }) => {
  const layoutClasses: Record<string, string> = {
    center: "items-center justify-center text-center",
    left: "items-start justify-center text-left",
    split: "items-center justify-center text-left",
  };

  return (
    <div
      className={`flex flex-col h-full w-full p-8 ${isFullscreen ? "p-16" : "p-8"} ${layoutClasses[layout] ?? layoutClasses.center}`}
    >
      <h2
        className={`font-bold leading-tight mb-4 ${isFullscreen ? "text-5xl" : "text-2xl"}`}
      >
        {slide.title}
      </h2>
      <div
        className={`leading-relaxed max-w-prose ${isFullscreen ? "text-2xl" : "text-base"} [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-2 [&_li]:leading-relaxed [&_p]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_code]:bg-black/10 [&_code]:dark:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-current/20 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:underline [&_a]:underline-offset-2`}
        dangerouslySetInnerHTML={{ __html: slide.content }}
      />
      {slide.imageUrl && (
        <img
          src={slide.imageUrl}
          alt=""
          className={`rounded-lg mt-4 ${isFullscreen ? "max-h-[40vh]" : "max-h-[200px]"} object-contain mx-auto`}
          style={{ maxWidth: "80%" }}
        />
      )}
    </div>
  );
};

const SlideViewer: React.FC = () => {
  const {
    props,
    isPending,
    isStreaming,
    partialToolInput,
    displayMode,
    requestDisplayMode,
    sendFollowUpMessage,
    openExternal,
    state,
    setState,
    theme,
  } = useWidget<SlideViewerProps>();

  const {
    callTool: exportDeck,
    data: exportData,
    isPending: isExporting,
  } = useCallTool("export-deck");

  const [currentIndex, setCurrentIndex] = useState(0);

  const slides: Slide[] =
    props?.slides ??
    (isStreaming
      ? ((partialToolInput as Partial<SlideViewerProps>)?.slides ?? [])
      : []);
  const deckTitle =
    props?.deckTitle ??
    (partialToolInput as Partial<SlideViewerProps>)?.deckTitle;
  const deckTheme =
    props?.theme ??
    (partialToolInput as Partial<SlideViewerProps>)?.theme ??
    "light";

  useEffect(() => {
    if (state?.slideIndex != null) {
      setCurrentIndex(state.slideIndex as number);
    }
  }, []);

  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(slides.length - 1);
    }
  }, [slides.length, currentIndex]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, slides.length - 1));
      setCurrentIndex(clamped);
      setState({ slideIndex: clamped });
    },
    [slides.length, setState]
  );

  const goNext = useCallback(
    () => goTo(currentIndex + 1),
    [currentIndex, goTo]
  );
  const goPrev = useCallback(
    () => goTo(currentIndex - 1),
    [currentIndex, goTo]
  );

  const isFullscreen = displayMode === "fullscreen";

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        requestDisplayMode("inline");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, goNext, goPrev, requestDisplayMode]);

  const themeClasses: Record<string, string> = {
    light: "bg-white text-gray-900",
    dark: "bg-gray-900 text-white",
    gradient:
      "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white",
  };

  const navBtnClasses =
    deckTheme === "light"
      ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
      : "bg-white/10 hover:bg-white/20 text-white";

  const counterClasses =
    deckTheme === "light"
      ? "text-gray-500"
      : "text-white/60";

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="p-6 space-y-4 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Building slides...
            </span>
          </div>
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse h-48" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse h-12 w-20"
              />
            ))}
          </div>
        </div>
      </McpUseProvider>
    );
  }

  if (slides.length === 0) {
    return (
      <McpUseProvider autoSize>
        <div className="p-6 text-center text-gray-400 dark:text-gray-500">
          {isStreaming ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span>Receiving slides...</span>
            </div>
          ) : (
            "No slides to display"
          )}
        </div>
      </McpUseProvider>
    );
  }

  const currentSlide = slides[currentIndex];

  if (isFullscreen) {
    return (
      <McpUseProvider autoSize>
        <ModelContext
          content={`Viewing slide ${currentIndex + 1} of ${slides.length}: ${currentSlide?.title}`}
        />
        <div
          className={`fixed inset-0 z-50 flex flex-col ${themeClasses[deckTheme] ?? themeClasses.light}`}
          style={currentSlide?.bgColor ? { backgroundColor: currentSlide.bgColor } : undefined}
        >
          <div className="flex-1 flex items-stretch overflow-hidden">
            <div className="flex-1 flex">
              <SlideContent
                slide={currentSlide}
                layout={currentSlide?.layout}
                isFullscreen
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-8 py-4">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${navBtnClasses}`}
            >
              ← Prev
            </button>

            <div className="flex items-center gap-4">
              <span className={`text-sm font-mono ${counterClasses}`}>
                {currentIndex + 1} / {slides.length}
              </span>
              <button
                onClick={() => requestDisplayMode("inline")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${navBtnClasses}`}
              >
                Exit Fullscreen
              </button>
            </div>

            <button
              onClick={goNext}
              disabled={currentIndex === slides.length - 1}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${navBtnClasses}`}
            >
              Next →
            </button>
          </div>
        </div>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider autoSize>
      <ModelContext
        content={`Viewing slide ${currentIndex + 1} of ${slides.length}: ${currentSlide?.title}`}
      />
      <div className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {deckTitle && (
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                {deckTitle}
              </h3>
            )}
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-500">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                Streaming...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                sendFollowUpMessage(
                  `Refine slide ${currentIndex + 1} ("${currentSlide?.title}") of this presentation. Make it more impactful and visually engaging.`
                )
              }
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
            >
              Refine this slide
            </button>
            <button
              onClick={() =>
                sendFollowUpMessage("Upload an image asset for the slides")
              }
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Upload
            </button>
            {exportData?.content?.[0] ? (
              <button
                onClick={() => {
                  const item = exportData.content?.[0];
                  const raw =
                    item && "text" in item ? (item.text ?? "") : "";
                  const urlMatch = raw.match(/https?:\/\/\S+/);
                  if (urlMatch) openExternal(urlMatch[0]);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
              >
                Open Export
              </button>
            ) : (
              <button
                onClick={() => exportDeck()}
                disabled={isExporting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isExporting ? "Exporting..." : "Export"}
              </button>
            )}
            <button
              onClick={() => requestDisplayMode("fullscreen")}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Present ⛶
            </button>
          </div>
        </div>

        {/* Main slide */}
        <div
          className={`relative rounded-xl overflow-hidden transition-all duration-300 ${themeClasses[deckTheme] ?? themeClasses.light}`}
          style={{
            minHeight: "280px",
            ...(currentSlide?.bgColor
              ? { backgroundColor: currentSlide.bgColor }
              : {}),
          }}
        >
          <SlideContent
            slide={currentSlide}
            layout={currentSlide?.layout}
            isFullscreen={false}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
            {currentIndex + 1} / {slides.length}
          </span>

          <button
            onClick={goNext}
            disabled={currentIndex === slides.length - 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>

        {/* Slide strip thumbnails */}
        {slides.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {slides.map((slide, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs transition-all ${
                  i === currentIndex
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <span className="font-mono opacity-60">{i + 1}</span>{" "}
                <span className="truncate max-w-[80px] inline-block align-bottom">
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </McpUseProvider>
  );
};

export default SlideViewer;
