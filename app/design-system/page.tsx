import type { Metadata } from "next";
import DesignSystemShowcase from "./showcase";

export const metadata: Metadata = {
  title: "Vehigo — Tasarım Sistemi",
  description: "Vehigo'nun görsel dili: renk, tipografi ve gerçek ekranlar üzerinde uygulanışı.",
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
