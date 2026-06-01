import React from 'react'
import { C } from './theme'

type Variant = 'default' | 'accent' | 'danger' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', disabled, children, style, ...props }, ref) => {
    let bg: string, fg: string

    if (disabled) {
      bg = '#333'
      fg = '#666'
    } else {
      switch (variant) {
        case 'accent':
          bg = '#554400'
          fg = C.gold
          break
        case 'danger':
          bg = C.danger
          fg = '#fff'
          break
        case 'ghost':
          bg = 'transparent'
          fg = C.text
          break
        default:
          bg = C.cardHi
          fg = C.text
      }
    }

    const btnStyle: React.CSSProperties = {
      padding: '8px 16px',
      borderRadius: 6,
      border: 'none',
      cursor: disabled ? 'default' : 'pointer',
      background: bg,
      color: fg,
      fontSize: 13,
      fontWeight: 'bold',
      ...style,
    }

    return (
      <button ref={ref} style={btnStyle} disabled={disabled} {...props}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
