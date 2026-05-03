import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  value: number          // 1–10, 0 = unrated
  onChange?: (rating: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-7 h-7 text-xs',
  lg: 'w-8 h-8 text-sm',
}

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: Props) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Rating out of 10">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <motion.button
          key={n}
          type="button"
          disabled={readOnly}
          whileTap={readOnly ? {} : { scale: 0.85 }}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHovered(n)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={`${SIZES[size]} rounded font-bold transition-colors duration-100 disabled:cursor-default ${
            n <= display
              ? 'bg-yellow-400 text-zinc-900'
              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
          aria-label={`${n} out of 10`}
        >
          {n}
        </motion.button>
      ))}
      {readOnly && value > 0 && (
        <span className="ml-1 text-sm font-semibold text-yellow-400">{value}/10</span>
      )}
    </div>
  )
}
