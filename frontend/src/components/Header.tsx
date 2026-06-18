import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onBack: () => void
}

export function Header({ onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-zinc-200 px-3 pt-3">
      <div className="flex items-center h-10 px-4 bg-white rounded-2xl shadow-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-zinc-500 hover:text-zinc-900"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>
      </div>
    </header>
  )
}
