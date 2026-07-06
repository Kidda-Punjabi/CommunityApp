"use client";

import { useRouter } from "next/navigation";
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";

type NavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
};

function shouldHandleClientNav(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function NavLink({
  href,
  className,
  children,
  onClick,
  ...props
}: NavLinkProps) {
  const router = useRouter();

  return (
    <a
      href={href}
      className={cn(pressableClass, className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !shouldHandleClientNav(event)) return;
        event.preventDefault();
        router.push(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
