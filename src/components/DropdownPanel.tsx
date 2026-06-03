import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const dropdownPanelMotion = {
  initial: { opacity: 0, y: -8, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.95 },
}

const dropdownPanelTransition = { duration: 0.15 }

interface DropdownPanelProps {
  open: boolean
  className: string
  children: ReactNode
}

export const DropdownPanel = ({ open, className, children }: DropdownPanelProps) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={dropdownPanelMotion.initial}
          animate={dropdownPanelMotion.animate}
          exit={dropdownPanelMotion.exit}
          transition={dropdownPanelTransition}
          className={className}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
