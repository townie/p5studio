
import React, { useMemo } from 'react';

interface PreviewProps {
  code: string;
}

const Preview: React.FC<PreviewProps> = ({ code }) => {
  const htmlContent = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"><\/script>
          <style>
            body { margin: 0; padding: 0; overflow: hidden; background: #0a0a0a; }
            canvas { display: block; }
          </style>
        </head>
        <body>
          <script>
            try {
              const code = ${JSON.stringify(code)};
              eval(code);
            } catch (err) {
              console.error(err);
              document.body.innerHTML = '<div style="color: #ff4444; padding: 20px; font-family: monospace;">' + err.message + '</div>';
            }
          <\/script>
        </body>
      </html>
    `;
  }, [code]);

  return (
    <div className="relative h-full w-full bg-[#050505] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-10 bg-[#111] border-b border-[#222] flex items-center px-4 z-10 bg-opacity-80 backdrop-blur-sm">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Preview — Live</span>
      </div>
      <iframe
        title="p5-preview"
        className="w-full h-full border-none pt-10"
        sandbox="allow-scripts"
        srcDoc={htmlContent}
      />
    </div>
  );
};

export default Preview;
