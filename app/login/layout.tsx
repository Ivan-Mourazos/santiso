import type { Metadata } from "next";
import "../../app/globals.css";

export const metadata: Metadata = {
  title: "Login | UD Santiso Admin",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
