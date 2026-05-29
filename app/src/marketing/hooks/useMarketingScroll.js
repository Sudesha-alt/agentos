import { useEffect, useState } from "react";
import { marketingScrollStore } from "../scrollStore";

export function useMarketingScroll() {
  const [offset, setOffset] = useState(marketingScrollStore.getOffset());

  useEffect(() => marketingScrollStore.subscribe(setOffset), []);

  return offset;
}
