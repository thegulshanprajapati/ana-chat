import * as React from "react";
import clsx from "clsx";
import { Slot } from "@radix-ui/react-slot";

export const buttonVariants = {
  primary: "rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 cursor-pointer inline-flex items-center justify-center transition-all",
  secondary: "rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 hover:bg-white/10 cursor-pointer inline-flex items-center justify-center transition-all"
};

export function Button({ className, variant = "primary", asChild = false, ...props }: React.ComponentPropsWithoutRef<"button"> & { variant?: keyof typeof buttonVariants; asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  const classes = clsx(buttonVariants[variant], className);
  return <Comp className={classes} {...(props as any)} />;
}
