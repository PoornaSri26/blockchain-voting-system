import * as React from "react"
import { cn } from "../../lib/utils"

// Simple variant utility function to replace class-variance-authority
const badgeVariants = (variant?: string) => {
  const baseClasses = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  
  switch (variant) {
    case "secondary":
      return `${baseClasses} border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200`;
    case "destructive":
      return `${baseClasses} border-transparent bg-red-500 text-white hover:bg-red-600`;
    case "outline":
      return `${baseClasses} text-gray-700 border-gray-300`;
    default:
      return `${baseClasses} border-transparent bg-blue-500 text-white hover:bg-blue-600`;
  }
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants(variant), className)} {...props} />
  )
}

export { Badge, badgeVariants }
