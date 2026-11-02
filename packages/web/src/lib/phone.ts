import { useEffect, useState } from "react";
/** Layout is width, independently of the pointer that operates it. */
export function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const changed = () => setPhone(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  return phone;
}
