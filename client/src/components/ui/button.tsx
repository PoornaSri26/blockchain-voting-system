import * as React from "react"
import { cn } from "../../lib/utils"

// Simple variant utility function to replace class-variance-authority
const buttonVariants = (variant?: string, size?: string) => {
  const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  let variantClasses = "";
  switch (variant) {
    case "destructive":
      variantClasses = "bg-red-500 text-white hover:bg-red-600";
      break;
    case "outline":
      variantClasses = "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700";
      break;
    case "secondary":
      variantClasses = "bg-gray-100 text-gray-900 hover:bg-gray-200";
      break;
    case "ghost":
      variantClasses = "hover:bg-gray-100 text-gray-700";
      break;
    case "link":
      variantClasses = "text-blue-600 underline-offset-4 hover:underline";
      break;
    default:
      variantClasses = "bg-blue-600 text-white hover:bg-blue-700";
  }

  let sizeClasses = "";
  switch (size) {
    case "sm":
      sizeClasses = "h-9 rounded-md px-3";
      break;
    case "lg":
      sizeClasses = "h-11 rounded-md px-8";
      break;
    case "icon":
      sizeClasses = "h-10 w-10";
      break;
    default:
      sizeClasses = "h-10 px-4 py-2";
  }

  return `${baseClasses} ${variantClasses} ${sizeClasses}`;
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? "span" : "button"
    return (
      <Comp
        className={cn(buttonVariants(variant, size), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
