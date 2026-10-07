"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Props = {
  label?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

export default function NativeBackButton({ label="戻る",href,onClick,className="",ariaLabel }:Props) {
  const content=<><ChevronLeft aria-hidden="true"/><span>{label}</span></>;
  const classes=`native-back-button ${className}`.trim();
  return href
    ? <Link className={classes} href={href} aria-label={ariaLabel}>{content}</Link>
    : <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel}>{content}</button>;
}
