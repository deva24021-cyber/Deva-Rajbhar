import React, {useState} from 'react';
import {Check, Copy, Download, Terminal} from 'lucide-react';
import type {ProjectArtifact} from '../types';

interface BackendExportViewProps {
  artifacts: ProjectArtifact[];
}

export const BackendExportView: React.FC<BackendExportViewProps> = ({artifacts}) => {
  const [selectedPath, setSelectedPath] = useState<string>(artifacts[0]?.path || '');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeArtifact = artifacts.find((a) => a.path === selectedPath) || artifacts[0];

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPath(id);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  const downloadFile = (artifact: ProjectArtifact) => {
    const blob = new Blob([artifact.content], {type: 'text/plain;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const gitCommands = `git init
git add .
git commit -m "Initial commit: Krishna Recharge Flutter + Node.js + MySQL"
git branch -M main
gh repo create krishna-recharge --private --source=. --remote=origin --push`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Setup & GitHub Checklist */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-blue-800" />
              <h2 className="text-base font-semibold text-slate-900">Node.js + MySQL + GitHub Deployment</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The MySQL schema (<span className="font-mono">database/schema.sql</span>), standalone Express + MySQL2
              backend (<span className="font-mono">backend_api/server.js</span>), Flutter mobile app (
              <span className="font-mono">mobile_app/lib/main.dart</span>), and GitHub Actions APK workflow are
              already generated in this project workspace.
            </p>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">1. Import MySQL Schema &amp; Start Backend</div>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
{`mysql -u root -p < database/schema.sql
cd backend_api
cp .env.example .env
npm install && npm start`}
              </pre>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">2. Push to Private GitHub Repository</span>
                <button
                  type="button"
                  onClick={() => copyText(gitCommands, 'git-cmds')}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-800 hover:underline cursor-pointer"
                >
                  {copiedPath === 'git-cmds' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedPath === 'git-cmds' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
                {gitCommands}
              </pre>
            </div>
          </div>
        </div>

        {/* File Inspector */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 bg-slate-50">
            <div className="flex flex-wrap gap-1">
              {artifacts.map((art) => (
                <button
                  key={art.path}
                  type="button"
                  onClick={() => setSelectedPath(art.path)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeArtifact?.path === art.path
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {art.label}
                </button>
              ))}
            </div>

            {activeArtifact && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyText(activeArtifact.content, activeArtifact.path)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedPath === activeArtifact.path ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedPath === activeArtifact.path ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadFile(activeArtifact)}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-900 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>

          {activeArtifact && (
            <div className="max-h-[480px] overflow-auto bg-slate-950 p-4">
              <pre className="font-mono text-xs leading-relaxed text-slate-100">{activeArtifact.content}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
