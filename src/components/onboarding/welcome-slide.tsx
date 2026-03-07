import type { ComponentType, SVGProps } from "react"

interface WelcomeSlideProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description: string
}

export function WelcomeSlide({
  icon: Icon,
  title,
  description,
}: WelcomeSlideProps) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-5">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </div>
  )
}
