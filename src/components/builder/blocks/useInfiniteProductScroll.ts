import { useEffect, useRef } from 'react';

export function useInfiniteProductScroll(isOpen: boolean, loadMore: () => void) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!isOpen) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      entries => entries.some(entry => entry.isIntersecting) && loadMoreRef.current(),
      { root, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isOpen]);

  return { scrollRef, sentinelRef };
}
