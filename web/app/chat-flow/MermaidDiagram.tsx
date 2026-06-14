"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

type MermaidDiagramProps = {
  chart: string;
};

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    background: "#ffffff",
    primaryColor: "#f7f5f0",
    primaryTextColor: "#1f1b16",
    primaryBorderColor: "#c9a154",
    lineColor: "#6b4a12",
    secondaryColor: "#ece7dc",
    tertiaryColor: "#fbfaf7",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
});

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const diagramId = `chat-flow-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    mermaid
      .render(diagramId, chart)
      .then(({ svg: renderedSvg }) => {
        if (!isMounted) {
          return;
        }

        setSvg(renderedSvg);
        setHasError(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setHasError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [chart, reactId]);

  if (hasError) {
    return (
      <div className="border border-[#d8d0c2] bg-white p-5 text-sm text-[#746957]">
        The flow diagram could not be displayed.
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="border border-[#d8d0c2] bg-white p-5 text-sm text-[#746957]">
        Loading flow diagram...
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto border border-[#d8d0c2] bg-white p-5 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
