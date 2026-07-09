import * as React from "react";

import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

function makeCardPart<Element extends HTMLElement, Props extends React.HTMLAttributes<Element>>(
  displayName: string,
  tagName: keyof JSX.IntrinsicElements,
  baseClassName: string,
) {
  const Part = React.forwardRef<Element, Props>(({ className, ...props }, ref) =>
    React.createElement(tagName, {
      ...props,
      "data-autonnel-ui": displayName,
      className: cn(baseClassName, className),
      ref,
    }),
  );
  Part.displayName = displayName;
  return Part;
}

const cardSurface = "rounded-[8px] border border-border bg-card text-card-foreground shadow-sm";

const Card = makeCardPart<HTMLDivElement, DivProps>("card", "div", cardSurface);
const CardHeader = makeCardPart<HTMLDivElement, DivProps>("card-header", "div", "flex flex-col gap-1.5 p-6");
const CardTitle = makeCardPart<HTMLHeadingElement, HeadingProps>("card-title", "h3", "text-2xl font-semibold leading-tight");
const CardDescription = makeCardPart<HTMLParagraphElement, ParagraphProps>("card-description", "p", "text-sm text-muted-foreground");
const CardContent = makeCardPart<HTMLDivElement, DivProps>("card-content", "div", "p-6 pt-0");
const CardFooter = makeCardPart<HTMLDivElement, DivProps>("card-footer", "div", "flex items-center p-6 pt-0");
const AnimatedCard = makeCardPart<HTMLDivElement, DivProps>(
  "animated-card",
  "div",
  cn(cardSurface, "transition duration-200 hover:-translate-y-1 hover:shadow-lg"),
);

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, AnimatedCard };
