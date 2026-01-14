
import React from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange }) => {
  return (
    <div className="relative h-full w-full bg-[#0a0a0a] border-r border-[#222]">
      <div className="absolute top-0 left-0 right-0 h-10 bg-[#111] border-b border-[#222] flex items-center px-4">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Editor — sketch.js</span>
      </div>
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="w-full h-[calc(100%-2.5rem)] mt-10 p-6 bg-transparent text-zinc-300 mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-0 selection:bg-zinc-800"
      />
    </div>
  );
};

export default CodeEditor;
