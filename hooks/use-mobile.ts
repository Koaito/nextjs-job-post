import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// 24/09 (Round 5): viết lại bản shadcn sinh sẵn (useState + setState đồng
// bộ trong useEffect) sang useSyncExternalStore — bản gốc bị eslint
// react-hooks/set-state-in-effect báo Error (setState ngay trong effect
// gây render dồn), làm `npm run lint` không sạch. Hành vi giữ nguyên:
// true khi viewport < 768px; SSR/lần render đầu luôn false (không có
// window), sau hydrate mới cập nhật đúng.
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
