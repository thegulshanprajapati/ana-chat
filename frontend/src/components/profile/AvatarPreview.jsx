import React from "react";
import Avatar from "../common/Avatar";

export const AvatarPreview = React.memo(({ currentUrl, previewUrl, size = 96, name = "User" }) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-8 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 rounded-2xl">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Current Avatar</span>
        <div className="rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
          <Avatar src={currentUrl} size={size} name={name} />
        </div>
      </div>

      <div className="hidden sm:block text-slate-300 dark:text-slate-700 text-xl font-light">
        →
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">New Preview</span>
        <div className="rounded-full overflow-hidden border-2 border-violet-500/50 shadow-md">
          <Avatar src={previewUrl || currentUrl} size={size} name={name} />
        </div>
      </div>
    </div>
  );
});

export default AvatarPreview;
