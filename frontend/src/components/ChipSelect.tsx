import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  multi?: boolean
  className?: string
}

export function ChipSelect({ options, selected, onChange, multi = true, className = '' }: Props) {
  const toggle = (opt: string) => {
    if (multi) {
      if (selected.includes(opt)) {
        onChange(selected.filter((s) => s !== opt))
      } else {
        onChange([...selected, opt])
      }
    } else {
      onChange(selected.includes(opt) ? [] : [opt])
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <motion.button
            key={opt}
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => toggle(opt)}
            className={active ? 'chip-active' : 'chip-inactive'}
          >
            {opt}
          </motion.button>
        )
      })}
    </div>
  )
}
