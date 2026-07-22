import { createElement } from "react";
import { cn } from "@/lib/utils";

type ContainerProps = {
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
};

/** Centered max-width wrapper with responsive horizontal padding. */
export function Container({ as = "div", className, children }: ContainerProps) {
  return createElement(
    as,
    { className: cn("mx-auto w-full max-w-container container-px", className) },
    children,
  );
}
