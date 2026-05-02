import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  value: number          // 1–5, 0 = unrated
  onChange?: (rating: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 'text-sm', md: 'text-xl', lg: 'text-2xl' }

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: Props) {
  const [hovered, setHovered] = useState(0)

  const display = hovered || value

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          disabled={readOnly}
          whileTap={readOnly ? {} : { scale: 0.85 }}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={`${SIZES[size]} transition-colors duration-100 disabled:cursor-default ${
            star <= display ? 'text-yellow-400' : 'text-zinc-700'
          }`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </motion.button>
      ))}
    </div>
  )
}
