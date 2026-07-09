import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Info } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface ToastMessage {
  id: number
  message: string
  type: ToastType
  isExiting?: boolean
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const toastStyles = {
  success: {
    bg: "bg-green-500/95",
    Icon: CheckCircle2,
  },
  error: {
    bg: "bg-red-500/95",
    Icon: XCircle,
  },
  info: {
    bg: "bg-blue-500/95",
    Icon: Info,
  },
} satisfies Record<ToastType, { bg: string; Icon: typeof CheckCircle2 }>

const exitDurationMs = 200
const autoDismissMs = 2000

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message, type }])
    },
    []
  )

  const removeToast = useCallback((id: number) => {

    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    )

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, exitDurationMs)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2"
        data-autonnel-ui="toast-stack"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastMessage
  onClose: () => void
}) {
  useEffect(() => {

    const timer = setTimeout(onClose, autoDismissMs)
    return () => clearTimeout(timer)
  }, [onClose])

  const { bg, Icon } = toastStyles[toast.type]

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg min-w-[200px]",
        "transition-all duration-200 ease-out",
        toast.isExiting
          ? "opacity-0 translate-x-24 scale-95"
          : "opacity-100 translate-x-0 scale-100 animate-toast-in",
        bg
      )}
      data-autonnel-ui="toast"
      data-toast-type={toast.type}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {toast.message}
    </div>
  )
}


export async function copyToClipboard(
  text: string,
  showToast: (message: string, type?: "success" | "error" | "info") => void,
  successMessage = "Copied to clipboard"
) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(successMessage, "success")
  } catch (err) {
    void err
    showToast("Failed to copy", "error")
  }
}
