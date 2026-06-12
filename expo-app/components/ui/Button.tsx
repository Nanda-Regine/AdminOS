import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native'

interface ButtonProps extends TouchableOpacityProps {
  label: string
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variants = {
  primary: 'bg-brand',
  secondary: 'bg-white border border-gray-200',
  ghost: 'bg-transparent',
}

const labelVariants = {
  primary: 'text-white font-semibold',
  secondary: 'text-gray-800 font-semibold',
  ghost: 'text-brand font-semibold',
}

export function Button({ label, loading, variant = 'primary', className = '', ...props }: ButtonProps & { className?: string }) {
  return (
    <TouchableOpacity
      className={`rounded-xl py-3.5 px-5 items-center ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#fff' : '#6366F1'} />
        : <Text className={labelVariants[variant]}>{label}</Text>
      }
    </TouchableOpacity>
  )
}
