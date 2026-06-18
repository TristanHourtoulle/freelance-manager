export interface AvatarColor {
  key: string
  value: string
}

export const AVATAR_COLORS: readonly AvatarColor[] = [
  {
    key: "green",
    value: "linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.6 0.18 180))",
  },
  {
    key: "lime",
    value: "linear-gradient(135deg, oklch(0.7 0.16 130), oklch(0.55 0.16 155))",
  },
  {
    key: "blue",
    value: "linear-gradient(135deg, oklch(0.6 0.15 250), oklch(0.55 0.16 220))",
  },
  {
    key: "purple",
    value: "linear-gradient(135deg, oklch(0.55 0.16 280), oklch(0.6 0.16 320))",
  },
  {
    key: "pink",
    value: "linear-gradient(135deg, oklch(0.6 0.16 0), oklch(0.55 0.16 350))",
  },
  {
    key: "orange",
    value: "linear-gradient(135deg, oklch(0.7 0.16 50), oklch(0.6 0.16 30))",
  },
  {
    key: "yellow",
    value: "linear-gradient(135deg, oklch(0.78 0.16 90), oklch(0.65 0.16 70))",
  },
  {
    key: "teal",
    value:
      "linear-gradient(135deg, oklch(0.65 0.13 195), oklch(0.55 0.15 220))",
  },
] as const
