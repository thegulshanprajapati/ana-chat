import clsx from "clsx";
import * as React from "react";

export const buttonVariants = {
  primary: "rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400",
  secondary: "rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 hover:bg-white/10"
};

export function Button({ className, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return <button className={clsx(buttonVariants[variant], className)} {...props} />;
}
