import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center bg-muted/40 px-4 py-10 sm:justify-center">
      <Logo className="mb-8 text-lg" />
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
