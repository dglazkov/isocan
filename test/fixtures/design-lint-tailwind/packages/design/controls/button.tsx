/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
