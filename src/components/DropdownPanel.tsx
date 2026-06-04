import type { ReactNode } from 'react'
import styles from './DropdownPanel.module.css'

interface DropdownPanelProps {
  open: boolean
  className: string
  children: ReactNode
}

export const DropdownPanel = ({ open, className, children }: DropdownPanelProps) => {
  return (
    <div
      className={`${styles.dropdownPanel} ${className}`}
      data-open={open ? 'true' : 'false'}
      aria-hidden={!open}
    >
      {children}
    </div>
  )
}
