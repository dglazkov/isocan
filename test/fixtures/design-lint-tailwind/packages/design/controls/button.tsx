import { cva } from "class-variance-authority";
const buttonVariants = cva("inline-flex bg-acme rounded-acme", {
  variants: {
    size: { sm: "px-2 py-1", lg: "px-4 py-2" },
    variant: { primary: "bg-acme", muted: "bg-acme-muted" },
  },
  defaultVariants: { size: "sm", variant: "primary" },
});
export function Button({ size, variant, className, ...props }: { size?: "sm" | "lg"; variant?: "primary" | "muted"; className?: string }) {
  return <button className={buttonVariants({ size, variant, className })} {...props} />;
}
