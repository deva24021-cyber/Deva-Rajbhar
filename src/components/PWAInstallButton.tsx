import React, {useState} from 'react';
import {Download, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="pwa-install-title" className="text-base font-semibold text-slate-900">
                  Install Krishna Recharge
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Add this portal to your home screen or desktop for standalone offline-ready access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
              {isIOS ? (
                <ol className="list-decimal space-y-2 pl-4">
                  <li>
                    Tap the <strong>Share</strong> icon in the Safari toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> to launch Krishna Recharge as an app.
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-2 pl-4">
                  <li>
                    Open this app directly in Chrome, Edge, or Android Chrome (outside embedded preview frames).
                  </li>
                  <li>
                    Click the <strong>Install</strong> icon in the browser address bar or choose{' '}
                    <strong>Install Krishna Recharge</strong> from the browser menu.
                  </li>
                  <li>
                    For the native Android APK, open the <strong>Backend &amp; Export</strong> section to run the
                    GitHub Actions Flutter APK build.
                  </li>
                </ol>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
